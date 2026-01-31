import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  getEconomyConfig,
  getEquilibriumBalance,
  getTodayRewardEarned,
  getRemainingRewardCapacity,
  processDailyEconomy,
} from "@/lib/economy";
import { authenticateRequest, ErrorResponses } from "@/lib/api-helpers";

/**
 * GET /api/economy - 経済パラメータと現在の状態を取得
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  try {
    const config = await getEconomyConfig();
    const equilibriumBalance = await getEquilibriumBalance();

    let personalStatus = null;
    if (payload.walletId) {
      const todayRewardEarned = await getTodayRewardEarned(payload.walletId);
      const remainingRewardCapacity = await getRemainingRewardCapacity(
        payload.walletId
      );

      personalStatus = {
        todayRewardEarned,
        remainingRewardCapacity,
      };
    }

    return NextResponse.json({
      config: {
        dailyGrantAmount: config.dailyGrantAmount,
        decayRatePercent: config.decayRatePercent,
        aiConsultCost: config.aiConsultCost,
        humanConsultCost: config.humanConsultCost,
        responseReward: config.responseReward,
        dailyRewardCap: config.dailyRewardCap,
        initialBalance: config.initialBalance,
        maxBalance: config.maxBalance,
      },
      equilibriumBalance,
      personalStatus,
    });
  } catch (error) {
    logger.error("Get economy config error:", {}, error);
    return ErrorResponses.internalError();
  }
}

/**
 * POST /api/economy - 日次経済処理を手動実行（BI付与・減衰）
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  if (!payload.walletId) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  try {
    const result = await processDailyEconomy(payload.walletId);

    return NextResponse.json({
      success: true,
      grant: result.grant,
      decay: result.decay,
      finalBalance: result.finalBalance,
    });
  } catch (error) {
    logger.error("Process daily economy error:", {}, error);
    return ErrorResponses.internalError();
  }
}
