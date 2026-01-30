import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { processDailyEconomy, getEquilibriumBalance } from "@/lib/economy";
import { logger } from "@/lib/logger";

// GET /api/wallets - Get current user's wallet (single wallet per user)
// 日次経済処理（BI付与・減衰）を自動実行
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
    if (isPrismaAvailable() && prisma) {
      // まずウォレットを取得
      let wallet = await prisma.wallet.findUnique({
        where: { userId: payload.userId },
        include: {
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

      // 日次経済処理を実行（減衰 → BI付与）
      const economyResult = await processDailyEconomy(wallet.id);

      // 処理後のウォレットを再取得
      if (economyResult.grant.granted || economyResult.decay.applied) {
        wallet = await prisma.wallet.findUnique({
          where: { userId: payload.userId },
          include: {
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
      }

      // 均衡残高も返す
      const equilibriumBalance = await getEquilibriumBalance();

      return NextResponse.json({
        ...wallet,
        economy: {
          equilibriumBalance,
          todayGrant: economyResult.grant,
          todayDecay: economyResult.decay,
        },
      });
    } else {
      const wallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.userId === payload.userId
      );

      if (!wallet) {
        return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
      }

      return NextResponse.json(wallet);
    }
  } catch (error) {
    logger.error("Get wallet error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
