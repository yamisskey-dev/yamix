import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { authenticateRequest, parseJsonBody, ErrorResponses } from "@/lib/api-helpers";
import { yamiiClient } from "@/lib/yamii-client";
import { TOKEN_ECONOMY } from "@/types";
import type { ConversationMessage } from "@/types";
import { notifyResponse } from "@/lib/notifications";
import { encryptMessage, decryptMessage } from "@/lib/encryption";

import { checkCrisisKeywords } from "@/lib/crisis";
import { QUERY_LIMITS, PrismaMessage, hasMentionYamii, removeMentionYamii } from "@/lib/constants";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/chat/sessions/[id]/respond - Submit a human response to a public consultation
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;
  const { payload } = authResult;

  const { id } = await params;

  const bodyResult = await parseJsonBody<{ content: string; isAnonymous?: boolean }>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

  if (!body.content || body.content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const isAnonymous = body.isAnonymous ?? false;

  try {
    // Get the session with messages for conversation history
    const sessionWithMessages = await prisma.chatSession.findUnique({
      where: { id },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: "asc" },
          take: QUERY_LIMITS.RECENT_MESSAGES,
        },
      },
    });

    // Check session exists AND is public or directed (combined check prevents enumeration)
    if (!sessionWithMessages || (sessionWithMessages.consultType !== "PUBLIC" && sessionWithMessages.consultType !== "DIRECTED")) {
      return NextResponse.json(
        { error: "Session not found or not accessible" },
        { status: 404 }
      );
    }

    // DIRECTED: check if responder is a target
    if (sessionWithMessages.consultType === "DIRECTED") {
      const isTarget = await prisma.chatSessionTarget.findUnique({
        where: {
          sessionId_userId: {
            sessionId: id,
            userId: payload.userId,
          },
        },
      });

      if (!isTarget) {
        return NextResponse.json(
          { error: "この相談には回答できません" },
          { status: 403 }
        );
      }
    }

    // Cannot respond to own session
    if (sessionWithMessages.userId === payload.userId) {
      return NextResponse.json(
        { error: "自分の相談には回答できません" },
        { status: 400 }
      );
    }

    // Check if responder is blocked by session owner
    const isBlocked = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: sessionWithMessages.userId,
          blockedId: payload.userId,
        },
      },
    });

    if (isBlocked) {
      return NextResponse.json(
        { error: "この相談には回答できません" },
        { status: 403 }
      );
    }

    // Check if anonymous responses are allowed (if responding anonymously)
    if (isAnonymous && !sessionWithMessages.allowAnonymousResponses) {
      return NextResponse.json(
        { error: "この相談は匿名回答を受け付けていません" },
        { status: 403 }
      );
    }

    // Check if user is mentioning @yamii to call AI
    const hasYamiiMention = hasMentionYamii(body.content);

    // If @yamii is mentioned, call AI instead of saving human response
    if (hasYamiiMention) {
      // Prepare conversation history (decrypt messages for Yamii)
      const existingMessages: ConversationMessage[] = sessionWithMessages.messages.map((m: PrismaMessage) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: decryptMessage(m.content, sessionWithMessages.userId),
      })) as ConversationMessage[];

      // Remove @yamii mention before sending to Yamii
      const messageForYamii = removeMentionYamii(body.content);

      let yamiiResponse;
      try {
        yamiiResponse = await yamiiClient.sendCounselingMessage(
          messageForYamii,
          payload.userId,
          {
            sessionId: id,
            conversationHistory: existingMessages,
          }
        );
      } catch (error) {
        logger.error("Yamii API error in respond", { sessionId: id }, error);
        return NextResponse.json(
          { error: "AIサーバーに接続できません。しばらくしてからもう一度お試しください。" },
          { status: 503 }
        );
      }

      // Save both user's message and AI response in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Encrypt messages for storage
        const encryptedUserContent = encryptMessage(body.content.trim(), sessionWithMessages.userId);
        const encryptedAiContent = encryptMessage(yamiiResponse.response, sessionWithMessages.userId);

        // Save user's message with @yamii mention (with responderId to track who asked)
        const userMessage = await tx.chatMessage.create({
          data: {
            sessionId: id,
            role: "USER",
            content: encryptedUserContent,
            responderId: payload.userId, // Track who asked this question
            isAnonymous,
            isCrisis: false,
          },
        });

        // Save AI response (no responderId = AI response)
        const aiMessage = await tx.chatMessage.create({
          data: {
            sessionId: id,
            role: "ASSISTANT",
            content: encryptedAiContent,
            responderId: null, // AI response
            isAnonymous: false, // AI is never anonymous
            isCrisis: yamiiResponse.is_crisis,
          },
        });

        // Update session timestamp
        await tx.chatSession.update({
          where: { id },
          data: { updatedAt: new Date() },
        });

        return { userMessage, aiMessage };
      });

      // Return decrypted content to client
      return NextResponse.json({
        userMessage: { ...result.userMessage, content: body.content.trim() },
        message: { ...result.aiMessage, content: yamiiResponse.response },
        success: true,
        isAIResponse: true,
        isCrisis: yamiiResponse.is_crisis,
      });
    }

    // Crisis moderation for responder messages
    let moderationCrisis = false;
    try {
      const moderationResult = await yamiiClient.sendCounselingMessage(
        body.content.trim(),
        payload.userId,
        { sessionId: id }
      );
      moderationCrisis = moderationResult.is_crisis;
    } catch {
      // Moderation failure is non-blocking; fall back to keyword check
      moderationCrisis = checkCrisisKeywords(body.content.trim());
    }

    // 3-strike system: increment crisisCount, only privatize on 3rd detection
    const isPublicType = sessionWithMessages.consultType === "PUBLIC" || sessionWithMessages.consultType === "DIRECTED";
    let shouldHide = false;
    if (moderationCrisis && isPublicType) {
      const updatedSession = await prisma.chatSession.update({
        where: { id },
        data: { crisisCount: { increment: 1 } },
      });
      shouldHide = updatedSession.crisisCount >= 3;
    }

    // Get responder wallet and check balance for response cost
    const responderWallet = await prisma.wallet.findUnique({
      where: { userId: payload.userId },
    });

    if (!responderWallet) {
      return NextResponse.json(
        { error: "ウォレットが見つかりません" },
        { status: 400 }
      );
    }

    // Check if responder has enough balance to pay response cost
    const responseCost = TOKEN_ECONOMY.RESPONSE_COST;
    if (responderWallet.balance < responseCost) {
      return NextResponse.json(
        { error: `回答するには ${responseCost} YAMI 必要です。現在の残高: ${responderWallet.balance} YAMI` },
        { status: 400 }
      );
    }

    // Execute all operations in a transaction
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Deduct response cost
      await tx.wallet.update({
        where: { id: responderWallet.id },
        data: { balance: { decrement: responseCost } },
      });

      // 2. Create cost transaction record
      await tx.transaction.create({
        data: {
          senderId: responderWallet.id,
          amount: -responseCost,
          txType: "RESPONSE_COST",
        },
      });

      // 3. Create the human response message (encrypted)
      const encryptedContent = encryptMessage(body.content.trim(), sessionWithMessages.userId);
      const message = await tx.chatMessage.create({
        data: {
          sessionId: id,
          role: "ASSISTANT",
          content: encryptedContent,
          responderId: payload.userId,
          isAnonymous,
          isCrisis: moderationCrisis,
          isHidden: shouldHide,
        },
      });

      // 4. Update session timestamp (and auto-privatize if crisis)
      const sessionUpdate: Record<string, unknown> = { updatedAt: new Date() };
      if (shouldHide) {
        sessionUpdate.consultType = "PRIVATE";
        sessionUpdate.isPublic = false;
      }
      await tx.chatSession.update({
        where: { id },
        data: sessionUpdate,
      });

      // Crisis非公開化時: 非オーナーへの通知を削除（サイドバーからも消えるため導線を断つ）
      if (shouldHide) {
        await tx.notification.deleteMany({
          where: {
            linkUrl: { contains: `/main/chat/${id}` },
            userId: { not: sessionWithMessages.userId },
          },
        });
      }

      // 5. Calculate today's reward total
      const todayRewards = await tx.transaction.findMany({
        where: {
          senderId: responderWallet.id,
          txType: "RESPONSE_REWARD",
          createdAt: { gte: today },
        },
      });

      const todayRewardTotal = todayRewards.reduce((sum, tx) => sum + tx.amount, 0);

      // 6. Check if daily reward cap is reached
      const rewardAmount = TOKEN_ECONOMY.RESPONSE_REWARD;
      const canReceiveReward = todayRewardTotal + rewardAmount <= TOKEN_ECONOMY.DAILY_REWARD_CAP;

      let actualReward = 0;
      if (canReceiveReward) {
        // Grant reward
        await tx.wallet.update({
          where: { id: responderWallet.id },
          data: { balance: { increment: rewardAmount } },
        });

        // Create reward transaction record
        await tx.transaction.create({
          data: {
            senderId: responderWallet.id,
            amount: rewardAmount,
            txType: "RESPONSE_REWARD",
          },
        });

        actualReward = rewardAmount;
      }

      return {
        message,
        actualReward,
        rewardCapped: !canReceiveReward,
        capRemaining: Math.max(0, TOKEN_ECONOMY.DAILY_REWARD_CAP - todayRewardTotal),
        netGain: actualReward - responseCost,
      };
    });

    // 通知を送信（相談者が回答者と異なる場合のみ）
    if (sessionWithMessages.userId !== payload.userId) {
      await notifyResponse(
        sessionWithMessages.userId,
        payload.sub, // handle
        id,
        isAnonymous
      );
    }

    // Return decrypted content to client
    return NextResponse.json({
      message: { ...result.message, content: body.content.trim() },
      success: true,
      cost: responseCost,
      reward: result.actualReward,
      netGain: result.netGain,
      rewardCapped: result.rewardCapped,
      capRemaining: result.capRemaining,
      isCrisis: moderationCrisis,
      sessionPrivatized: shouldHide,
    });
  } catch (error) {
    logger.error("Human response error", { sessionId: id }, error);
    return ErrorResponses.internalError();
  }
}
