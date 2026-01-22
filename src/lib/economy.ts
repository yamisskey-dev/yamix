/**
 * Validation Economy（承認経済）サービス
 * 詳細: docs/TOKEN_ECONOMY.md
 */

import { getPrismaClient, isPrismaAvailable } from "./prisma";
import { VALIDATION_ECONOMY } from "@/types";

// ============================================
// 経済パラメータの取得
// ============================================

interface EconomyConfig {
  dailyGrantAmount: number;
  decayRatePercent: number;
  aiConsultCost: number;
  humanConsultCost: number;
  responseReward: number;
  dailyRewardCap: number;
  initialBalance: number;
  maxBalance: number;
}

/**
 * EconomyConfigテーブルからパラメータを取得
 * 存在しない場合はデフォルト値を使用
 */
export async function getEconomyConfig(): Promise<EconomyConfig> {
  if (!isPrismaAvailable()) {
    return getDefaultConfig();
  }

  const prisma = getPrismaClient()!;
  const configs = await prisma.economyConfig.findMany();
  const configMap = new Map(configs.map((c) => [c.key, c.value]));

  return {
    dailyGrantAmount:
      configMap.get("DAILY_GRANT_AMOUNT") ?? VALIDATION_ECONOMY.DAILY_GRANT_AMOUNT,
    decayRatePercent:
      configMap.get("DECAY_RATE_PERCENT") ?? VALIDATION_ECONOMY.DECAY_RATE_PERCENT,
    aiConsultCost:
      configMap.get("AI_CONSULT_COST") ?? VALIDATION_ECONOMY.AI_CONSULT_COST,
    humanConsultCost:
      configMap.get("HUMAN_CONSULT_COST") ?? VALIDATION_ECONOMY.HUMAN_CONSULT_COST,
    responseReward:
      configMap.get("RESPONSE_REWARD") ?? VALIDATION_ECONOMY.RESPONSE_REWARD,
    dailyRewardCap:
      configMap.get("DAILY_REWARD_CAP") ?? VALIDATION_ECONOMY.DAILY_REWARD_CAP,
    initialBalance:
      configMap.get("INITIAL_BALANCE") ?? VALIDATION_ECONOMY.INITIAL_BALANCE,
    maxBalance:
      configMap.get("MAX_BALANCE") ?? VALIDATION_ECONOMY.MAX_BALANCE,
  };
}

function getDefaultConfig(): EconomyConfig {
  return {
    dailyGrantAmount: VALIDATION_ECONOMY.DAILY_GRANT_AMOUNT,
    decayRatePercent: VALIDATION_ECONOMY.DECAY_RATE_PERCENT,
    aiConsultCost: VALIDATION_ECONOMY.AI_CONSULT_COST,
    humanConsultCost: VALIDATION_ECONOMY.HUMAN_CONSULT_COST,
    responseReward: VALIDATION_ECONOMY.RESPONSE_REWARD,
    dailyRewardCap: VALIDATION_ECONOMY.DAILY_REWARD_CAP,
    initialBalance: VALIDATION_ECONOMY.INITIAL_BALANCE,
    maxBalance: VALIDATION_ECONOMY.MAX_BALANCE,
  };
}

// ============================================
// BI付与（Daily Grant）
// ============================================

interface GrantResult {
  granted: boolean;
  amount: number;
  newBalance: number;
  message: string;
}

/**
 * ユーザーに毎日のBI（ベーシックインカム）を付与
 * 1日1回のみ付与可能
 */
export async function applyDailyGrant(walletId: string): Promise<GrantResult> {
  if (!isPrismaAvailable()) {
    return {
      granted: false,
      amount: 0,
      newBalance: 0,
      message: "Database unavailable",
    };
  }

  const prisma = getPrismaClient()!;
  const config = await getEconomyConfig();

  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    return {
      granted: false,
      amount: 0,
      newBalance: 0,
      message: "Wallet not found",
    };
  }

  // 今日すでに付与済みかチェック
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (wallet.lastDailyGrantAt && wallet.lastDailyGrantAt >= today) {
    return {
      granted: false,
      amount: 0,
      newBalance: wallet.balance,
      message: "Already granted today",
    };
  }

  // 残高上限チェック
  const newBalance = Math.min(
    wallet.balance + config.dailyGrantAmount,
    config.maxBalance
  );
  const actualGrant = newBalance - wallet.balance;

  if (actualGrant <= 0) {
    return {
      granted: false,
      amount: 0,
      newBalance: wallet.balance,
      message: "Balance at maximum",
    };
  }

  // トランザクションで付与
  const result = await prisma.$transaction(async (tx) => {
    // ウォレット更新
    const updated = await tx.wallet.update({
      where: { id: walletId },
      data: {
        balance: newBalance,
        lastDailyGrantAt: new Date(),
      },
    });

    // トランザクション記録
    await tx.transaction.create({
      data: {
        senderId: walletId,
        amount: actualGrant,
        txType: "DAILY_GRANT",
      },
    });

    return updated;
  });

  return {
    granted: true,
    amount: actualGrant,
    newBalance: result.balance,
    message: `Granted ${actualGrant} tokens`,
  };
}

// ============================================
// 減衰（Decay / Demurrage）
// ============================================

interface DecayResult {
  applied: boolean;
  decayAmount: number;
  newBalance: number;
  message: string;
}

/**
 * ユーザーの残高に減衰を適用
 * 1日1回のみ適用
 *
 * 計算式: newBalance = balance * (1 - decayRate)
 * 例: decayRate=20% → balance * 0.8
 */
export async function applyDecay(walletId: string): Promise<DecayResult> {
  if (!isPrismaAvailable()) {
    return {
      applied: false,
      decayAmount: 0,
      newBalance: 0,
      message: "Database unavailable",
    };
  }

  const prisma = getPrismaClient()!;
  const config = await getEconomyConfig();

  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    return {
      applied: false,
      decayAmount: 0,
      newBalance: 0,
      message: "Wallet not found",
    };
  }

  // 今日すでに適用済みかチェック
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (wallet.lastDecayAt && wallet.lastDecayAt >= today) {
    return {
      applied: false,
      decayAmount: 0,
      newBalance: wallet.balance,
      message: "Already decayed today",
    };
  }

  // 減衰計算（小数点以下切り捨て）
  const decayRate = config.decayRatePercent / 100;
  const decayAmount = Math.floor(wallet.balance * decayRate);

  if (decayAmount <= 0) {
    // 残高が少なすぎて減衰なし → 記録だけ更新
    await prisma.wallet.update({
      where: { id: walletId },
      data: { lastDecayAt: new Date() },
    });

    return {
      applied: false,
      decayAmount: 0,
      newBalance: wallet.balance,
      message: "Balance too low for decay",
    };
  }

  const newBalanceAfterDecay = wallet.balance - decayAmount;

  // トランザクションで減衰適用
  const result = await prisma.$transaction(async (tx) => {
    // ウォレット更新
    const updated = await tx.wallet.update({
      where: { id: walletId },
      data: {
        balance: newBalanceAfterDecay,
        lastDecayAt: new Date(),
      },
    });

    // トランザクション記録（負の値として記録）
    await tx.transaction.create({
      data: {
        senderId: walletId,
        amount: -decayAmount,
        txType: "DECAY",
      },
    });

    return updated;
  });

  return {
    applied: true,
    decayAmount,
    newBalance: result.balance,
    message: `Decayed ${decayAmount} tokens (${config.decayRatePercent}%)`,
  };
}

// ============================================
// 日次処理（BI付与 + 減衰）
// ============================================

interface DailyProcessResult {
  grant: GrantResult;
  decay: DecayResult;
  finalBalance: number;
}

/**
 * 日次処理を実行（減衰 → BI付与の順）
 * ログイン時やAPIアクセス時に呼び出す
 */
export async function processDailyEconomy(
  walletId: string
): Promise<DailyProcessResult> {
  // 1. まず減衰を適用
  const decay = await applyDecay(walletId);

  // 2. 次にBI付与
  const grant = await applyDailyGrant(walletId);

  return {
    grant,
    decay,
    finalBalance: grant.newBalance,
  };
}

// ============================================
// 報酬上限チェック
// ============================================

/**
 * 今日すでに獲得した報酬額を取得
 */
export async function getTodayRewardEarned(walletId: string): Promise<number> {
  if (!isPrismaAvailable()) {
    return 0;
  }

  const prisma = getPrismaClient()!;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.transaction.aggregate({
    where: {
      senderId: walletId,
      txType: "RESPONSE_REWARD",
      createdAt: { gte: today },
      amount: { gt: 0 }, // 報酬のみ（受け取り側）
    },
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

/**
 * 報酬付与可能な残り額を取得
 */
export async function getRemainingRewardCapacity(
  walletId: string
): Promise<number> {
  const config = await getEconomyConfig();
  const earned = await getTodayRewardEarned(walletId);
  return Math.max(0, config.dailyRewardCap - earned);
}

// ============================================
// 均衡残高の計算
// ============================================

/**
 * 均衡残高を計算
 * 何もしなければこの値に収束する
 */
export async function getEquilibriumBalance(): Promise<number> {
  const config = await getEconomyConfig();
  return config.dailyGrantAmount / (config.decayRatePercent / 100);
}

// ============================================
// 相談コストの取得
// ============================================

export type ConsultTarget = "AI" | "HUMAN" | "ANY";

/**
 * 相談対象に応じたコストを取得
 */
export async function getConsultCost(target: ConsultTarget): Promise<number> {
  const config = await getEconomyConfig();

  switch (target) {
    case "AI":
      return config.aiConsultCost;
    case "HUMAN":
      return config.humanConsultCost;
    case "ANY":
      // ANY は人間相談の60%くらい
      return Math.ceil((config.humanConsultCost + config.aiConsultCost) / 2);
    default:
      return config.aiConsultCost;
  }
}

/**
 * 回答報酬を取得（上限考慮）
 */
export async function getResponseReward(
  responderWalletId: string
): Promise<number> {
  const config = await getEconomyConfig();
  const remaining = await getRemainingRewardCapacity(responderWalletId);
  return Math.min(config.responseReward, remaining);
}
