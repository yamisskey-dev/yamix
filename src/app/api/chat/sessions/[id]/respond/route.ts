import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { TOKEN_ECONOMY } from "@/types";

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
      // Get the session
      const session = await db.chatSession.findUnique({
        where: { id },
        include: { user: true },
      });

      // Check session exists AND is public (combined check prevents enumeration)
      if (!session || session.consultType !== "PUBLIC") {
        return NextResponse.json(
          { error: "Session not found or not public" },
          { status: 404 }
        );
      }

      // Cannot respond to own session
      if (session.userId === payload.userId) {
        return NextResponse.json(
          { error: "自分の相談には回答できません" },
          { status: 400 }
        );
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

      const messageId = crypto.randomUUID();
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
