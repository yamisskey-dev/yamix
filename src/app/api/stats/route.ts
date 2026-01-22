import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { getUserStats } from "@/lib/stats";
import { prisma, isPrismaAvailable } from "@/lib/prisma";

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
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const walletId = payload.walletId;

  if (!walletId) {
    return NextResponse.json({ error: "No wallet found" }, { status: 400 });
  }

  try {
    if (!isPrismaAvailable() || !prisma) {
      // Prisma未接続時はデフォルト値を返す
      return NextResponse.json({
        walletId: walletId,
        currentBalance: 10,
        equilibriumBalance: 50,
        balanceRatio: 0.2,
        dependency: {
          level: "LOW",
          score: 0,
          label: "低依存",
          description: "データベースに接続していないため、統計を取得できません。",
        },
        today: {
          aiConsults: 0,
          humanConsults: 0,
          totalConsults: 0,
          tokensSpent: 0,
          tokensEarned: 0,
          netTokens: 0,
        },
        week: {
          aiConsults: 0,
          humanConsults: 0,
          totalConsults: 0,
          tokensSpent: 0,
          tokensEarned: 0,
          netTokens: 0,
        },
        month: {
          aiConsults: 0,
          humanConsults: 0,
          totalConsults: 0,
          tokensSpent: 0,
          tokensEarned: 0,
          netTokens: 0,
        },
        trend: {
          direction: "STABLE",
          weekOverWeekChange: 0,
        },
      });
    }

    const stats = await getUserStats(walletId);

    if (!stats) {
      return NextResponse.json(
        { error: "Could not retrieve stats" },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Get stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
