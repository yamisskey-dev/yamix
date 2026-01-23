import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB, generateId } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import type { ChatSessionListItem, ChatSessionsResponse } from "@/types";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { createChatSessionSchema, validateBody } from "@/lib/validation";

// In-memory chat sessions store
interface MemoryChatSession {
  id: string;
  userId: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC";
  isAnonymous: boolean;
  allowAnonymousResponses: boolean;
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

// Prismaのセッション取得結果の型
interface PrismaSessionResult {
  id: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC";
  isAnonymous: boolean;
  isPublic: boolean; // DEPRECATED
  updatedAt: Date;
  messages: { content: string; role: string }[];
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
    const db = getPrismaClient();

    if (db) {
      const sessions = await db.chatSession.findMany({
        where: { userId: payload.userId },
        orderBy: { updatedAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: {
          id: true,
          title: true,
          consultType: true,
          isAnonymous: true,
          isPublic: true, // DEPRECATED
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, role: true },
          },
        },
      });

      const hasMore = sessions.length > limit;
      const items: ChatSessionListItem[] = sessions
        .slice(0, limit)
        .map((s: PrismaSessionResult) => ({
          id: s.id,
          title: s.title,
          preview: s.messages[0]?.content?.slice(0, 50) || null,
          consultType: s.consultType,
          isAnonymous: s.isAnonymous,
          isPublic: s.isPublic, // DEPRECATED
          updatedAt: s.updatedAt,
        }));

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
          consultType: s.consultType,
          isAnonymous: s.isAnonymous,
          isPublic: s.isPublic, // DEPRECATED
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
    logger.error("Get chat sessions error", { userId: payload.userId }, error);
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

  // レート制限チェック
  const rateLimitKey = `chat-create:${payload.userId}`;
  if (checkRateLimit(rateLimitKey, RateLimits.CHAT_CREATE)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  try {
    // リクエストボディをパース（空の場合はデフォルト値を使用）
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // バリデーション
    const validation = validateBody(createChatSessionSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { consultType, isAnonymous, allowAnonymousResponses, category } = validation.data;

    const db = getPrismaClient();

    if (db) {
      const session = await db.chatSession.create({
        data: {
          userId: payload.userId,
          consultType,
          isAnonymous,
          allowAnonymousResponses,
          category,
          isPublic: consultType === "PUBLIC", // 後方互換性
        },
        select: {
          id: true,
          title: true,
          consultType: true,
          isAnonymous: true,
          category: true,
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
        consultType,
        isAnonymous,
        allowAnonymousResponses,
        category: category ?? null,
        isPublic: consultType === "PUBLIC", // DEPRECATED
        createdAt: now,
        updatedAt: now,
      };

      chatSessionsStore.set(session.id, session);

      return NextResponse.json(
        {
          id: session.id,
          title: session.title,
          consultType: session.consultType,
          isAnonymous: session.isAnonymous,
          category: session.category,
          isPublic: session.isPublic,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    logger.error("Create chat session error", { userId: payload.userId }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
