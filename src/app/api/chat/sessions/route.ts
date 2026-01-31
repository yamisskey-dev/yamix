import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { ChatSessionListItem, ChatSessionsResponse } from "@/types";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { createChatSessionSchema, validateBody, parseLimit } from "@/lib/validation";
import { decryptMessage, encryptMessage } from "@/lib/encryption";
import { authenticateRequest, ErrorResponses } from "@/lib/api-helpers";
import { yamiiClient } from "@/lib/yamii-client";
import { TOKEN_ECONOMY } from "@/types";
import { notifyDirectedRequest } from "@/lib/notifications";
import { checkCrisisKeywords } from "@/lib/crisis";

// Prismaのセッション取得結果の型
interface PrismaSessionResult {
  id: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
  isAnonymous: boolean;
  userId: string;
  updatedAt: Date;
  messages: { content: string; role: string }[];
  _count?: { targets: number; messages?: number };
}

// GET /api/chat/sessions - List user's chat sessions
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;
  const { payload } = authResult;

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor");

  try {
    // Fetch owned sessions AND sessions where user is a DIRECTED target
    const sessionSelect = {
      id: true,
      title: true,
      consultType: true,
      isAnonymous: true,
      userId: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { content: true, role: true },
      },
      _count: {
        select: {
          targets: true,
          messages: { where: { isCrisis: true } },
        },
      },
    };

    const [ownedSessions, directedTargets] = await Promise.all([
      prisma.chatSession.findMany({
        where: { userId: payload.userId },
        orderBy: { updatedAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: sessionSelect,
      }),
      // Sessions where current user is a target
      prisma.chatSessionTarget.findMany({
        where: { userId: payload.userId },
        select: {
          session: {
            select: sessionSelect,
          },
        },
      }),
    ]);

    // Merge and deduplicate (owned sessions take priority)
    const ownedIds = new Set(ownedSessions.map((s) => s.id));
    const directedSessionIds = new Set<string>();
    const directedSessions = directedTargets
      .map((t) => t.session)
      .filter((s) => {
        if (ownedIds.has(s.id)) return false;
        // モデレーション非公開化されたセッションは指名先に表示しない
        if (s.consultType === "PRIVATE" && (s._count?.messages ?? 0) > 0) return false;
        directedSessionIds.add(s.id);
        return true;
      });

    const allSessions = [...ownedSessions, ...directedSessions]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Apply cursor-based pagination on merged result
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = allSessions.findIndex((s) => s.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginated = allSessions.slice(startIndex, startIndex + limit + 1);
    const hasMore = paginated.length > limit;
    const items: ChatSessionListItem[] = paginated
      .slice(0, limit)
      .map((s: PrismaSessionResult & { _count?: { targets: number; messages?: number }; userId?: string }) => {
        // Decrypt message content for preview (use session owner's key)
        const rawContent = s.messages[0]?.content;
        const ownerId = s.userId || payload.userId;
        const decryptedContent = rawContent
          ? decryptMessage(rawContent, ownerId)
          : null;
        return {
          id: s.id,
          title: s.title,
          preview: decryptedContent?.slice(0, 50) || null,
          consultType: s.consultType,
          isAnonymous: s.isAnonymous,
          targetCount: s._count?.targets ?? 0,
          isReceived: directedSessionIds.has(s.id),
          isCrisisPrivatized: (s._count?.messages ?? 0) > 0,
          updatedAt: s.updatedAt,
        };
      });

    const response: ChatSessionsResponse = {
      sessions: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Get chat sessions error", { userId: payload.userId }, error);
    return ErrorResponses.internalError();
  }
}

// POST /api/chat/sessions - Create new chat session
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;
  const { payload } = authResult;

  // レート制限チェック
  const rateLimitKey = `chat-create:${payload.userId}`;
  if (checkRateLimit(rateLimitKey, RateLimits.CHAT_CREATE)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  try {
    // リクエストボディをパース（空の場合はデフォルト値を使用）
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // バリデーション
    const validation = validateBody(createChatSessionSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { consultType, isAnonymous, allowAnonymousResponses, category, targetUserHandles, initialMessage } = validation.data;

    // DIRECTED: 指名先ユーザーを検索
    let targetUserIds: string[] = [];
    if (consultType === "DIRECTED" && targetUserHandles && targetUserHandles.length > 0) {
      const targetUsers = await prisma.user.findMany({
        where: { handle: { in: targetUserHandles } },
        select: { id: true, handle: true },
      });

      if (targetUsers.length === 0) {
        return NextResponse.json(
          { error: "指名先のユーザーが見つかりません" },
          { status: 400 }
        );
      }

      // 自分自身を除外 + 重複排除
      targetUserIds = [...new Set(
        targetUsers
          .filter((u) => u.id !== payload.userId)
          .map((u) => u.id)
      )];

      if (targetUserIds.length === 0) {
        return NextResponse.json(
          { error: "自分以外のユーザーを指名してください" },
          { status: 400 }
        );
      }

      // ブロックチェック: targetが自分をブロックしていないか確認
      const blocks = await prisma.userBlock.findMany({
        where: {
          blockerId: { in: targetUserIds },
          blockedId: payload.userId,
        },
        select: { blockerId: true },
      });
      if (blocks.length > 0) {
        // ブロックしているユーザーを除外
        const blockedByIds = new Set(blocks.map((b) => b.blockerId));
        targetUserIds = targetUserIds.filter((id) => !blockedByIds.has(id));
        if (targetUserIds.length === 0) {
          return NextResponse.json(
            { error: "指名先のユーザーに相談を送れません" },
            { status: 400 }
          );
        }
      }

      // オプトアウトチェック: 指名相談を受け付けないユーザーを除外
      const optedOutProfiles = await prisma.profile.findMany({
        where: {
          userId: { in: targetUserIds },
          allowDirectedConsult: false,
        },
        select: { userId: true },
      });
      if (optedOutProfiles.length > 0) {
        const optedOutIds = new Set(optedOutProfiles.map((p) => p.userId));
        targetUserIds = targetUserIds.filter((id) => !optedOutIds.has(id));
        if (targetUserIds.length === 0) {
          return NextResponse.json(
            { error: "指名先のユーザーは指名相談を受け付けていません" },
            { status: 400 }
          );
        }
      }

    }

    const session = await prisma.chatSession.create({
      data: {
        userId: payload.userId,
        consultType,
        isAnonymous,
        allowAnonymousResponses,
        category,
        ...(consultType === "DIRECTED" && targetUserIds.length > 0 && {
          targets: {
            create: targetUserIds.map((uid) => ({ userId: uid })),
          },
        }),
      },
      select: {
        id: true,
        title: true,
        consultType: true,
        isAnonymous: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { targets: true } },
      },
    });

    // If initialMessage is provided, send it immediately
    if (initialMessage && initialMessage.trim()) {
      try {
        // Check wallet balance
        const consultCost = consultType === "PUBLIC"
          ? TOKEN_ECONOMY.PUBLIC_CONSULT_COST
          : consultType === "DIRECTED"
            ? TOKEN_ECONOMY.DIRECTED_CONSULT_COST
            : TOKEN_ECONOMY.PRIVATE_CONSULT_COST;

        const wallet = await prisma.wallet.findUnique({ where: { userId: payload.userId } });
        if (!wallet || wallet.balance < consultCost) {
          // Delete the session if wallet is insufficient
          await prisma.chatSession.delete({ where: { id: session.id } });
          return NextResponse.json(
            { error: "YAMIが足りません。明日のBI付与をお待ちください。" },
            { status: 400 }
          );
        }

        // Generate title for first message
        const generatedTitle = await yamiiClient.generateTitle(initialMessage.trim());

        // Moderation check for PUBLIC/DIRECTED
        let moderationCrisis = false;
        if (consultType === "PUBLIC" || consultType === "DIRECTED") {
          try {
            const moderationResult = await yamiiClient.sendCounselingMessage(
              initialMessage.trim(), payload.userId, { sessionId: session.id }
            );
            moderationCrisis = moderationResult.is_crisis;
          } catch {
            moderationCrisis = checkCrisisKeywords(initialMessage.trim());
          }
        }

        // 3-strike system: increment crisisCount, only privatize on 3rd detection
        let shouldHide = false;
        if (moderationCrisis && (consultType === "PUBLIC" || consultType === "DIRECTED")) {
          const updatedSession = await prisma.chatSession.update({
            where: { id: session.id },
            data: { crisisCount: { increment: 1 } },
          });
          shouldHide = updatedSession.crisisCount >= 3;
        }

        // Save user message and deduct cost
        const now = new Date();
        await prisma.$transaction(async (tx) => {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: consultCost } },
          });
          await tx.transaction.create({
            data: { senderId: wallet.id, amount: -consultCost, txType: "CONSULT_HUMAN" },
          });

          const encryptedContent = encryptMessage(initialMessage.trim(), payload.userId);
          await tx.chatMessage.create({
            data: {
              sessionId: session.id,
              role: "USER",
              content: encryptedContent,
              isCrisis: moderationCrisis,
              isHidden: shouldHide
            },
          });

          const sessionUpdate: Record<string, unknown> = { updatedAt: now };
          if (generatedTitle) sessionUpdate.title = generatedTitle;
          if (shouldHide) {
            sessionUpdate.consultType = "PRIVATE";
          }
          await tx.chatSession.update({ where: { id: session.id }, data: sessionUpdate });
        });

        // Notify targets if DIRECTED and not hidden
        if (!shouldHide && consultType === "DIRECTED" && targetUserIds.length > 0) {
          await notifyDirectedRequest(targetUserIds, payload.sub, session.id, isAnonymous);
        }

        // Delete notifications if privatized
        if (shouldHide) {
          await prisma.notification.deleteMany({
            where: { linkUrl: { contains: `/main/chat/${session.id}` }, userId: { not: payload.userId } },
          });
        }

        // Return session with updated title
        return NextResponse.json(
          {
            ...session,
            targetCount: session._count.targets,
            title: generatedTitle || session.title,
            consultType: shouldHide ? "PRIVATE" : session.consultType,
            initialMessageSent: true,
          },
          { status: 201 }
        );
      } catch (error) {
        logger.error("Send initial message error", { sessionId: session.id, userId: payload.userId }, error);
        // Return session even if message sending failed
        return NextResponse.json(
          { ...session, targetCount: session._count.targets, initialMessageSent: false },
          { status: 201 }
        );
      }
    }

    return NextResponse.json(
      { ...session, targetCount: session._count.targets },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Create chat session error", { userId: payload.userId }, error);
    return ErrorResponses.internalError();
  }
}

// DELETE /api/chat/sessions?type=private - Delete all sessions (or only private sessions)
export async function DELETE(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;
  const { payload } = authResult;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "private" or "all"

  try {
    const whereClause: { userId: string; consultType?: "PRIVATE" } = {
      userId: payload.userId,
    };

    if (type === "private") {
      whereClause.consultType = "PRIVATE";
    }

    const result = await prisma.chatSession.deleteMany({
      where: whereClause,
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count
    });
  } catch (error) {
    logger.error("Delete chat sessions error", { userId: payload.userId }, error);
    return ErrorResponses.internalError();
  }
}
