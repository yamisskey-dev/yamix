import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB, generateId } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { yamiiClient } from "@/lib/yamii-client";
import { TOKEN_ECONOMY } from "@/types";
import type { ConversationMessage } from "@/types";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { sendMessageSchema, validateBody } from "@/lib/validation";
import { encryptMessage, decryptMessage } from "@/lib/encryption";
import { notifyDirectedRequest } from "@/lib/notifications";

// In-memory types
interface MemoryChatSession {
  id: string;
  userId: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
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

// Simple crisis keyword check for messages without AI response
const CRISIS_KEYWORDS = [
  "死にたい", "死のう", "自殺", "殺して", "消えたい",
  "生きていたくない", "もう終わり", "飛び降り", "首を吊",
  "リストカット", "ODした", "薬を大量",
];
function checkCrisisKeywords(message: string): boolean {
  const lower = message.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
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

  // レート制限チェック
  const rateLimitKey = `message:${payload.userId}`;
  if (checkRateLimit(rateLimitKey, RateLimits.MESSAGE_SEND)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down." },
      { status: 429 }
    );
  }

  const { id: sessionId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // バリデーション
  const validation = validateBody(sendMessageSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const userMessage = validation.data.message.trim();

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
      // Decrypt existing messages for conversation history (backwards compatible)
      existingMessages = sessionWithMessages.messages.map((m: PrismaMessage) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: decryptMessage(m.content, payload.userId),
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
      // Decrypt existing messages for conversation history (backwards compatible)
      existingMessages = messages.map((m) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: decryptMessage(m.content, payload.userId),
      })) as ConversationMessage[];
    }

    // Determine consult cost based on consultType
    const consultCost = session.consultType === "PUBLIC"
      ? TOKEN_ECONOMY.PUBLIC_CONSULT_COST
      : session.consultType === "DIRECTED"
        ? TOKEN_ECONOMY.DIRECTED_CONSULT_COST
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
    // PRIVATE: always call AI, PUBLIC/DIRECTED: only if @yamii mentioned
    const shouldCallYamii =
      session.consultType === "PRIVATE" ||
      ((session.consultType === "PUBLIC" || session.consultType === "DIRECTED") && hasYamiiMention);

    let yamiiResponse = null;
    // For PUBLIC/DIRECTED without @yamii mention, run moderation-only check
    let moderationCrisis = false;
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
    } else if (session.consultType === "PUBLIC" || session.consultType === "DIRECTED") {
      // Auto-moderation: check for crisis content via Yamii without generating a visible response
      try {
        const moderationResult = await yamiiClient.sendCounselingMessage(
          userMessage,
          payload.userId,
          { sessionId }
        );
        moderationCrisis = moderationResult.is_crisis;
      } catch {
        // Moderation failure is non-blocking; fall back to keyword check
        moderationCrisis = checkCrisisKeywords(userMessage);
      }
    }

    // Generate AI title for first message
    let generatedTitle: string | null = null;
    if (isFirstMessage) {
      generatedTitle = await yamiiClient.generateTitle(userMessage);
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

        // Determine if any crisis was detected (moderation or AI response)
        const anyCrisis = moderationCrisis || (yamiiResponse?.is_crisis ?? false);
        // Hide message from non-owners if crisis detected in PUBLIC/DIRECTED
        const shouldHide = anyCrisis && (session.consultType === "PUBLIC" || session.consultType === "DIRECTED");

        // Create user message (encrypt content for privacy)
        const encryptedUserContent = encryptMessage(userMessage, payload.userId);
        const userMsg = await tx.chatMessage.create({
          data: {
            sessionId,
            role: "USER",
            content: encryptedUserContent,
            isCrisis: anyCrisis,
            isHidden: shouldHide,
          },
        });

        // Create assistant message if we got a response from Yamii
        let assistantMsg = null;
        if (shouldCallYamii && yamiiResponse) {
          const encryptedAssistantContent = encryptMessage(yamiiResponse.response, payload.userId);
          assistantMsg = await tx.chatMessage.create({
            data: {
              sessionId,
              role: "ASSISTANT",
              content: encryptedAssistantContent,
              isCrisis: yamiiResponse.is_crisis,
              isHidden: shouldHide,
            },
          });
        }

        // Update session title if first message
        // If crisis detected in PUBLIC/DIRECTED, auto-switch to PRIVATE
        const sessionUpdate: Record<string, unknown> = { updatedAt: now };
        if (isFirstMessage) {
          sessionUpdate.title = generatedTitle!;
        }
        if (shouldHide) {
          sessionUpdate.consultType = "PRIVATE";
          sessionUpdate.isPublic = false;
        }
        await tx.chatSession.update({
          where: { id: sessionId },
          data: sessionUpdate,
        });

        return { userMsg, assistantMsg, shouldHide };
      });

      // Notify directed targets on first message (skip if crisis-privatized)
      if (isFirstMessage && session.consultType === "DIRECTED" && db && !result.shouldHide) {
        const targets = await db.chatSessionTarget.findMany({
          where: { sessionId },
          select: { userId: true },
        });
        if (targets.length > 0) {
          await notifyDirectedRequest(
            targets.map((t) => t.userId),
            payload.sub, // handle
            sessionId,
            session.isAnonymous
          );
        }
      }

      // Crisis非公開化時: 非オーナーへの通知を削除
      if (result.shouldHide && db) {
        await db.notification.deleteMany({
          where: {
            linkUrl: { contains: `/main/chat/${sessionId}` },
            userId: { not: payload.userId },
          },
        });
      }

      // Return decrypted content to client
      return NextResponse.json({
        userMessage: { ...result.userMsg, content: userMessage },
        assistantMessage: result.assistantMsg
          ? { ...result.assistantMsg, content: yamiiResponse?.response || "" }
          : null,
        response: yamiiResponse?.response || null,
        isCrisis: yamiiResponse?.is_crisis || moderationCrisis,
        sessionTitle: generatedTitle,
        sessionPrivatized: result.shouldHide || false,
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

      // Determine crisis flags
      const anyCrisis = moderationCrisis || (yamiiResponse?.is_crisis ?? false);
      const shouldHide = anyCrisis && (session.consultType === "PUBLIC" || session.consultType === "DIRECTED");

      // Encrypt messages for privacy
      const encryptedUserContent = encryptMessage(userMessage, payload.userId);
      const userMsg = {
        id: generateId(),
        sessionId,
        role: "USER" as const,
        content: encryptedUserContent,
        isCrisis: anyCrisis,
        createdAt: now,
      };
      chatMessagesStore.set(userMsg.id, userMsg);

      // Create assistant message if we got a response from Yamii
      let assistantMsg = null;
      if (shouldCallYamii && yamiiResponse) {
        const encryptedAssistantContent = encryptMessage(yamiiResponse.response, payload.userId);
        assistantMsg = {
          id: generateId(),
          sessionId,
          role: "ASSISTANT" as const,
          content: encryptedAssistantContent,
          isCrisis: yamiiResponse.is_crisis,
          createdAt: new Date(now.getTime() + 1),
        };
        chatMessagesStore.set(assistantMsg.id, assistantMsg);
      }

      // Update session
      const sessionData = chatSessionsStore.get(sessionId)!;
      if (isFirstMessage) {
        sessionData.title = generatedTitle!;
      }
      if (shouldHide) {
        sessionData.consultType = "PRIVATE";
        sessionData.isPublic = false;
      }
      sessionData.updatedAt = now;
      chatSessionsStore.set(sessionId, sessionData);

      // Return decrypted content to client
      return NextResponse.json({
        userMessage: { ...userMsg, content: userMessage },
        assistantMessage: assistantMsg
          ? { ...assistantMsg, content: yamiiResponse?.response || "" }
          : null,
        response: yamiiResponse?.response || null,
        isCrisis: yamiiResponse?.is_crisis || moderationCrisis,
        sessionTitle: generatedTitle,
        sessionPrivatized: shouldHide,
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
