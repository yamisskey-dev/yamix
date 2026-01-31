import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, parseJsonBody, ErrorResponses } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

// POST /api/users/block - Block a user
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  if (checkRateLimit(`block:${payload.userId}`, RateLimits.GENERAL)) {
    return ErrorResponses.rateLimitExceeded();
  }

  const bodyResult = await parseJsonBody<{ blockedUserId: string }>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

  if (!body.blockedUserId || typeof body.blockedUserId !== "string") {
    return NextResponse.json({ error: "blockedUserId is required" }, { status: 400 });
  }

  // Cannot block yourself
  if (body.blockedUserId === payload.userId) {
    return NextResponse.json(
      { error: "自分自身をブロックすることはできません" },
      { status: 400 }
    );
  }

  try {
    // Check if blocked user exists
    const blockedUser = await prisma.user.findUnique({
      where: { id: body.blockedUserId },
    });

    if (!blockedUser) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // Create or get existing block
    const block = await prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: payload.userId,
          blockedId: body.blockedUserId,
        },
      },
      create: {
        blockerId: payload.userId,
        blockedId: body.blockedUserId,
      },
      update: {}, // No updates needed if already exists
    });

    return NextResponse.json({
      success: true,
      block,
    });
  } catch (error) {
    logger.error("Block user error", { blockedUserId: body.blockedUserId }, error);
    return ErrorResponses.internalError();
  }
}

// GET /api/users/block - Get all blocked users
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  try {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: payload.userId },
      include: {
        blocked: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      blocks: blocks.map((block) => ({
        id: block.id,
        blockedUser: {
          id: block.blocked.id,
          handle: block.blocked.handle,
          displayName: block.blocked.profile?.displayName || null,
          avatarUrl: block.blocked.profile?.avatarUrl || null,
        },
        createdAt: block.createdAt,
      })),
    });
  } catch (error) {
    logger.error("Get blocks error", {}, error);
    return ErrorResponses.internalError();
  }
}
