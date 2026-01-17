import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ walletId: string }>;
}

// GET /api/follows/[walletId] - Get following list
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { walletId } = await params;

  try {
    if (isPrismaAvailable() && prisma) {
      const follows = await prisma.follow.findMany({
        where: { followerId: walletId },
        orderBy: { createdAt: "desc" },
      });

      const targetIds = follows.map((f) => f.targetId);
      const wallets = await prisma.wallet.findMany({
        where: { id: { in: targetIds } },
        select: {
          id: true,
          address: true,
          balance: true,
          walletType: true,
        },
      });

      return NextResponse.json(wallets);
    } else {
      // In-memory fallback
      const follows = Array.from(memoryDB.follows.values())
        .filter((f) => f.followerId === walletId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const targetIds = follows.map((f) => f.targetId);
      const wallets = Array.from(memoryDB.wallets.values())
        .filter((w) => targetIds.includes(w.id))
        .map((w) => ({
          id: w.id,
          address: w.address,
          balance: w.balance,
          walletType: w.walletType,
        }));

      return NextResponse.json(wallets);
    }
  } catch (error) {
    console.error("Get following error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
