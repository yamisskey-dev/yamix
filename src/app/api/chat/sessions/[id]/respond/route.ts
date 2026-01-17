import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

// Access memory stores from memoryDB
const chatSessionsStore = memoryDB.chatSessions;
const chatMessagesStore = memoryDB.chatMessages;

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
    if (isPrismaAvailable() && prisma) {
      // Get the session
      const session = await prismaAny.chatSession.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Only public sessions can receive human responses
      if (!session.isPublic) {
        return NextResponse.json(
          { error: "This session is not public" },
          { status: 403 }
        );
      }

      // Cannot respond to own session
      if (session.userId === payload.userId) {
        return NextResponse.json(
          { error: "Cannot respond to your own consultation" },
          { status: 400 }
        );
      }

      // Create the human response message
      const message = await prismaAny.chatMessage.create({
        data: {
          sessionId: id,
          role: "ASSISTANT",
          content: body.content.trim(),
          responderId: payload.userId,
          isCrisis: false,
        },
      });

      // Update session timestamp
      await prismaAny.chatSession.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({
        message,
        success: true,
      });
    } else {
      // In-memory fallback
      const session = chatSessionsStore.get(id);

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (!session.isPublic) {
        return NextResponse.json(
          { error: "This session is not public" },
          { status: 403 }
        );
      }

      if (session.userId === payload.userId) {
        return NextResponse.json(
          { error: "Cannot respond to your own consultation" },
          { status: 400 }
        );
      }

      const messageId = crypto.randomUUID();
      const message = {
        id: messageId,
        sessionId: id,
        role: "ASSISTANT" as const,
        content: body.content.trim(),
        responderId: payload.userId,
        isCrisis: false,
        createdAt: new Date(),
      };

      chatMessagesStore.set(messageId, message);
      session.updatedAt = new Date();
      chatSessionsStore.set(id, session);

      return NextResponse.json({
        message,
        success: true,
      });
    }
  } catch (error) {
    console.error("Human response error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
