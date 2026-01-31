import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, ErrorResponses } from "@/lib/api-helpers";
import { processDailyEconomy, getEquilibriumBalance } from "@/lib/economy";
import { logger } from "@/lib/logger";

// GET /api/wallets - Get current user's wallet (single wallet per user)
// 日次経済処理（BI付与・減衰）を自動実行
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  try {
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
  } catch (error) {
    logger.error("Get wallet error:", {}, error);
    return ErrorResponses.internalError();
  }
}
