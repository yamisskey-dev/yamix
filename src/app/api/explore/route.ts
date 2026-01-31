import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { TimelineConsultation, TimelineResponse, TimelineReply } from "@/types";
import { parseLimit } from "@/lib/validation";
import { decryptMessage } from "@/lib/encryption";

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Prismaセッション結果の型
interface PrismaSessionWithMessages {
  id: string;
  consultType: "PRIVATE" | "PUBLIC";
  isAnonymous: boolean;
  createdAt: Date;
  user: {
    id: string;
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

// GET /api/timeline - Get public consultations for timeline
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor");

  try {
    // Get public sessions with all messages (for reply tree)
    const sessions = await prisma.chatSession.findMany({
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
          take: 10,
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
        const ownerId = s.user.id;
        const userMsg = s.messages.find((m) => m.role === "USER");
        const firstAssistantMsg = s.messages.find((m) => m.role === "ASSISTANT");

        // All assistant messages as replies
        const allReplies: TimelineReply[] = s.messages
          .filter((m) => m.role === "ASSISTANT")
          .map((m) => ({
            id: m.id,
            content: decryptMessage(m.content, ownerId),
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
          question: userMsg ? decryptMessage(userMsg.content, ownerId) : "",
          answer: firstAssistantMsg ? decryptMessage(firstAssistantMsg.content, ownerId) : null,
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
  } catch (error) {
    logger.error("Get timeline error", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
