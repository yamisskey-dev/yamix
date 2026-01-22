import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";

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

// Access memory stores from memoryDB
const chatSessionsStore = memoryDB.chatSessions as Map<string, MemoryChatSession>;
const chatMessagesStore = memoryDB.chatMessages as Map<string, MemoryChatMessage>;

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
    const db = getPrismaClient();

    if (db) {
      const session = await db.chatSession.findUnique({
        where: { id },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              responder: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Check authorization: owner can access any session, others can only access PUBLIC sessions
      const isOwner = session.userId === payload.userId;
      const isPublic = session.consultType === "PUBLIC";

      if (!isOwner && !isPublic) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      // Format response with user info
      return NextResponse.json({
        ...session,
        user: {
          id: session.user.id,
          handle: session.user.handle,
          displayName: session.user.profile?.displayName || null,
          avatarUrl: session.user.profile?.avatarUrl || null,
        },
        messages: session.messages.map((m) => ({
          ...m,
          responder: m.responder ? {
            id: m.responder.id,
            handle: m.responder.handle,
            displayName: m.responder.profile?.displayName || null,
            avatarUrl: m.responder.profile?.avatarUrl || null,
          } : null,
        })),
      });
    } else {
      // In-memory fallback
      const session = chatSessionsStore.get(id);

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Check authorization: owner can access any session, others can only access PUBLIC sessions
      const isOwner = session.userId === payload.userId;
      const isPublic = session.consultType === "PUBLIC";

      if (!isOwner && !isPublic) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      // Get user info
      const user = Array.from(memoryDB.users.values()).find((u) => u.id === session.userId);

      const messages = Array.from(chatMessagesStore.values())
        .filter((m) => m.sessionId === id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return NextResponse.json({
        ...session,
        user: user ? {
          id: user.id,
          handle: user.handle,
          displayName: null as string | null,
          avatarUrl: null as string | null,
        } : null,
        messages,
      });
    }
  } catch (error) {
    logger.error("Get chat session error", { sessionId: id }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/chat/sessions/[id] - Update session (title only)
// consultType と isAnonymous は作成時に決まり、変更不可
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

  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // タイトルのみ更新可能
  if (body.title === undefined) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const db = getPrismaClient();

    if (db) {
      const session = await db.chatSession.findUnique({
        where: { id },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const updated = await db.chatSession.update({
        where: { id },
        data: { title: body.title },
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

      session.title = body.title;
      session.updatedAt = new Date();

      chatSessionsStore.set(id, session);

      return NextResponse.json(session);
    }
  } catch (error) {
    logger.error("Update chat session error", { sessionId: id }, error);
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
    const db = getPrismaClient();

    if (db) {
      const session = await db.chatSession.findUnique({
        where: { id },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      await db.chatSession.delete({
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
        if (msg.sessionId === id) {
          chatMessagesStore.delete(msgId);
        }
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    logger.error("Delete chat session error", { sessionId: id }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
