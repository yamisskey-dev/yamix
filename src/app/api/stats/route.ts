import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, ErrorResponses } from "@/lib/api-helpers";
import { getUserStats } from "@/lib/stats";
import { logger } from "@/lib/logger";

/**
 * GET /api/stats - ユーザーの使用統計と依存度を取得
 *
 * レスポンス例:
 * {
 *   "walletId": "xxx",
 *   "currentBalance": 45,
 *   "equilibriumBalance": 50,
 *   "balanceRatio": 0.9,
 *   "dependency": {
 *     "level": "MODERATE",
 *     "score": 35,
 *     "label": "適度",
 *     "description": "AIを適度に活用しています..."
 *   },
 *   "today": { ... },
 *   "week": { ... },
 *   "month": { ... },
 *   "trend": { "direction": "STABLE", "weekOverWeekChange": 5 }
 * }
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const walletId = payload.walletId;

  if (!walletId) {
    return NextResponse.json({ error: "No wallet found" }, { status: 400 });
  }

  try {
    const stats = await getUserStats(walletId);

    if (!stats) {
      return NextResponse.json(
        { error: "Could not retrieve stats" },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    logger.error("Get stats error:", {}, error);
    return ErrorResponses.internalError();
  }
}
