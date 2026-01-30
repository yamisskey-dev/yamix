import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB, generateId } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { yamiiClient } from "@/lib/yamii-client";
import { TOKEN_ECONOMY } from "@/types";
import type { ConversationMessage } from "@/types";
import { notifyResponse } from "@/lib/notifications";
import { encryptMessage, decryptMessage } from "@/lib/encryption";

// In-memory types
interface MemoryChatSession {
  id: string;
  userId: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
  isAnonymous: boolean;
  allowAnonymousResponses: boolean;
  category: string | null;
  isPublic: boolean; // DEPRECATED
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryChatMessage {
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  isCrisis: boolean;
  responderId?: string;
  isAnonymous: boolean;
  createdAt: Date;
}

// Access memory stores from memoryDB
const chatSessionsStore = memoryDB.chatSessions as Map<string, MemoryChatSession>;
const chatMessagesStore = memoryDB.chatMessages as Map<string, MemoryChatMessage>;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Prismaのメッセージ型
interface PrismaMessage {
  role: string;
  content: string;
}

// Check if message starts with @yamii mention
function hasMentionYamii(message: string): boolean {
  return /^@yamii(\s|$)/i.test(message.trim());
}

// Remove @yamii mention from message
function removeMentionYamii(message: string): string {
  return message.trim().replace(/^@yamii\s*/i, "");
}

// POST /api/chat/sessions/[id]/respond - Submit a human response to a public consultation
export async function POST(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id } = await params;

  let body: { content: string; isAnonymous?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.content || body.content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const isAnonymous = body.isAnonymous ?? false;

  try {
    const db = getPrismaClient();

    if (db) {
      // Get the session with messages for conversation history
      const sessionWithMessages = await db.chatSession.findUnique({
        where: { id },
        include: {
          user: true,
          messages: {
            orderBy: { createdAt: "asc" },
            take: 10,
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
        const isTarget = await db.chatSessionTarget.findUnique({
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
      const isBlocked = await db.userBlock.findUnique({
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
        const result = await db.$transaction(async (tx) => {
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

      // Get responder wallet and check balance for response cost
      const responderWallet = await db.wallet.findUnique({
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

      const result = await db.$transaction(async (tx) => {
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
            isCrisis: false,
          },
        });

        // 4. Update session timestamp
        await tx.chatSession.update({
          where: { id },
          data: { updatedAt: new Date() },
        });

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
      });
    } else {
      // In-memory fallback
      const session = chatSessionsStore.get(id);

      // Check session exists AND is public or directed (combined check prevents enumeration)
      if (!session || (session.consultType !== "PUBLIC" && session.consultType !== "DIRECTED")) {
        return NextResponse.json(
          { error: "Session not found or not accessible" },
          { status: 404 }
        );
      }

      if (session.userId === payload.userId) {
        return NextResponse.json(
          { error: "自分の相談には回答できません" },
          { status: 400 }
        );
      }

      // DIRECTED: in-memory target check (limited - no target store in memory)
      // In production this path is rarely used; deny non-PUBLIC/non-owner access for safety
      if (session.consultType === "DIRECTED") {
        return NextResponse.json(
          { error: "この相談には回答できません" },
          { status: 403 }
        );
      }

      // Check if responder is blocked by session owner
      const isBlocked = Array.from(memoryDB.userBlocks.values()).some(
        (block) => block.blockerId === session.userId && block.blockedId === payload.userId
      );

      if (isBlocked) {
        return NextResponse.json(
          { error: "この相談には回答できません" },
          { status: 403 }
        );
      }

      // Check if anonymous responses are allowed (if responding anonymously)
      if (isAnonymous && !session.allowAnonymousResponses) {
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
        const messages = Array.from(chatMessagesStore.values())
          .filter((m) => m.sessionId === id)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .slice(-10);

        const existingMessages: ConversationMessage[] = messages.map((m) => ({
          role: m.role === "USER" ? "user" : "assistant",
          content: decryptMessage(m.content, session.userId),
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
          logger.error("Yamii API error in respond (in-memory)", { sessionId: id }, error);
          return NextResponse.json(
            { error: "AIサーバーに接続できません。しばらくしてからもう一度お試しください。" },
            { status: 503 }
          );
        }

        const now = new Date();

        // Encrypt messages for storage
        const encryptedUserContent = encryptMessage(body.content.trim(), session.userId);
        const encryptedAiContent = encryptMessage(yamiiResponse.response, session.userId);

        // Save user's message with @yamii mention (with responderId to track who asked)
        const userMessageId = generateId();
        const userMessage: MemoryChatMessage = {
          id: userMessageId,
          sessionId: id,
          role: "USER",
          content: encryptedUserContent,
          responderId: payload.userId, // Track who asked this question
          isAnonymous,
          isCrisis: false,
          createdAt: now,
        };
        chatMessagesStore.set(userMessageId, userMessage);

        // Save AI response (no responderId = AI response)
        const aiMessageId = generateId();
        const aiMessage: MemoryChatMessage = {
          id: aiMessageId,
          sessionId: id,
          role: "ASSISTANT",
          content: encryptedAiContent,
          responderId: undefined, // AI response
          isAnonymous: false, // AI is never anonymous
          isCrisis: yamiiResponse.is_crisis,
          createdAt: new Date(now.getTime() + 1),
        };
        chatMessagesStore.set(aiMessageId, aiMessage);

        session.updatedAt = new Date();
        chatSessionsStore.set(id, session);

        // Return decrypted content to client
        return NextResponse.json({
          userMessage: { ...userMessage, content: body.content.trim() },
          message: { ...aiMessage, content: yamiiResponse.response },
          success: true,
          isAIResponse: true,
          isCrisis: yamiiResponse.is_crisis,
        });
      }

      // Get responder wallet and check balance for response cost
      const responderWallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.userId === payload.userId
      );

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

      // Deduct response cost
      responderWallet.balance -= responseCost;

      // Create the human response message (encrypted)
      const encryptedContent = encryptMessage(body.content.trim(), session.userId);
      const messageId = generateId();
      const message: MemoryChatMessage = {
        id: messageId,
        sessionId: id,
        role: "ASSISTANT",
        content: encryptedContent,
        responderId: payload.userId,
        isAnonymous,
        isCrisis: false,
        createdAt: new Date(),
      };

      chatMessagesStore.set(messageId, message);
      session.updatedAt = new Date();
      chatSessionsStore.set(id, session);

      // Grant reward (simplified - no daily cap tracking in memory mode)
      const rewardAmount = TOKEN_ECONOMY.RESPONSE_REWARD;
      responderWallet.balance += rewardAmount;

      const netGain = rewardAmount - responseCost;

      // Return decrypted content to client
      return NextResponse.json({
        message: { ...message, content: body.content.trim() },
        success: true,
        cost: responseCost,
        reward: rewardAmount,
        netGain,
        rewardCapped: false,
      });
    }
  } catch (error) {
    logger.error("Human response error", { sessionId: id }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
