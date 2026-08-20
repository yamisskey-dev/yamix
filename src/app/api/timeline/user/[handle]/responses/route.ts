import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { optionalAuth, ErrorResponses } from "@/lib/api-helpers";
import type { TimelineConsultation, TimelineResponse } from "@/types";
import { safeDecryptMessage } from "@/lib/encryption";
import { parseLimit } from "@/lib/validation";
import { toPublicUserRef, paginate } from "@/lib/api-format";

interface RouteParams {
  params: Promise<{ handle: string }>;
}

// GET /api/timeline/user/[handle]/responses - Get user's responses to public consultations
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { handle } = await params;
  const decodedHandle = decodeURIComponent(handle);

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor");

  try {
    // Check if the viewer is authenticated and viewing their own profile
    const payload = await optionalAuth(req);
    const currentUserId = payload?.userId ?? null;

    // Find user by handle
    const user = await prisma.user.findUnique({
      where: { handle: decodedHandle },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if viewing own profile
    const isOwnProfile = currentUserId === user.id;

    // Get user's responses (as responderId)
    const responses = await prisma.chatMessage.findMany({
      where: {
        responderId: user.id,
        role: "ASSISTANT",
        ...(isOwnProfile ? {} : { isAnonymous: false }), // 他人のプロフィールでは匿名回答を除外
        session: {
          consultType: "PUBLIC", // Only public consultations
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        session: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            messages: {
              where: { role: "USER" },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
    });

    const { items, hasMore, nextCursor } = paginate(responses, limit);

    const consultations: TimelineConsultation[] = items.map((response) => {
      const session = response.session;
      // Decrypt message content (backwards compatible)
      const rawQuestion = session.messages[0]?.content || "";
      const question = safeDecryptMessage(rawQuestion, session.userId);
      const answer = safeDecryptMessage(response.content, session.userId);

      return {
        id: response.id,
        sessionId: session.id,
        title: session.title || null,
        question,
        answer,
        consultType: session.consultType,
        isAnonymous: session.isAnonymous,
        user: session.isAnonymous ? null : toPublicUserRef(session.user),
        replyCount: 0,
        replies: [],
        createdAt: response.createdAt,
        isUserResponse: true, // このアイテムはユーザーの回答
        responder: response.isAnonymous ? null : toPublicUserRef(user),
      };
    });

    const responseData: TimelineResponse = {
      consultations,
      hasMore,
      nextCursor,
    };

    return NextResponse.json({
      ...responseData,
      user: toPublicUserRef(user),
    });
  } catch (error) {
    logger.error("Get user responses error", { handle: decodedHandle }, error);
    return ErrorResponses.internalError();
  }
}
