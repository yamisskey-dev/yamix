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
  createdAt: Date;
}

// Prismaのメッセージ型
interface PrismaMessage {
  role: string;
  content: string;
}

// Access memory stores from memoryDB
const chatSessionsStore = memoryDB.chatSessions as Map<string, MemoryChatSession>;
const chatMessagesStore = memoryDB.chatMessages as Map<string, MemoryChatMessage>;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Generate title from first message
function generateTitle(message: string): string {
  const firstSentence = message.match(/^[^。！？.!?\n]+[。！？.!?]?/);
  const title = firstSentence?.[0] || message;
  return title.slice(0, 50) + (title.length > 50 ? "..." : "");
}

// Check if message starts with @yamii mention
function hasMentionYamii(message: string): boolean {
  return /^@yamii(\s|$)/i.test(message.trim());
}

// Remove @yamii mention from message
function removeMentionYamii(message: string): string {
  return message.trim().replace(/^@yamii\s*/i, "");
}

// POST /api/chat/sessions/[id]/messages - Send message and get AI response
export async function POST(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  let body: { message: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const userMessage = body.message.trim();

  try {
    const db = getPrismaClient();

    // Verify session ownership
    let session;
    let existingMessages: ConversationMessage[] = [];
    let isFirstMessage = false;

    if (db) {
      const sessionWithMessages = await db.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 10,
          },
        },
      });

      if (!sessionWithMessages) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (sessionWithMessages.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      session = sessionWithMessages;
      isFirstMessage = sessionWithMessages.messages.length === 0;
      existingMessages = sessionWithMessages.messages.map((m: PrismaMessage) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: m.content,
      })) as ConversationMessage[];
    } else {
      // In-memory fallback
      session = chatSessionsStore.get(sessionId);

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const messages = Array.from(chatMessagesStore.values())
        .filter((m) => m.sessionId === sessionId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-10);

      isFirstMessage = messages.length === 0;
      existingMessages = messages.map((m) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: m.content,
      })) as ConversationMessage[];
    }

    // Determine consult cost based on consultType
    const consultCost = session.consultType === "PUBLIC"
      ? TOKEN_ECONOMY.PUBLIC_CONSULT_COST
      : TOKEN_ECONOMY.PRIVATE_CONSULT_COST;

    if (db) {
      const wallet = await db.wallet.findUnique({
        where: { userId: payload.userId },
      });

      if (!wallet) {
        return NextResponse.json({ error: "ウォレットが見つかりません" }, { status: 400 });
      }

      if (wallet.balance < consultCost) {
        return NextResponse.json(
          { error: "YAMIが足りません。明日のBI付与をお待ちください。" },
          { status: 400 }
        );
      }
    } else {
      const wallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.userId === payload.userId
      );

      if (!wallet) {
        return NextResponse.json({ error: "ウォレットが見つかりません" }, { status: 400 });
      }

      if (wallet.balance < consultCost) {
        return NextResponse.json(
          { error: "YAMIが足りません。明日のBI付与をお待ちください。" },
          { status: 400 }
        );
      }
    }

    // Determine if we should call Yamii API
    // - PRIVATE consultations: Always call
    // - PUBLIC consultations: Only if message starts with @yamii
    const hasYamiiMention = hasMentionYamii(userMessage);
    const shouldCallYamii =
      session.consultType === "PRIVATE" ||
      (session.consultType === "PUBLIC" && hasYamiiMention);

    let yamiiResponse = null;
    if (shouldCallYamii) {
      try {
        // Remove @yamii mention before sending to Yamii (keep it in stored message)
        const messageForYamii = hasMentionYamii(userMessage)
          ? removeMentionYamii(userMessage)
          : userMessage;

        yamiiResponse = await yamiiClient.sendCounselingMessage(
          messageForYamii,
          payload.userId,
          {
            sessionId: sessionId,
            conversationHistory: existingMessages,
          }
        );
      } catch (error) {
        logger.error("Yamii API error", { sessionId }, error);
        return NextResponse.json(
          { error: "AIサーバーに接続できません。しばらくしてからもう一度お試しください。" },
          { status: 503 }
        );
      }
    }

    // Save messages to database
    const now = new Date();

    if (db) {
      // Execute all operations in a transaction
      const result = await db.$transaction(async (tx) => {
        // Get wallet and deduct cost
        const wallet = await tx.wallet.findUnique({
          where: { userId: payload.userId },
        });

        if (!wallet) {
          throw new Error("Wallet not found");
        }

        // Deduct consult cost
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: consultCost } },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            senderId: wallet.id,
            amount: -consultCost,
            txType: shouldCallYamii ? "CONSULT_AI" : "CONSULT_HUMAN",
          },
        });

        // Create user message
        const userMsg = await tx.chatMessage.create({
          data: {
            sessionId,
            role: "USER",
            content: userMessage,
            isCrisis: false,
          },
        });

        // Create assistant message if we got a response from Yamii
        let assistantMsg = null;
        if (shouldCallYamii && yamiiResponse) {
          assistantMsg = await tx.chatMessage.create({
            data: {
              sessionId,
              role: "ASSISTANT",
              content: yamiiResponse.response,
              isCrisis: yamiiResponse.is_crisis,
            },
          });
        }

        // Update session title if first message
        if (isFirstMessage) {
          await tx.chatSession.update({
            where: { id: sessionId },
            data: {
              title: generateTitle(userMessage),
              updatedAt: now,
            },
          });
        } else {
          await tx.chatSession.update({
            where: { id: sessionId },
            data: { updatedAt: now },
          });
        }

        return { userMsg, assistantMsg };
      });

      return NextResponse.json({
        userMessage: result.userMsg,
        assistantMessage: result.assistantMsg,
        response: yamiiResponse?.response || null,
        isCrisis: yamiiResponse?.is_crisis || false,
        sessionTitle: isFirstMessage ? generateTitle(userMessage) : null,
      });
    } else {
      // In-memory fallback
      const wallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.userId === payload.userId
      );

      if (!wallet) {
        return NextResponse.json({ error: "ウォレットが見つかりません" }, { status: 400 });
      }

      // Deduct consult cost
      wallet.balance -= consultCost;

      const userMsg = {
        id: generateId(),
        sessionId,
        role: "USER" as const,
        content: userMessage,
        isCrisis: false,
        createdAt: now,
      };
      chatMessagesStore.set(userMsg.id, userMsg);

      // Create assistant message if we got a response from Yamii
      let assistantMsg = null;
      if (shouldCallYamii && yamiiResponse) {
        assistantMsg = {
          id: generateId(),
          sessionId,
          role: "ASSISTANT" as const,
          content: yamiiResponse.response,
          isCrisis: yamiiResponse.is_crisis,
          createdAt: new Date(now.getTime() + 1),
        };
        chatMessagesStore.set(assistantMsg.id, assistantMsg);
      }

      // Update session
      const sessionData = chatSessionsStore.get(sessionId)!;
      if (isFirstMessage) {
        sessionData.title = generateTitle(userMessage);
      }
      sessionData.updatedAt = now;
      chatSessionsStore.set(sessionId, sessionData);

      return NextResponse.json({
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        response: yamiiResponse?.response || null,
        isCrisis: yamiiResponse?.is_crisis || false,
        sessionTitle: isFirstMessage ? generateTitle(userMessage) : null,
      });
    }
  } catch (error) {
    logger.error("Send message error", { sessionId }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
