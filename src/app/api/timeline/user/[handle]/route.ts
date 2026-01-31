import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import type { TimelineConsultation, TimelineResponse } from "@/types";
import { decryptMessage } from "@/lib/encryption";
import { parseLimit } from "@/lib/validation";

// Prisma結果の型
interface PrismaUser {
  id: string;
  handle: string;
  profile: { displayName: string | null; avatarUrl: string | null } | null;
}

interface PrismaSessionWithMessages {
  id: string;
  consultType: "PRIVATE" | "PUBLIC";
  isAnonymous: boolean;
  createdAt: Date;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

interface RouteParams {
  params: Promise<{ handle: string }>;
}

// GET /api/timeline/user/[handle] - Get user's consultations (public only, or all if viewing own profile)
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { handle } = await params;
  const decodedHandle = decodeURIComponent(handle);

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor");

  try {
    // Check if the viewer is authenticated and viewing their own profile
    const token = getTokenFromCookie(req.headers.get("cookie"));
    let currentUserId: string | null = null;
    if (token) {
      const payload = await verifyJWT(token);
      if (payload) {
        currentUserId = payload.userId;
      }
    }

    // Find user by handle
    const user = await prisma.user.findUnique({
      where: { handle: decodedHandle },
      include: { profile: true },
    }) as PrismaUser | null;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if viewing own profile
    const isOwnProfile = currentUserId === user.id;

    // Get user's sessions (public only, or all if own profile)
    const sessions = await prisma.chatSession.findMany({
      where: {
        userId: user.id,
        ...(isOwnProfile ? {} : { consultType: "PUBLIC", isAnonymous: false }), // 公開相談のみ、かつ匿名でない（自分のプロフィールでは全て表示）
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true,
        consultType: true,
        isAnonymous: true,
        createdAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          take: 2,
          select: {
            role: true,
            content: true,
          },
        },
      },
    }) as PrismaSessionWithMessages[];

    const hasMore = sessions.length > limit;
    const items = sessions.slice(0, limit);

    const consultations: TimelineConsultation[] = items
      .filter((s) => s.messages.length >= 1) // PUBLIC相談は質問のみでもOK
      .map((s) => {
        const userMsg = s.messages.find((m) => m.role === "USER");
        const assistantMsg = s.messages.find((m) => m.role === "ASSISTANT");

        // Decrypt message content (backwards compatible)
        const question = userMsg?.content
          ? decryptMessage(userMsg.content, user.id)
          : "";
        const answer = assistantMsg?.content
          ? decryptMessage(assistantMsg.content, user.id)
          : null;

        return {
          id: s.id,
          sessionId: s.id,
          question,
          answer, // PUBLIC相談ではnullの場合あり
          consultType: s.consultType,
          isAnonymous: s.isAnonymous,
          user: s.isAnonymous ? null : { // 匿名の場合はnull
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
        id: user.id,
        handle: user.handle,
        displayName: user.profile?.displayName || null,
        avatarUrl: user.profile?.avatarUrl || null,
      },
    });
  } catch (error) {
    logger.error("Get user timeline error", { handle: decodedHandle }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
