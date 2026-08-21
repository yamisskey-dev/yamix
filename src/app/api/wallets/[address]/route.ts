import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { authenticateRequest } from "@/lib/api-helpers";

interface RouteParams {
  params: Promise<{ address: string }>;
}

// GET /api/wallets/[address] - Get wallet by address (requires auth)
export async function GET(req: NextRequest, { params }: RouteParams) {
  // SECURITY: 残高は財務情報のため未認証アクセスを許可しない
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  const { address } = await params;

  try {
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
  } catch (error) {
    logger.error("Get wallet error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
