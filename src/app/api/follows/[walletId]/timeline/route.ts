import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";

interface RouteParams {
  params: Promise<{ walletId: string }>;
}

// GET /api/follows/[walletId]/timeline - Get home timeline (only own wallet)
export async function GET(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { walletId } = await params;

  // Verify the wallet belongs to the authenticated user
  if (walletId !== payload.walletId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    if (isPrismaAvailable() && prisma) {
      // Get followed wallet IDs
      const follows = await prisma.follow.findMany({
        where: { followerId: walletId },
        select: { targetId: true },
      });

      const followedIds = follows.map((f) => f.targetId);

      // Include own posts in timeline
      const timelineWalletIds = [...followedIds, walletId];

      // Get posts from followed wallets and own
      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where: {
            walletId: { in: timelineWalletIds },
            parentId: null, // Only top-level posts
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            wallet: {
              select: {
                id: true,
                address: true,
                walletType: true,
              },
            },
            _count: {
              select: {
                transactions: true,
                replies: true,
              },
            },
          },
        }),
        prisma.post.count({
          where: {
            walletId: { in: timelineWalletIds },
            parentId: null,
          },
        }),
      ]);

      return NextResponse.json({
        posts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      // In-memory fallback
      const follows = Array.from(memoryDB.follows.values()).filter(
        (f) => f.followerId === walletId
      );

      const followedIds = follows.map((f) => f.targetId);
      const timelineWalletIds = [...followedIds, walletId];

      const allPosts = Array.from(memoryDB.posts.values())
        .filter(
          (p) => timelineWalletIds.includes(p.walletId) && p.parentId === null
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = allPosts.length;
      const posts = allPosts.slice((page - 1) * limit, page * limit).map((p) => {
        const wallet = Array.from(memoryDB.wallets.values()).find(
          (w) => w.id === p.walletId
        );
        return {
          ...p,
          wallet: wallet
            ? {
                id: wallet.id,
                address: wallet.address,
                walletType: wallet.walletType,
              }
            : null,
        };
      });

      return NextResponse.json({
        posts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }
  } catch (error) {
    console.error("Get timeline error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
