import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { optionalAuth, ErrorResponses } from "@/lib/api-helpers";
import type { TimelineConsultation, TimelineResponse } from "@/types";
import { decryptMessage } from "@/lib/encryption";
import { parseLimit } from "@/lib/validation";

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

    const hasMore = responses.length > limit;
    const items = responses.slice(0, limit);

    const consultations: TimelineConsultation[] = items.map((response) => {
      const session = response.session;
      // Decrypt message content (backwards compatible)
      const rawQuestion = session.messages[0]?.content || "";
      const question = decryptMessage(rawQuestion, session.userId);
      const answer = decryptMessage(response.content, session.userId);

      return {
        id: response.id,
        sessionId: session.id,
        title: session.title || null,
        question,
        answer,
        consultType: session.consultType,
        isAnonymous: session.isAnonymous,
        user: session.isAnonymous
          ? null
          : {
              handle: session.user.handle,
              displayName: session.user.profile?.displayName || null,
              avatarUrl: session.user.profile?.avatarUrl || null,
            },
        replyCount: 0,
        replies: [],
        createdAt: response.createdAt,
        isUserResponse: true, // このアイテムはユーザーの回答
        responder: response.isAnonymous
          ? null
          : {
              handle: user.handle,
              displayName: user.profile?.displayName || null,
              avatarUrl: user.profile?.avatarUrl || null,
            },
      };
    });

    const responseData: TimelineResponse = {
      consultations,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };

    return NextResponse.json({
      ...responseData,
      user: {
        handle: user.handle,
        displayName: user.profile?.displayName || null,
        avatarUrl: user.profile?.avatarUrl || null,
      },
    });
  } catch (error) {
    logger.error("Get user responses error", { handle: decodedHandle }, error);
    return ErrorResponses.internalError();
  }
}
