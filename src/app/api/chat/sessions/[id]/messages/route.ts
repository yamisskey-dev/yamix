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

// Prismaのメッセージ型
interface PrismaMessage {
  role: string;
  content: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

import { checkCrisisKeywords } from "@/lib/crisis";

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
    // Verify session ownership
    let existingMessages: ConversationMessage[] = [];
    let isFirstMessage = false;

    const sessionWithMessages = await prisma.chatSession.findUnique({
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

    const session = sessionWithMessages;
    isFirstMessage = sessionWithMessages.messages.length === 0;
    // Decrypt existing messages for conversation history (backwards compatible)
    existingMessages = sessionWithMessages.messages.map((m: PrismaMessage) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: decryptMessage(m.content, payload.userId),
    })) as ConversationMessage[];

    // Determine consult cost based on consultType
    const consultCost = session.consultType === "PUBLIC"
      ? TOKEN_ECONOMY.PUBLIC_CONSULT_COST
      : session.consultType === "DIRECTED"
        ? TOKEN_ECONOMY.DIRECTED_CONSULT_COST
        : TOKEN_ECONOMY.PRIVATE_CONSULT_COST;

    const wallet = await prisma.wallet.findUnique({
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

    // Determine if we should call Yamii API
    // - PRIVATE consultations: Always call
    // - PUBLIC consultations: Only if message starts with @yamii
    const hasYamiiMention = hasMentionYamii(userMessage);
    // PRIVATE: always call AI, PUBLIC/DIRECTED: only if @yamii mentioned
    const shouldCallYamii =
      session.consultType === "PRIVATE" ||
      ((session.consultType === "PUBLIC" || session.consultType === "DIRECTED") && hasYamiiMention);

    // For PUBLIC/DIRECTED without @yamii mention, run moderation-only check
    let moderationCrisis = false;

    // Generate AI title for first message
    let generatedTitle: string | null = null;
    if (isFirstMessage) {
      generatedTitle = await yamiiClient.generateTitle(userMessage);
    }

    const now = new Date();

    // === STREAMING PATH: When AI response is needed ===
    if (shouldCallYamii) {
      const messageForYamii = hasMentionYamii(userMessage)
        ? removeMentionYamii(userMessage)
        : userMessage;

      // Pre-stream: save user message and deduct wallet
      const preResult = await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: payload.userId } });
        if (!wallet) throw new Error("Wallet not found");

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: consultCost } },
        });
        await tx.transaction.create({
          data: { senderId: wallet.id, amount: -consultCost, txType: "CONSULT_AI" },
        });

        const encryptedUserContent = encryptMessage(userMessage, payload.userId);
        const userMsg = await tx.chatMessage.create({
          data: { sessionId, role: "USER", content: encryptedUserContent, isCrisis: false },
        });

        if (isFirstMessage && generatedTitle) {
          await tx.chatSession.update({ where: { id: sessionId }, data: { title: generatedTitle, updatedAt: now } });
        } else {
          await tx.chatSession.update({ where: { id: sessionId }, data: { updatedAt: now } });
        }

        return { userMsgId: userMsg.id };
      });
      const userMsgId = preResult.userMsgId;

      // Notify directed targets on first message
      if (isFirstMessage && session.consultType === "DIRECTED") {
        const targets = await prisma.chatSessionTarget.findMany({ where: { sessionId }, select: { userId: true } });
        if (targets.length > 0) {
          await notifyDirectedRequest(targets.map((t) => t.userId), payload.sub, sessionId, session.isAnonymous);
        }
      }

      // Start SSE stream
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

      // Create a TransformStream to proxy SSE and handle post-stream DB saves
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let fullResponse = "";

      const stream = new ReadableStream({
        async start(controller) {
          // Send initial metadata (userMessage info + title)
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
                    // Stream complete - save assistant message to DB
                    const isCrisis = data.is_crisis || false;
                    const shouldHide = isCrisis && (session.consultType === "PUBLIC" || session.consultType === "DIRECTED");

                    const encryptedContent = encryptMessage(fullResponse, payload.userId);
                    const assistantMsg = await prisma.chatMessage.create({
                      data: { sessionId, role: "ASSISTANT", content: encryptedContent, isCrisis, isHidden: shouldHide },
                    });
                    const assistantMsgId = assistantMsg.id;

                    // Update user message crisis flag if needed
                    if (isCrisis) {
                      await prisma.chatMessage.update({ where: { id: userMsgId }, data: { isCrisis: true, isHidden: shouldHide } });
                    }

                    if (shouldHide) {
                      await prisma.chatSession.update({ where: { id: sessionId }, data: { consultType: "PRIVATE", isPublic: false } });
                      await prisma.notification.deleteMany({
                        where: { linkUrl: { contains: `/main/chat/${sessionId}` }, userId: { not: payload.userId } },
                      });
                    }

                    const doneEvent = JSON.stringify({
                      type: "done",
                      assistantMessageId: assistantMsgId,
                      isCrisis,
                      sessionPrivatized: isCrisis && (session.consultType === "PUBLIC" || session.consultType === "DIRECTED"),
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

    // === NON-STREAMING PATH: PUBLIC/DIRECTED without @yamii ===
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

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: payload.userId } });
      if (!wallet) throw new Error("Wallet not found");

      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: consultCost } } });
      await tx.transaction.create({ data: { senderId: wallet.id, amount: -consultCost, txType: "CONSULT_HUMAN" } });

      const anyCrisis = moderationCrisis;
      const shouldHide = anyCrisis && (session.consultType === "PUBLIC" || session.consultType === "DIRECTED");

      const encryptedUserContent = encryptMessage(userMessage, payload.userId);
      const userMsg = await tx.chatMessage.create({
        data: { sessionId, role: "USER", content: encryptedUserContent, isCrisis: anyCrisis, isHidden: shouldHide },
      });

      const sessionUpdate: Record<string, unknown> = { updatedAt: now };
      if (isFirstMessage) sessionUpdate.title = generatedTitle!;
      if (shouldHide) { sessionUpdate.consultType = "PRIVATE"; sessionUpdate.isPublic = false; }
      await tx.chatSession.update({ where: { id: sessionId }, data: sessionUpdate });

      return { userMsg, shouldHide };
    });

    if (isFirstMessage && session.consultType === "DIRECTED" && !result.shouldHide) {
      const targets = await prisma.chatSessionTarget.findMany({ where: { sessionId }, select: { userId: true } });
      if (targets.length > 0) {
        await notifyDirectedRequest(targets.map((t) => t.userId), payload.sub, sessionId, session.isAnonymous);
      }
    }

    if (result.shouldHide) {
      await prisma.notification.deleteMany({
        where: { linkUrl: { contains: `/main/chat/${sessionId}` }, userId: { not: payload.userId } },
      });
    }

    return NextResponse.json({
      userMessage: { ...result.userMsg, content: userMessage },
      assistantMessage: null,
      response: null,
      isCrisis: moderationCrisis,
      sessionTitle: generatedTitle,
      sessionPrivatized: result.shouldHide || false,
    });
  } catch (error) {
    logger.error("Send message error", { sessionId }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
