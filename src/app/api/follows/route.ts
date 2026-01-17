import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB, generateId } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";

// POST /api/follows - Follow a wallet
export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { followerId?: string; targetAddress?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { followerId, targetAddress } = body;

  if (!followerId || !targetAddress) {
    return NextResponse.json(
      { error: "followerId and targetAddress are required" },
      { status: 400 }
    );
  }

  try {
    if (isPrismaAvailable() && prisma) {
      // Verify follower wallet exists and belongs to user
      const followerWallet = await prisma.wallet.findUnique({
        where: { id: followerId },
      });

      if (!followerWallet) {
        return NextResponse.json(
          { error: "Follower wallet not found" },
          { status: 400 }
        );
      }

      if (followerWallet.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      // Find target wallet by address
      const targetWallet = await prisma.wallet.findUnique({
        where: { address: targetAddress },
      });

      if (!targetWallet) {
        return NextResponse.json(
          { error: "Target wallet not found" },
          { status: 404 }
        );
      }

      // Cannot follow yourself
      if (followerId === targetWallet.id) {
        return NextResponse.json(
          { error: "Cannot follow yourself" },
          { status: 400 }
        );
      }

      // Check if already following
      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_targetId: {
            followerId,
            targetId: targetWallet.id,
          },
        },
      });

      if (existingFollow) {
        return NextResponse.json(
          { error: "Already following this wallet" },
          { status: 400 }
        );
      }

      // Create follow
      const follow = await prisma.follow.create({
        data: {
          followerId,
          targetId: targetWallet.id,
        },
      });

      return NextResponse.json(follow, { status: 201 });
    } else {
      // In-memory fallback
      const followerWallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.id === followerId
      );

      if (!followerWallet) {
        return NextResponse.json(
          { error: "Follower wallet not found" },
          { status: 400 }
        );
      }

      if (followerWallet.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const targetWallet = memoryDB.wallets.get(targetAddress);
      if (!targetWallet) {
        return NextResponse.json(
          { error: "Target wallet not found" },
          { status: 404 }
        );
      }

      if (followerId === targetWallet.id) {
        return NextResponse.json(
          { error: "Cannot follow yourself" },
          { status: 400 }
        );
      }

      const existingFollow = Array.from(memoryDB.follows.values()).find(
        (f) => f.followerId === followerId && f.targetId === targetWallet.id
      );

      if (existingFollow) {
        return NextResponse.json(
          { error: "Already following this wallet" },
          { status: 400 }
        );
      }

      const follow = {
        id: generateId(),
        followerId,
        targetId: targetWallet.id,
        createdAt: new Date(),
      };

      memoryDB.follows.set(follow.id, follow);
      return NextResponse.json(follow, { status: 201 });
    }
  } catch (error) {
    console.error("Create follow error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/follows - Unfollow a wallet
export async function DELETE(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { followerId?: string; targetAddress?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { followerId, targetAddress } = body;

  if (!followerId || !targetAddress) {
    return NextResponse.json(
      { error: "followerId and targetAddress are required" },
      { status: 400 }
    );
  }

  try {
    if (isPrismaAvailable() && prisma) {
      // Verify follower wallet belongs to user
      const followerWallet = await prisma.wallet.findUnique({
        where: { id: followerId },
      });

      if (!followerWallet || followerWallet.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      // Find target wallet by address
      const targetWallet = await prisma.wallet.findUnique({
        where: { address: targetAddress },
      });

      if (!targetWallet) {
        return NextResponse.json(
          { error: "Target wallet not found" },
          { status: 404 }
        );
      }

      // Delete follow
      try {
        await prisma.follow.delete({
          where: {
            followerId_targetId: {
              followerId,
              targetId: targetWallet.id,
            },
          },
        });
      } catch {
        return NextResponse.json({ error: "Follow not found" }, { status: 404 });
      }

      return new NextResponse(null, { status: 204 });
    } else {
      // In-memory fallback
      const followerWallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.id === followerId
      );

      if (!followerWallet || followerWallet.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const targetWallet = memoryDB.wallets.get(targetAddress);
      if (!targetWallet) {
        return NextResponse.json(
          { error: "Target wallet not found" },
          { status: 404 }
        );
      }

      const followKey = Array.from(memoryDB.follows.entries()).find(
        ([, f]) => f.followerId === followerId && f.targetId === targetWallet.id
      )?.[0];

      if (!followKey) {
        return NextResponse.json({ error: "Follow not found" }, { status: 404 });
      }

      memoryDB.follows.delete(followKey);
      return new NextResponse(null, { status: 204 });
    }
  } catch (error) {
    console.error("Delete follow error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
