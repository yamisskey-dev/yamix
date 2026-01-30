import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB, generateId } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import type { ChatSessionListItem, ChatSessionsResponse } from "@/types";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { createChatSessionSchema, validateBody } from "@/lib/validation";
import { decryptMessage } from "@/lib/encryption";

// In-memory chat sessions store
interface MemoryChatSession {
  id: string;
  userId: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
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
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
  isAnonymous: boolean;
  isPublic: boolean; // DEPRECATED
  userId: string;
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
      // Fetch owned sessions AND sessions where user is a DIRECTED target
      const sessionSelect = {
        id: true,
        title: true,
        consultType: true,
        isAnonymous: true,
        isPublic: true, // DEPRECATED
        userId: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: "desc" as const },
          take: 1,
          select: { content: true, role: true },
        },
        _count: { select: { targets: true } },
      };

      const [ownedSessions, directedTargets] = await Promise.all([
        db.chatSession.findMany({
          where: { userId: payload.userId },
          orderBy: { updatedAt: "desc" },
          take: limit + 1,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
          select: sessionSelect,
        }),
        // Sessions where current user is a target
        db.chatSessionTarget.findMany({
          where: { userId: payload.userId },
          select: {
            session: {
              select: sessionSelect,
            },
          },
        }),
      ]);

      // Merge and deduplicate (owned sessions take priority)
      const ownedIds = new Set(ownedSessions.map((s) => s.id));
      const directedSessionIds = new Set<string>();
      const directedSessions = directedTargets
        .map((t) => t.session)
        .filter((s) => {
          if (ownedIds.has(s.id)) return false;
          directedSessionIds.add(s.id);
          return true;
        });

      const allSessions = [...ownedSessions, ...directedSessions]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      // Apply cursor-based pagination on merged result
      let startIndex = 0;
      if (cursor) {
        const cursorIndex = allSessions.findIndex((s) => s.id === cursor);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }

      const paginated = allSessions.slice(startIndex, startIndex + limit + 1);
      const hasMore = paginated.length > limit;
      const items: ChatSessionListItem[] = paginated
        .slice(0, limit)
        .map((s: PrismaSessionResult & { _count?: { targets: number }; userId?: string }) => {
          // Decrypt message content for preview (use session owner's key)
          const rawContent = s.messages[0]?.content;
          const ownerId = s.userId || payload.userId;
          const decryptedContent = rawContent
            ? decryptMessage(rawContent, ownerId)
            : null;
          return {
            id: s.id,
            title: s.title,
            preview: decryptedContent?.slice(0, 50) || null,
            consultType: s.consultType,
            isAnonymous: s.isAnonymous,
            isPublic: s.isPublic, // DEPRECATED
            targetCount: s._count?.targets ?? 0,
            isReceived: directedSessionIds.has(s.id),
            updatedAt: s.updatedAt,
          };
        });

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

        // Decrypt message content for preview (backwards compatible)
        const decryptedContent = lastMessage?.content
          ? decryptMessage(lastMessage.content, payload.userId)
          : null;

        return {
          id: s.id,
          title: s.title,
          preview: decryptedContent?.slice(0, 50) || null,
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

    const { consultType, isAnonymous, allowAnonymousResponses, category, targetUserHandles } = validation.data;

    const db = getPrismaClient();

    if (db) {
      // DIRECTED: 指名先ユーザーを検索
      let targetUserIds: string[] = [];
      if (consultType === "DIRECTED" && targetUserHandles && targetUserHandles.length > 0) {
        const targetUsers = await db.user.findMany({
          where: { handle: { in: targetUserHandles } },
          select: { id: true, handle: true },
        });

        if (targetUsers.length === 0) {
          return NextResponse.json(
            { error: "指名先のユーザーが見つかりません" },
            { status: 400 }
          );
        }

        // 自分自身を除外 + 重複排除
        targetUserIds = [...new Set(
          targetUsers
            .filter((u) => u.id !== payload.userId)
            .map((u) => u.id)
        )];

        if (targetUserIds.length === 0) {
          return NextResponse.json(
            { error: "自分以外のユーザーを指名してください" },
            { status: 400 }
          );
        }
      }

      const session = await db.chatSession.create({
        data: {
          userId: payload.userId,
          consultType,
          isAnonymous,
          allowAnonymousResponses,
          category,
          isPublic: consultType === "PUBLIC", // 後方互換性
          ...(consultType === "DIRECTED" && targetUserIds.length > 0 && {
            targets: {
              create: targetUserIds.map((uid) => ({ userId: uid })),
            },
          }),
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
          _count: { select: { targets: true } },
        },
      });

      return NextResponse.json(
        { ...session, targetCount: session._count.targets },
        { status: 201 }
      );
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
          targetCount: 0,
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

// DELETE /api/chat/sessions?type=private - Delete all sessions (or only private sessions)
export async function DELETE(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "private" or "all"

  try {
    const db = getPrismaClient();

    if (db) {
      const whereClause: { userId: string; consultType?: "PRIVATE" } = {
        userId: payload.userId,
      };

      if (type === "private") {
        whereClause.consultType = "PRIVATE";
      }

      const result = await db.chatSession.deleteMany({
        where: whereClause,
      });

      return NextResponse.json({
        success: true,
        deletedCount: result.count
      });
    } else {
      // In-memory fallback
      let deletedCount = 0;
      for (const [sessionId, session] of chatSessionsStore.entries()) {
        if (session.userId === payload.userId) {
          if (type === "private" && session.consultType !== "PRIVATE") {
            continue;
          }

          chatSessionsStore.delete(sessionId);
          // Delete associated messages
          for (const [msgId, msg] of chatMessagesStore.entries()) {
            if (msg.sessionId === sessionId) {
              chatMessagesStore.delete(msgId);
            }
          }
          deletedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        deletedCount
      });
    }
  } catch (error) {
    logger.error("Delete chat sessions error", { userId: payload.userId }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
