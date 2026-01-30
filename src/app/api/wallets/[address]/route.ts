import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ address: string }>;
}

// GET /api/wallets/[address] - Get wallet by address (public)
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { address } = await params;

  try {
    if (isPrismaAvailable() && prisma) {
      const wallet = await prisma.wallet.findUnique({
        where: { address },
        include: {
          user: {
            include: {
              profile: {
                select: {
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              posts: true,
            },
          },
        },
      });

      if (!wallet) {
        return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
      }

      // Return wallet with user profile info
      return NextResponse.json({
        id: wallet.id,
        address: wallet.address,
        balance: wallet.balance,
        walletType: wallet.walletType,
        createdAt: wallet.createdAt,
        displayName: wallet.user?.profile?.displayName || null,
        avatarUrl: wallet.user?.profile?.avatarUrl || null,
        _count: wallet._count,
      });
    } else {
      // In-memory fallback - find by address
      const wallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.address === address
      );

      if (!wallet) {
        return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
      }

      // Get user profile if exists
      const profile = wallet.userId ? memoryDB.profiles.get(wallet.userId) : null;

      return NextResponse.json({
        id: wallet.id,
        address: wallet.address,
        balance: wallet.balance,
        walletType: wallet.walletType,
        createdAt: wallet.createdAt,
        displayName: profile?.displayName || null,
        avatarUrl: profile?.avatarUrl || null,
      });
    }
  } catch (error) {
    logger.error("Get wallet error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
