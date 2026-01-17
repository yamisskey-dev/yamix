import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB, generateId } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;
import { yamiiClient } from "@/lib/yamii-client";
import type { ConversationMessage } from "@/types";

// Access memory stores from memoryDB
const chatSessionsStore = memoryDB.chatSessions;
const chatMessagesStore = memoryDB.chatMessages;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Generate title from first message
function generateTitle(message: string): string {
  const firstSentence = message.match(/^[^。！？.!?\n]+[。！？.!?]?/);
  const title = firstSentence?.[0] || message;
  return title.slice(0, 50) + (title.length > 50 ? "..." : "");
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
    // Verify session ownership
    let session;
    let existingMessages: ConversationMessage[] = [];
    let isFirstMessage = false;

    if (isPrismaAvailable() && prisma) {
      session = await prismaAny.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 10,
          },
        },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      isFirstMessage = session.messages.length === 0;
      existingMessages = session.messages.map((m: { role: string; content: string }) => ({
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

    // Call Yamii API
    let yamiiResponse;
    try {
      yamiiResponse = await yamiiClient.sendCounselingMessage(
        userMessage,
        payload.userId,
        {
          userName: payload.sub,
          sessionId: sessionId,
          conversationHistory: existingMessages,
        }
      );
    } catch (error) {
      console.error("Yamii API error:", error);
      return NextResponse.json(
        { error: "AIサーバーに接続できません。しばらくしてからもう一度お試しください。" },
        { status: 503 }
      );
    }

    // Save messages to database
    const now = new Date();

    if (isPrismaAvailable() && prisma) {
      // Create user message
      const userMsg = await prismaAny.chatMessage.create({
        data: {
          sessionId,
          role: "USER",
          content: userMessage,
          isCrisis: false,
        },
      });

      // Create assistant message
      const assistantMsg = await prismaAny.chatMessage.create({
        data: {
          sessionId,
          role: "ASSISTANT",
          content: yamiiResponse.response,
          isCrisis: yamiiResponse.is_crisis,
        },
      });

      // Update session title if first message
      if (isFirstMessage) {
        await prismaAny.chatSession.update({
          where: { id: sessionId },
          data: {
            title: generateTitle(userMessage),
            updatedAt: now,
          },
        });
      } else {
        await prismaAny.chatSession.update({
          where: { id: sessionId },
          data: { updatedAt: now },
        });
      }

      return NextResponse.json({
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        response: yamiiResponse.response,
        isCrisis: yamiiResponse.is_crisis,
        sessionTitle: isFirstMessage ? generateTitle(userMessage) : null,
      });
    } else {
      // In-memory fallback
      const userMsg = {
        id: generateId(),
        sessionId,
        role: "USER" as const,
        content: userMessage,
        isCrisis: false,
        createdAt: now,
      };
      chatMessagesStore.set(userMsg.id, userMsg);

      const assistantMsg = {
        id: generateId(),
        sessionId,
        role: "ASSISTANT" as const,
        content: yamiiResponse.response,
        isCrisis: yamiiResponse.is_crisis,
        createdAt: new Date(now.getTime() + 1),
      };
      chatMessagesStore.set(assistantMsg.id, assistantMsg);

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
        response: yamiiResponse.response,
        isCrisis: yamiiResponse.is_crisis,
        sessionTitle: isFirstMessage ? generateTitle(userMessage) : null,
      });
    }
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
