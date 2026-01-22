import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { TimelineConsultation, TimelineResponse, TimelineReply } from "@/types";

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

// Prismaセッション結果の型
interface PrismaSessionWithMessages {
  id: string;
  consultType: "PRIVATE" | "PUBLIC";
  isAnonymous: boolean;
  createdAt: Date;
  user: {
    handle: string;
    profile: { displayName: string | null; avatarUrl: string | null } | null;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
    responder: {
      id: string;
      handle: string;
      profile: { displayName: string | null; avatarUrl: string | null } | null;
    } | null;
  }>;
}

// Access memory stores from memoryDB
const chatSessionsStore = memoryDB.chatSessions as Map<string, MemoryChatSession>;
const chatMessagesStore = memoryDB.chatMessages as Map<string, MemoryChatMessage>;

// GET /api/timeline - Get public consultations for timeline
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const cursor = searchParams.get("cursor");

  try {
    const db = getPrismaClient();

    if (db) {
      // Get public sessions with all messages (for reply tree)
      const sessions = await db.chatSession.findMany({
        where: { consultType: "PUBLIC" }, // 公開相談のみ
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: {
          id: true,
          consultType: true,
          isAnonymous: true,
          createdAt: true,
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

      const hasMore = sessions.length > limit;
      const items = sessions.slice(0, limit) as PrismaSessionWithMessages[];

      const consultations: TimelineConsultation[] = items
        .filter((s) => s.messages.length >= 1) // PUBLIC相談は質問のみでもOK
        .map((s) => {
          const userMsg = s.messages.find((m) => m.role === "USER");
          const firstAssistantMsg = s.messages.find((m) => m.role === "ASSISTANT");

          // All assistant messages as replies
          const allReplies: TimelineReply[] = s.messages
            .filter((m) => m.role === "ASSISTANT")
            .map((m) => ({
              id: m.id,
              content: m.content,
              createdAt: m.createdAt,
              responder: m.responder ? {
                id: m.responder.id,
                handle: m.responder.handle,
                displayName: m.responder.profile?.displayName || null,
                avatarUrl: m.responder.profile?.avatarUrl || null,
              } : null,
            }));

          return {
            id: s.id,
            sessionId: s.id,
            question: userMsg?.content || "",
            answer: firstAssistantMsg?.content || null, // PUBLIC相談ではnullの場合あり
            consultType: s.consultType,
            isAnonymous: s.isAnonymous,
            user: s.isAnonymous ? null : { // 匿名の場合はnull
              handle: s.user.handle,
              displayName: s.user.profile?.displayName || null,
              avatarUrl: s.user.profile?.avatarUrl || null,
            },
            replyCount: allReplies.length,
            replies: allReplies,
            createdAt: s.createdAt,
          };
        });

      const response: TimelineResponse = {
        consultations,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json(response);
    } else {
      // In-memory fallback
      const publicSessions = Array.from(chatSessionsStore.values())
        .filter((s) => s.consultType === "PUBLIC") // 公開相談のみ
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
          const firstAssistantMsg = messages.find((m) => m.role === "ASSISTANT");

          if (!userMsg || !firstAssistantMsg) return null;

          // All assistant messages as replies
          const allReplies: TimelineReply[] = messages
            .filter((m) => m.role === "ASSISTANT")
            .map((m) => ({
              id: m.id,
              content: m.content,
              createdAt: m.createdAt,
              responder: null, // In-memory doesn't have responder info
            }));

          return {
            id: s.id,
            sessionId: s.id,
            question: userMsg.content,
            answer: firstAssistantMsg.content,
            consultType: s.consultType,
            isAnonymous: s.isAnonymous,
            user: s.isAnonymous ? null : { // 匿名の場合はnull
              handle: "anonymous", // In-memory doesn't have real user info
              displayName: null as string | null,
              avatarUrl: null as string | null,
            },
            replyCount: allReplies.length,
            replies: allReplies,
            createdAt: s.createdAt,
          } as TimelineConsultation;
        })
        .filter((c): c is TimelineConsultation => c !== null);

      const response: TimelineResponse = {
        consultations,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    logger.error("Get timeline error", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
