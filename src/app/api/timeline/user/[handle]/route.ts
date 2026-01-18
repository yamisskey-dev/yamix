import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { TimelineConsultation, TimelineResponse } from "@/types";

// In-memory types
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

// Prisma結果の型
interface PrismaUser {
  id: string;
  handle: string;
  profile: { displayName: string | null; avatarUrl: string | null } | null;
}

interface PrismaSessionWithMessages {
  id: string;
  createdAt: Date;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

// Access memory stores from memoryDB
const chatSessionsStore = memoryDB.chatSessions as Map<string, MemoryChatSession>;
const chatMessagesStore = memoryDB.chatMessages as Map<string, MemoryChatMessage>;

interface RouteParams {
  params: Promise<{ handle: string }>;
}

// GET /api/timeline/user/[handle] - Get user's public consultations
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { handle } = await params;
  const decodedHandle = decodeURIComponent(handle);

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const cursor = searchParams.get("cursor");

  try {
    const db = getPrismaClient();

    if (db) {
      // Find user by handle
      const user = await db.user.findUnique({
        where: { handle: decodedHandle },
        include: { profile: true },
      }) as PrismaUser | null;

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Get user's public sessions
      const sessions = await db.chatSession.findMany({
        where: {
          userId: user.id,
          isPublic: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 2,
          },
        },
      }) as PrismaSessionWithMessages[];

      const hasMore = sessions.length > limit;
      const items = sessions.slice(0, limit);

      const consultations: TimelineConsultation[] = items
        .filter((s) => s.messages.length >= 2)
        .map((s) => {
          const userMsg = s.messages.find((m) => m.role === "USER");
          const assistantMsg = s.messages.find((m) => m.role === "ASSISTANT");

          return {
            id: s.id,
            sessionId: s.id,
            question: userMsg?.content || "",
            answer: assistantMsg?.content || "",
            user: {
              handle: user.handle,
              displayName: user.profile?.displayName || null,
              avatarUrl: user.profile?.avatarUrl || null,
            },
            replyCount: 0,
            replies: [],
            createdAt: s.createdAt,
          };
        });

      const response: TimelineResponse = {
        consultations,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json({
        ...response,
        user: {
          handle: user.handle,
          displayName: user.profile?.displayName || null,
          avatarUrl: user.profile?.avatarUrl || null,
        },
      });
    } else {
      // In-memory fallback - simplified since we don't have user data
      const publicSessions = Array.from(chatSessionsStore.values())
        .filter((s) => s.isPublic)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      let startIndex = 0;
      if (cursor) {
        const cursorIndex = publicSessions.findIndex((s) => s.id === cursor);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }

      const sessions = publicSessions.slice(startIndex, startIndex + limit + 1);
      const hasMore = sessions.length > limit;
      const items = sessions.slice(0, limit);

      const consultations: TimelineConsultation[] = items
        .map((s) => {
          const messages = Array.from(chatMessagesStore.values())
            .filter((m) => m.sessionId === s.id)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

          const userMsg = messages.find((m) => m.role === "USER");
          const assistantMsg = messages.find((m) => m.role === "ASSISTANT");

          if (!userMsg || !assistantMsg) return null;

          return {
            id: s.id,
            sessionId: s.id,
            question: userMsg.content,
            answer: assistantMsg.content,
            user: {
              handle: decodedHandle,
              displayName: null as string | null,
              avatarUrl: null as string | null,
            },
            replyCount: 0,
            replies: [],
            createdAt: s.createdAt,
          } as TimelineConsultation;
        })
        .filter((c): c is TimelineConsultation => c !== null);

      const response: TimelineResponse = {
        consultations,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json({
        ...response,
        user: {
          handle: decodedHandle,
          displayName: null,
          avatarUrl: null,
        },
      });
    }
  } catch (error) {
    logger.error("Get user timeline error", { handle: decodedHandle }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
