import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

// GET /api/users/search?q=username - Search users by handle prefix
export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Rate limit
  const rateLimitKey = `user-search:${payload.userId}`;
  if (checkRateLimit(rateLimitKey, RateLimits.MESSAGE_SEND)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json({ users: [] });
  }

  try {
    const db = getPrismaClient();

    if (!db) {
      return NextResponse.json({ users: [] });
    }

    const users = await db.user.findMany({
      where: {
        AND: [
          { id: { not: payload.userId } },
          {
            OR: [
              { handle: { contains: query, mode: "insensitive" } },
              { account: { contains: query, mode: "insensitive" } },
            ],
          },
          // 指名相談を受け付けないユーザーを除外
          { profile: { allowDirectedConsult: true } },
        ],
      },
      take: 10,
      select: {
        id: true,
        handle: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        handle: u.handle,
        displayName: u.profile?.displayName || null,
        avatarUrl: u.profile?.avatarUrl || null,
      })),
    });
  } catch (error) {
    logger.error("User search error", { query }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
