import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB, generateId } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { yamiiClient } from "@/lib/yamii-client";
import { TOKEN_ECONOMY } from "@/types";
import type { ConversationMessage } from "@/types";

// In-memory types
interface MemoryChatSession {
  id: string;
  userId: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC";
  isAnonymous: boolean;
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

  let body: { content: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.content || body.content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

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

      // Check session exists AND is public (combined check prevents enumeration)
      if (!sessionWithMessages || sessionWithMessages.consultType !== "PUBLIC") {
        return NextResponse.json(
          { error: "Session not found or not public" },
          { status: 404 }
        );
      }

      // Cannot respond to own session
      if (sessionWithMessages.userId === payload.userId) {
        return NextResponse.json(
          { error: "自分の相談には回答できません" },
          { status: 400 }
        );
      }

      // Check if user is mentioning @yamii to call AI
      const hasYamiiMention = hasMentionYamii(body.content);

      // If @yamii is mentioned, call AI instead of saving human response
      if (hasYamiiMention) {
        // Prepare conversation history
        const existingMessages: ConversationMessage[] = sessionWithMessages.messages.map((m: PrismaMessage) => ({
          role: m.role === "USER" ? "user" : "assistant",
          content: m.content,
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
          // Save user's message with @yamii mention (with responderId to track who asked)
          const userMessage = await tx.chatMessage.create({
            data: {
              sessionId: id,
              role: "USER",
              content: body.content.trim(),
              responderId: payload.userId, // Track who asked this question
              isCrisis: false,
            },
          });

          // Save AI response (no responderId = AI response)
          const aiMessage = await tx.chatMessage.create({
            data: {
              sessionId: id,
              role: "ASSISTANT",
              content: yamiiResponse.response,
              responderId: null, // AI response
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

        return NextResponse.json({
          userMessage: result.userMessage,
          message: result.aiMessage,
          success: true,
          isAIResponse: true,
          isCrisis: yamiiResponse.is_crisis,
        });
      }

      // Create the human response message
      const message = await db.chatMessage.create({
        data: {
          sessionId: id,
          role: "ASSISTANT",
          content: body.content.trim(),
          responderId: payload.userId,
          isCrisis: false,
        },
      });

      // Update session timestamp
      await db.chatSession.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      // Calculate today's reward total for this responder
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const responderWallet = await db.wallet.findUnique({
        where: { userId: payload.userId },
        include: {
          sentTransactions: {
            where: {
              txType: "RESPONSE_REWARD",
              createdAt: {
                gte: today,
              },
            },
          },
        },
      });

      if (!responderWallet) {
        return NextResponse.json({
          message,
          success: true,
          reward: 0,
          rewardCapped: false,
        });
      }

      // Calculate today's reward total (abs value since transactions are positive)
      const todayRewardTotal = responderWallet.sentTransactions.reduce(
        (sum, tx) => sum + tx.amount,
        0
      );

      // Check if daily reward cap is reached
      const rewardAmount = TOKEN_ECONOMY.RESPONSE_REWARD;
      const canReceiveReward = todayRewardTotal + rewardAmount <= TOKEN_ECONOMY.DAILY_REWARD_CAP;

      if (canReceiveReward) {
        // Grant reward
        await db.wallet.update({
          where: { id: responderWallet.id },
          data: { balance: { increment: rewardAmount } },
        });

        // Create transaction record
        await db.transaction.create({
          data: {
            senderId: responderWallet.id,
            amount: rewardAmount,
            txType: "RESPONSE_REWARD",
          },
        });

        return NextResponse.json({
          message,
          success: true,
          reward: rewardAmount,
          rewardCapped: false,
        });
      } else {
        // Cap reached - response saved but no reward
        return NextResponse.json({
          message,
          success: true,
          reward: 0,
          rewardCapped: true,
          capRemaining: Math.max(0, TOKEN_ECONOMY.DAILY_REWARD_CAP - todayRewardTotal),
        });
      }
    } else {
      // In-memory fallback
      const session = chatSessionsStore.get(id);

      // Check session exists AND is public (combined check prevents enumeration)
      if (!session || session.consultType !== "PUBLIC") {
        return NextResponse.json(
          { error: "Session not found or not public" },
          { status: 404 }
        );
      }

      if (session.userId === payload.userId) {
        return NextResponse.json(
          { error: "自分の相談には回答できません" },
          { status: 400 }
        );
      }

      // Check if user is mentioning @yamii to call AI
      const hasYamiiMention = hasMentionYamii(body.content);

      // If @yamii is mentioned, call AI instead of saving human response
      if (hasYamiiMention) {
        // Prepare conversation history
        const messages = Array.from(chatMessagesStore.values())
          .filter((m) => m.sessionId === id)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .slice(-10);

        const existingMessages: ConversationMessage[] = messages.map((m) => ({
          role: m.role === "USER" ? "user" : "assistant",
          content: m.content,
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

        // Save user's message with @yamii mention (with responderId to track who asked)
        const userMessageId = generateId();
        const userMessage: MemoryChatMessage = {
          id: userMessageId,
          sessionId: id,
          role: "USER",
          content: body.content.trim(),
          responderId: payload.userId, // Track who asked this question
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
          content: yamiiResponse.response,
          responderId: undefined, // AI response
          isCrisis: yamiiResponse.is_crisis,
          createdAt: new Date(now.getTime() + 1),
        };
        chatMessagesStore.set(aiMessageId, aiMessage);

        session.updatedAt = new Date();
        chatSessionsStore.set(id, session);

        return NextResponse.json({
          userMessage,
          message: aiMessage,
          success: true,
          isAIResponse: true,
          isCrisis: yamiiResponse.is_crisis,
        });
      }

      const messageId = generateId();
      const message: MemoryChatMessage = {
        id: messageId,
        sessionId: id,
        role: "ASSISTANT",
        content: body.content.trim(),
        responderId: payload.userId,
        isCrisis: false,
        createdAt: new Date(),
      };

      chatMessagesStore.set(messageId, message);
      session.updatedAt = new Date();
      chatSessionsStore.set(id, session);

      // Reward system for in-memory (simplified - no daily cap tracking)
      const responderWallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.userId === payload.userId
      );

      if (responderWallet) {
        const rewardAmount = TOKEN_ECONOMY.RESPONSE_REWARD;
        responderWallet.balance += rewardAmount;

        return NextResponse.json({
          message,
          success: true,
          reward: rewardAmount,
          rewardCapped: false,
        });
      }

      return NextResponse.json({
        message,
        success: true,
        reward: 0,
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
