import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;
import {
  chatSessionsStore,
  chatMessagesStore,
  type MemoryChatMessage,
} from "../route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/chat/sessions/[id] - Get session with messages
export async function GET(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id } = await params;

  try {
    if (isPrismaAvailable() && prisma) {
      const session = await prismaAny.chatSession.findUnique({
        where: { id },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      return NextResponse.json(session);
    } else {
      // In-memory fallback
      const session = chatSessionsStore.get(id);

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const messages = Array.from(chatMessagesStore.values())
        .filter((m: MemoryChatMessage) => m.sessionId === id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return NextResponse.json({
        ...session,
        messages,
      });
    }
  } catch (error) {
    console.error("Get chat session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/chat/sessions/[id] - Update session (title, isPublic)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id } = await params;

  let body: { title?: string; isPublic?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    if (isPrismaAvailable() && prisma) {
      const session = await prismaAny.chatSession.findUnique({
        where: { id },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const updated = await prismaAny.chatSession.update({
        where: { id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
        },
      });

      return NextResponse.json(updated);
    } else {
      // In-memory fallback
      const session = chatSessionsStore.get(id);

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      if (body.title !== undefined) session.title = body.title;
      if (body.isPublic !== undefined) session.isPublic = body.isPublic;
      session.updatedAt = new Date();

      chatSessionsStore.set(id, session);

      return NextResponse.json(session);
    }
  } catch (error) {
    console.error("Update chat session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/sessions/[id] - Delete session
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id } = await params;

  try {
    if (isPrismaAvailable() && prisma) {
      const session = await prismaAny.chatSession.findUnique({
        where: { id },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      await prismaAny.chatSession.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } else {
      // In-memory fallback
      const session = chatSessionsStore.get(id);

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      // Delete session and its messages
      chatSessionsStore.delete(id);
      for (const [msgId, msg] of chatMessagesStore.entries()) {
        if ((msg as MemoryChatMessage).sessionId === id) {
          chatMessagesStore.delete(msgId);
        }
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Delete chat session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
