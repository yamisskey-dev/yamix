/**
 * User Stats（ユーザー統計）サービス
 * 依存度（Dependency Level）の計算とユーザー使用状況の提供
 */

import { prisma } from "./prisma";
import { getEconomyConfig, getEquilibriumBalance } from "./economy";

// ============================================
// 依存度レベル定義
// ============================================

export type DependencyLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

export interface DependencyInfo {
  level: DependencyLevel;
  score: number; // 0-100
  label: string;
  description: string;
}

// ============================================
// ユーザー統計型定義
// ============================================

export interface UserStats {
  // 基本情報
  walletId: string;
  currentBalance: number;
  equilibriumBalance: number;
  balanceRatio: number; // currentBalance / equilibriumBalance

  // 依存度
  dependency: DependencyInfo;

  // 期間別統計
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;

  // トレンド
  trend: UsageTrend;
}

export interface PeriodStats {
  aiConsults: number;
  humanConsults: number;
  totalConsults: number;
  tokensSpent: number;
  tokensEarned: number;
  netTokens: number;
}

export interface UsageTrend {
  direction: "INCREASING" | "STABLE" | "DECREASING";
  weekOverWeekChange: number; // percentage
}

// ============================================
// 依存度計算
// ============================================

function calculateDependencyLevel(score: number): DependencyInfo {
  if (score <= 25) {
    return {
      level: "LOW",
      score,
      label: "低依存",
      description: "AIへの依存度は低いです。バランスの取れた利用状況です。",
    };
  } else if (score <= 50) {
    return {
      level: "MODERATE",
      score,
      label: "適度",
      description: "AIを適度に活用しています。健全な利用パターンです。",
    };
  } else if (score <= 75) {
    return {
      level: "HIGH",
      score,
      label: "高依存",
      description: "AIへの依存度が高めです。人間との相談も検討してみてください。",
    };
  } else {
    return {
      level: "VERY_HIGH",
      score,
      label: "非常に高い",
      description: "AIへの依存度が非常に高いです。休息を取ることをお勧めします。",
    };
  }
}

/**
 * 依存度スコアを計算
 * 複数の要素から総合的に算出
 */
function computeDependencyScore(
  stats: {
    todayConsults: number;
    weekConsults: number;
    aiRatio: number; // AI相談の割合 (0-1)
    balanceRatio: number; // 残高/均衡残高 (0-2)
    consecutiveDays: number; // 連続使用日数
  }
): number {
  // 要素ごとの重み付け
  const weights = {
    frequency: 0.3, // 使用頻度
    aiPreference: 0.25, // AI偏重度
    balanceHealth: 0.25, // 残高の健全性
    consistency: 0.2, // 連続使用
  };

  // 使用頻度スコア (週10回以上で100点)
  const frequencyScore = Math.min(100, (stats.weekConsults / 10) * 100);

  // AI偏重度 (AI相談が100%だと100点)
  const aiPreferenceScore = stats.aiRatio * 100;

  // 残高健全性 (残高が少ないほど高依存)
  // 均衡残高の50%以下だと危険域
  const balanceHealthScore =
    stats.balanceRatio >= 1
      ? 0
      : stats.balanceRatio >= 0.5
        ? (1 - stats.balanceRatio) * 100
        : 50 + (0.5 - stats.balanceRatio) * 100;

  // 連続使用スコア (7日連続で100点)
  const consistencyScore = Math.min(100, (stats.consecutiveDays / 7) * 100);

  // 総合スコア計算
  const totalScore =
    frequencyScore * weights.frequency +
    aiPreferenceScore * weights.aiPreference +
    balanceHealthScore * weights.balanceHealth +
    consistencyScore * weights.consistency;

  return Math.round(Math.min(100, Math.max(0, totalScore)));
}

// ============================================
// 期間別統計の取得
// ============================================

async function getPeriodStats(
  walletId: string,
  startDate: Date
): Promise<PeriodStats> {
  const consultStats = await prisma.transaction.groupBy({
    by: ["txType"],
    where: {
      senderId: walletId,
      createdAt: { gte: startDate },
      txType: { in: ["CONSULT_AI", "CONSULT_HUMAN"] },
    },
    _count: true,
    _sum: { amount: true },
  });

  const rewardStats = await prisma.transaction.aggregate({
    where: {
      senderId: walletId,
      createdAt: { gte: startDate },
      txType: "RESPONSE_REWARD",
      amount: { gt: 0 },
    },
    _sum: { amount: true },
    _count: true,
  });

  const aiConsults =
    consultStats.find((s) => s.txType === "CONSULT_AI")?._count ?? 0;
  const humanConsults =
    consultStats.find((s) => s.txType === "CONSULT_HUMAN")?._count ?? 0;

  const aiCost =
    Math.abs(
      consultStats.find((s) => s.txType === "CONSULT_AI")?._sum.amount ?? 0
    );
  const humanCost =
    Math.abs(
      consultStats.find((s) => s.txType === "CONSULT_HUMAN")?._sum.amount ?? 0
    );

  const tokensEarned = rewardStats._sum.amount ?? 0;
  const tokensSpent = aiCost + humanCost;

  return {
    aiConsults,
    humanConsults,
    totalConsults: aiConsults + humanConsults,
    tokensSpent,
    tokensEarned,
    netTokens: tokensEarned - tokensSpent,
  };
}

// ============================================
// 連続使用日数の計算
// ============================================

async function getConsecutiveUsageDays(walletId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const transactions = await prisma.transaction.findMany({
    where: {
      senderId: walletId,
      createdAt: { gte: thirtyDaysAgo },
      txType: { in: ["CONSULT_AI", "CONSULT_HUMAN"] },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (transactions.length === 0) {
    return 0;
  }

  const usageDates = new Set<string>();
  for (const tx of transactions) {
    const dateStr = tx.createdAt.toISOString().split("T")[0];
    usageDates.add(dateStr);
  }

  let consecutiveDays = 0;
  const today = new Date();

  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = checkDate.toISOString().split("T")[0];

    if (usageDates.has(dateStr)) {
      consecutiveDays++;
    } else if (i > 0) {
      break;
    }
  }

  return consecutiveDays;
}

// ============================================
// トレンド計算
// ============================================

async function calculateTrend(walletId: string): Promise<UsageTrend> {
  const now = new Date();

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - 7);

  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(now.getDate() - 14);
  const lastWeekEnd = new Date(now);
  lastWeekEnd.setDate(now.getDate() - 7);

  const thisWeekStats = await getPeriodStats(walletId, thisWeekStart);
  const lastWeekStats = await getPeriodStats(walletId, lastWeekStart);

  const lastWeekConsults = lastWeekStats.totalConsults;
  const thisWeekConsults = thisWeekStats.totalConsults;

  if (lastWeekConsults === 0) {
    if (thisWeekConsults === 0) {
      return { direction: "STABLE", weekOverWeekChange: 0 };
    }
    return { direction: "INCREASING", weekOverWeekChange: 100 };
  }

  const changePercent =
    ((thisWeekConsults - lastWeekConsults) / lastWeekConsults) * 100;

  let direction: UsageTrend["direction"];
  if (changePercent > 20) {
    direction = "INCREASING";
  } else if (changePercent < -20) {
    direction = "DECREASING";
  } else {
    direction = "STABLE";
  }

  return {
    direction,
    weekOverWeekChange: Math.round(changePercent),
  };
}

// ============================================
// メイン関数: ユーザー統計の取得
// ============================================

export async function getUserStats(walletId: string): Promise<UserStats | null> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    return null;
  }

  const config = await getEconomyConfig();
  const equilibriumBalance = await getEquilibriumBalance();

  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const monthStart = new Date(now);
  monthStart.setMonth(now.getMonth() - 1);

  const [todayStats, weekStats, monthStats, consecutiveDays, trend] =
    await Promise.all([
      getPeriodStats(walletId, todayStart),
      getPeriodStats(walletId, weekStart),
      getPeriodStats(walletId, monthStart),
      getConsecutiveUsageDays(walletId),
      calculateTrend(walletId),
    ]);

  const totalConsults = weekStats.totalConsults;
  const aiRatio =
    totalConsults > 0 ? weekStats.aiConsults / totalConsults : 0;

  const balanceRatio = wallet.balance / equilibriumBalance;

  const dependencyScore = computeDependencyScore({
    todayConsults: todayStats.totalConsults,
    weekConsults: weekStats.totalConsults,
    aiRatio,
    balanceRatio,
    consecutiveDays,
  });

  const dependency = calculateDependencyLevel(dependencyScore);

  return {
    walletId,
    currentBalance: wallet.balance,
    equilibriumBalance,
    balanceRatio: Math.round(balanceRatio * 100) / 100,
    dependency,
    today: todayStats,
    week: weekStats,
    month: monthStats,
    trend,
  };
}
