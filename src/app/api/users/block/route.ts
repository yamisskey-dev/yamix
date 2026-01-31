import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";

// POST /api/users/block - Block a user
export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { blockedUserId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/users/block - Get all blocked users
export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
