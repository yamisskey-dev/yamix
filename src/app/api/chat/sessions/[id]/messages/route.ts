import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { yamiiClient } from "@/lib/yamii-client";
import { TOKEN_ECONOMY } from "@/types";
import type { ConversationMessage } from "@/types";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { sendMessageSchema, validateBody } from "@/lib/validation";
import { encryptMessage, decryptMessage } from "@/lib/encryption";
import { notifyDirectedRequest } from "@/lib/notifications";
import { checkCrisisKeywords } from "@/lib/crisis";
import type { JWTPayload } from "@/lib/jwt";

interface PrismaMessage {
  role: string;
  content: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface SessionData {
  id: string;
  userId: string;
  consultType: string;
  isAnonymous: boolean;
  isPublic: boolean;
  messages: PrismaMessage[];
}

// Check if message starts with @yamii mention
function hasMentionYamii(message: string): boolean {
  return /^@yamii(\s|$)/i.test(message.trim());
}

// Remove @yamii mention from message
function removeMentionYamii(message: string): string {
  return message.trim().replace(/^@yamii\s*/i, "");
}

// ============================================
// Shared: Save user message + deduct wallet
// ============================================
async function saveUserMessageAndDeduct(opts: {
  sessionId: string;
  userId: string;
  userMessage: string;
  consultCost: number;
  txType: "CONSULT_AI" | "CONSULT_HUMAN";
  isFirstMessage: boolean;
  generatedTitle: string | null;
  isCrisis: boolean;
  shouldHide: boolean;
}) {
  const { sessionId, userId, userMessage, consultCost, txType, isFirstMessage, generatedTitle, isCrisis, shouldHide } = opts;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: consultCost } },
    });
    await tx.transaction.create({
      data: { senderId: wallet.id, amount: -consultCost, txType },
    });

    const encryptedContent = encryptMessage(userMessage, userId);
    const userMsg = await tx.chatMessage.create({
      data: { sessionId, role: "USER", content: encryptedContent, isCrisis, isHidden: shouldHide },
    });

    const sessionUpdate: Record<string, unknown> = { updatedAt: now };
    if (isFirstMessage && generatedTitle) sessionUpdate.title = generatedTitle;
    if (shouldHide) { sessionUpdate.consultType = "PRIVATE"; sessionUpdate.isPublic = false; }
    await tx.chatSession.update({ where: { id: sessionId }, data: sessionUpdate });

    return { userMsgId: userMsg.id, userMsg };
  });
}

// ============================================
// Shared: Notify directed targets on first message
// ============================================
async function notifyTargetsIfNeeded(
  session: SessionData,
  sessionId: string,
  isFirstMessage: boolean,
  userHandle: string,
  shouldHide: boolean
) {
  if (!isFirstMessage || session.consultType !== "DIRECTED" || shouldHide) return;

  const targets = await prisma.chatSessionTarget.findMany({
    where: { sessionId },
    select: { userId: true },
  });
  if (targets.length > 0) {
    await notifyDirectedRequest(targets.map((t) => t.userId), userHandle, sessionId, session.isAnonymous);
  }
}

// ============================================
// Shared: Delete notifications on crisis privatization
// ============================================
async function deleteNotificationsOnPrivatize(sessionId: string, ownerId: string) {
  await prisma.notification.deleteMany({
    where: { linkUrl: { contains: `/main/chat/${sessionId}` }, userId: { not: ownerId } },
  });
}

// ============================================
// Streaming path: AI response via SSE
// ============================================
async function handleStreamingResponse(opts: {
  sessionId: string;
  userMessage: string;
  payload: JWTPayload;
  session: SessionData;
  existingMessages: ConversationMessage[];
  consultCost: number;
  isFirstMessage: boolean;
  generatedTitle: string | null;
}): Promise<Response> {
  const { sessionId, userMessage, payload, session, existingMessages, consultCost, isFirstMessage, generatedTitle } = opts;

  const messageForYamii = hasMentionYamii(userMessage)
    ? removeMentionYamii(userMessage)
    : userMessage;

  // Save user message and deduct cost
  const { userMsgId } = await saveUserMessageAndDeduct({
    sessionId,
    userId: payload.userId,
    userMessage,
    consultCost,
    txType: "CONSULT_AI",
    isFirstMessage,
    generatedTitle,
    isCrisis: false,
    shouldHide: false,
  });

  await notifyTargetsIfNeeded(session, sessionId, isFirstMessage, payload.sub, false);

  // Connect to Yamii SSE stream
  let yamiiStreamResponse: Response;
  try {
    yamiiStreamResponse = await yamiiClient.sendCounselingMessageStream(
      messageForYamii,
      payload.userId,
      { sessionId, conversationHistory: existingMessages }
    );
  } catch (error) {
    logger.error("Yamii API stream error", { sessionId }, error);
    return NextResponse.json(
      { error: "AIサーバーに接続できません。しばらくしてからもう一度お試しください。" },
      { status: 503 }
    );
  }

  const yamiiBody = yamiiStreamResponse.body;
  if (!yamiiBody) {
    return NextResponse.json({ error: "No stream body from Yamii" }, { status: 503 });
  }

  // Proxy SSE stream with post-stream DB saves
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      const initEvent = JSON.stringify({
        type: "init",
        userMessageId: userMsgId,
        sessionTitle: generatedTitle,
      });
      controller.enqueue(encoder.encode(`data: ${initEvent}\n\n`));

      const reader = yamiiBody.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const dataStr = trimmed.slice(6);
            try {
              const data = JSON.parse(dataStr);

              if (data.chunk) {
                fullResponse += data.chunk;
                const chunkEvent = JSON.stringify({ type: "chunk", chunk: data.chunk });
                controller.enqueue(encoder.encode(`data: ${chunkEvent}\n\n`));
              } else if (data.done) {
                const isCrisis = data.is_crisis || false;
                const isPublicType = session.consultType === "PUBLIC" || session.consultType === "DIRECTED";
                const shouldHide = isCrisis && isPublicType;

                const encryptedContent = encryptMessage(fullResponse, payload.userId);
                const assistantMsg = await prisma.chatMessage.create({
                  data: { sessionId, role: "ASSISTANT", content: encryptedContent, isCrisis, isHidden: shouldHide },
                });

                if (isCrisis) {
                  await prisma.chatMessage.update({ where: { id: userMsgId }, data: { isCrisis: true, isHidden: shouldHide } });
                }

                if (shouldHide) {
                  await prisma.chatSession.update({ where: { id: sessionId }, data: { consultType: "PRIVATE", isPublic: false } });
                  await deleteNotificationsOnPrivatize(sessionId, payload.userId);
                }

                const doneEvent = JSON.stringify({
                  type: "done",
                  assistantMessageId: assistantMsg.id,
                  isCrisis,
                  sessionPrivatized: shouldHide,
                });
                controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
              } else if (data.error) {
                const errorEvent = JSON.stringify({ type: "error", error: data.error });
                controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      } catch (error) {
        logger.error("Stream processing error", { sessionId }, error);
        const errorEvent = JSON.stringify({ type: "error", error: "ストリーム処理中にエラーが発生しました" });
        controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ============================================
// Non-streaming path: moderation + JSON response
// ============================================
async function handleNonStreamingResponse(opts: {
  sessionId: string;
  userMessage: string;
  payload: JWTPayload;
  session: SessionData;
  consultCost: number;
  isFirstMessage: boolean;
  generatedTitle: string | null;
}): Promise<NextResponse> {
  const { sessionId, userMessage, payload, session, consultCost, isFirstMessage, generatedTitle } = opts;

  // Moderation check
  let moderationCrisis = false;
  if (session.consultType === "PUBLIC" || session.consultType === "DIRECTED") {
    try {
      const moderationResult = await yamiiClient.sendCounselingMessage(
        userMessage, payload.userId, { sessionId }
      );
      moderationCrisis = moderationResult.is_crisis;
    } catch {
      moderationCrisis = checkCrisisKeywords(userMessage);
    }
  }

  const isPublicType = session.consultType === "PUBLIC" || session.consultType === "DIRECTED";
  const shouldHide = moderationCrisis && isPublicType;

  const { userMsg } = await saveUserMessageAndDeduct({
    sessionId,
    userId: payload.userId,
    userMessage,
    consultCost,
    txType: "CONSULT_HUMAN",
    isFirstMessage,
    generatedTitle,
    isCrisis: moderationCrisis,
    shouldHide,
  });

  await notifyTargetsIfNeeded(session, sessionId, isFirstMessage, payload.sub, shouldHide);

  if (shouldHide) {
    await deleteNotificationsOnPrivatize(sessionId, payload.userId);
  }

  return NextResponse.json({
    userMessage: { ...userMsg, content: userMessage },
    assistantMessage: null,
    response: null,
    isCrisis: moderationCrisis,
    sessionTitle: generatedTitle,
    sessionPrivatized: shouldHide,
  });
}

// ============================================
// POST /api/chat/sessions/[id]/messages
// ============================================
export async function POST(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

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

  const validation = validateBody(sendMessageSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const userMessage = validation.data.message.trim();

  try {
    // Load session with recent messages
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 10 },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.userId !== payload.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const isFirstMessage = session.messages.length === 0;
    const existingMessages = session.messages.map((m: PrismaMessage) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: decryptMessage(m.content, payload.userId),
    })) as ConversationMessage[];

    // Wallet balance check
    const consultCost = session.consultType === "PUBLIC"
      ? TOKEN_ECONOMY.PUBLIC_CONSULT_COST
      : session.consultType === "DIRECTED"
        ? TOKEN_ECONOMY.DIRECTED_CONSULT_COST
        : TOKEN_ECONOMY.PRIVATE_CONSULT_COST;

    const wallet = await prisma.wallet.findUnique({ where: { userId: payload.userId } });
    if (!wallet) {
      return NextResponse.json({ error: "ウォレットが見つかりません" }, { status: 400 });
    }
    if (wallet.balance < consultCost) {
      return NextResponse.json(
        { error: "YAMIが足りません。明日のBI付与をお待ちください。" },
        { status: 400 }
      );
    }

    // Generate title for first message
    const generatedTitle = isFirstMessage ? await yamiiClient.generateTitle(userMessage) : null;

    // Route to streaming or non-streaming handler
    const shouldCallYamii =
      session.consultType === "PRIVATE" ||
      ((session.consultType === "PUBLIC" || session.consultType === "DIRECTED") && hasMentionYamii(userMessage));

    if (shouldCallYamii) {
      return handleStreamingResponse({
        sessionId, userMessage, payload, session, existingMessages,
        consultCost, isFirstMessage, generatedTitle,
      });
    }

    return handleNonStreamingResponse({
      sessionId, userMessage, payload, session,
      consultCost, isFirstMessage, generatedTitle,
    });
  } catch (error) {
    logger.error("Send message error", { sessionId }, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
