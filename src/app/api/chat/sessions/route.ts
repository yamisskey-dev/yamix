import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB, generateId } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import type { ChatSessionListItem, ChatSessionsResponse } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

// In-memory chat sessions store
interface MemoryChatSession {
  id: string;
  userId: string;
  title: string | null;
  isPublic: boolean;
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

// Initialize memory stores if not present
if (!memoryDB.chatSessions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (memoryDB as any).chatSessions = new Map<string, MemoryChatSession>();
}
if (!memoryDB.chatMessages) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (memoryDB as any).chatMessages = new Map<string, MemoryChatMessage>();
}

const chatSessionsStore = memoryDB.chatSessions as Map<string, MemoryChatSession>;
const chatMessagesStore = memoryDB.chatMessages as Map<string, MemoryChatMessage>;

// GET /api/chat/sessions - List user's chat sessions
export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const cursor = searchParams.get("cursor");

  try {
    if (isPrismaAvailable() && prisma) {
      const sessions = await prismaAny.chatSession.findMany({
        where: { userId: payload.userId },
        orderBy: { updatedAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: {
          id: true,
          title: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, role: true },
          },
        },
      });

      const hasMore = sessions.length > limit;
      const items: ChatSessionListItem[] = sessions.slice(0, limit).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => ({
          id: s.id,
          title: s.title,
          preview: s.messages[0]?.content?.slice(0, 50) || null,
          updatedAt: s.updatedAt,
        })
      );

      const response: ChatSessionsResponse = {
        sessions: items,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json(response);
    } else {
      // In-memory fallback
      const allSessions = Array.from(chatSessionsStore.values())
        .filter((s) => s.userId === payload.userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      let startIndex = 0;
      if (cursor) {
        const cursorIndex = allSessions.findIndex((s) => s.id === cursor);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }

      const sessions = allSessions.slice(startIndex, startIndex + limit + 1);
      const hasMore = sessions.length > limit;
      const items: ChatSessionListItem[] = sessions.slice(0, limit).map((s) => {
        // Get last message for preview
        const sessionMessages = Array.from(chatMessagesStore.values())
          .filter((m) => m.sessionId === s.id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const lastMessage = sessionMessages[0];

        return {
          id: s.id,
          title: s.title,
          preview: lastMessage?.content?.slice(0, 50) || null,
          updatedAt: s.updatedAt,
        };
      });

      const response: ChatSessionsResponse = {
        sessions: items,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    console.error("Get chat sessions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/chat/sessions - Create new chat session
export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    if (isPrismaAvailable() && prisma) {
      const session = await prismaAny.chatSession.create({
        data: {
          userId: payload.userId,
        },
        select: {
          id: true,
          title: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json(session, { status: 201 });
    } else {
      // In-memory fallback
      const now = new Date();
      const session: MemoryChatSession = {
        id: generateId(),
        userId: payload.userId,
        title: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      };

      chatSessionsStore.set(session.id, session);

      return NextResponse.json(
        {
          id: session.id,
          title: session.title,
          isPublic: session.isPublic,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Create chat session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

