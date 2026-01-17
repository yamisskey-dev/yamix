import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB } from "@/lib/prisma";
import type { TimelineConsultation, TimelineResponse } from "@/types";

// Access memory stores from memoryDB
const chatSessionsStore = memoryDB.chatSessions;
const chatMessagesStore = memoryDB.chatMessages;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

// GET /api/timeline - Get public consultations for timeline
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const cursor = searchParams.get("cursor");

  try {
    if (isPrismaAvailable() && prisma) {
      // Get public sessions with their first Q&A pair
      const sessions = await prismaAny.chatSession.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            take: 2, // First user message and first assistant response
          },
        },
      });

      const hasMore = sessions.length > limit;
      const items = sessions.slice(0, limit);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const consultations: TimelineConsultation[] = items
        .filter((s: any) => s.messages.length >= 2)
        .map((s: any) => {
          const userMsg = s.messages.find((m: any) => m.role === "USER");
          const assistantMsg = s.messages.find((m: any) => m.role === "ASSISTANT");

          return {
            id: s.id,
            sessionId: s.id,
            question: userMsg?.content || "",
            answer: assistantMsg?.content || "",
            user: {
              handle: s.user.handle,
              displayName: s.user.profile?.displayName || null,
              avatarUrl: s.user.profile?.avatarUrl || null,
            },
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
              handle: "anonymous",
              displayName: null as string | null,
              avatarUrl: null as string | null,
            },
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
    console.error("Get timeline error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
