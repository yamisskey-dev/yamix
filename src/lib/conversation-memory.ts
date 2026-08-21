/**
 * 会話メモリ（ローリング要約）
 *
 * yamii へは直近 QUERY_LIMITS.RECENT_MESSAGES 件しか履歴を送らないため、
 * 長い相談ではそれより古い文脈が失われる。古いメッセージを yamii の
 * /v1/summarize-context で要約し、暗号化してセッションに保存する。
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { yamiiClient } from "@/lib/yamii-client";
import { encryptMessage, safeDecryptMessage } from "@/lib/encryption";
import { QUERY_LIMITS } from "@/lib/constants";

// このバッチ数以上の未要約メッセージが溜まってから要約する（LLM 呼び出しの償却）
const SUMMARY_BATCH_MIN = 6;

export interface SummarizationPlan {
  fromIndex: number;
  toIndex: number; // exclusive
  newSummarizedCount: number;
}

/**
 * 要約が必要かを判定し、対象範囲を返す（不要なら null）
 *
 * - 直近 windowSize 件は履歴としてそのまま送るため常に要約対象外
 * - 未要約の古いメッセージが SUMMARY_BATCH_MIN 件以上溜まったら実行
 */
export function planSummarization(
  totalCount: number,
  summarizedCount: number,
  windowSize: number
): SummarizationPlan | null {
  const toIndex = totalCount - windowSize;
  if (toIndex - summarizedCount < SUMMARY_BATCH_MIN) return null;
  return {
    fromIndex: summarizedCount,
    toIndex,
    newSummarizedCount: toIndex,
  };
}

/**
 * 必要ならセッションの要約を更新する（fire-and-forget 用）
 *
 * 応答をブロックしないよう呼び出し側では await しない。失敗してもログのみ
 * （次のメッセージ送信時に再試行される）。
 */
export async function updateSessionSummaryIfNeeded(
  sessionId: string,
  ownerId: string
): Promise<void> {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        contextSummary: true,
        summarizedCount: true,
        _count: { select: { messages: true } },
      },
    });
    if (!session) return;

    const plan = planSummarization(
      session._count.messages,
      session.summarizedCount,
      QUERY_LIMITS.RECENT_MESSAGES
    );
    if (!plan) return;

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      skip: plan.fromIndex,
      take: plan.toIndex - plan.fromIndex,
      select: { role: true, content: true },
    });
    if (messages.length === 0) return;

    const previousSummary = session.contextSummary
      ? safeDecryptMessage(session.contextSummary, ownerId)
      : null;

    const summary = await yamiiClient.summarizeContext(
      messages.map((m) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: safeDecryptMessage(m.content, ownerId),
      })),
      previousSummary
    );

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        contextSummary: encryptMessage(summary, ownerId),
        summarizedCount: plan.newSummarizedCount,
      },
    });

    logger.info("Session context summary updated", {
      sessionId,
      summarizedCount: plan.newSummarizedCount,
    });
  } catch (error) {
    // 要約は補助機能なので失敗しても本体の応答には影響させない
    logger.error("Failed to update session summary", { sessionId }, error);
  }
}
