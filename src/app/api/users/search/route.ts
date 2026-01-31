import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, ErrorResponses } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

// GET /api/users/search?q=username - Search users by handle prefix
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

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
    const users = await prisma.user.findMany({
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
      users: users.map((u: typeof users[number]) => ({
        id: u.id,
        handle: u.handle,
        displayName: u.profile?.displayName || null,
        avatarUrl: u.profile?.avatarUrl || null,
      })),
    });
  } catch (error) {
    logger.error("User search error", { query }, error);
    return ErrorResponses.internalError();
  }
}
