import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 承認経済（Validation Economy）パラメータ設定
// 詳細: docs/TOKEN_ECONOMY.md
const economyDefaults = [
  // ベーシックインカム（BI）
  {
    key: "DAILY_GRANT_AMOUNT",
    value: 10,
    description: "毎日のBI付与量",
  },

  // 減衰（Demurrage）
  {
    key: "DECAY_RATE_PERCENT",
    value: 20,
    description: "日次減衰率（%）- 均衡残高 = BI ÷ 減衰率",
  },

  // 相談コスト
  {
    key: "AI_CONSULT_COST",
    value: 1,
    description: "AI相談1回あたりのコスト",
  },
  {
    key: "HUMAN_CONSULT_COST",
    value: 5,
    description: "人間相談1回あたりのコスト",
  },

  // 報酬
  {
    key: "RESPONSE_REWARD",
    value: 3,
    description: "人間の回答に対する報酬",
  },
  {
    key: "DAILY_REWARD_CAP",
    value: 15,
    description: "1日あたりの報酬獲得上限",
  },

  // 制約
  {
    key: "INITIAL_BALANCE",
    value: 10,
    description: "新規ユーザーの初期残高",
  },
  {
    key: "MAX_BALANCE",
    value: 100,
    description: "残高の上限（均衡残高の2倍）",
  },
];

async function main() {
  console.log("Seeding economy config (Validation Economy)...");
  console.log("See: docs/TOKEN_ECONOMY.md\n");

  for (const config of economyDefaults) {
    await prisma.economyConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config,
    });
    console.log(`  ✓ ${config.key}: ${config.value}`);
  }

  // 均衡残高の計算を表示
  const dailyGrant = economyDefaults.find(
    (c) => c.key === "DAILY_GRANT_AMOUNT"
  )?.value;
  const decayRate = economyDefaults.find(
    (c) => c.key === "DECAY_RATE_PERCENT"
  )?.value;
  if (dailyGrant && decayRate) {
    const equilibrium = dailyGrant / (decayRate / 100);
    console.log(`\n  → 均衡残高: ${equilibrium} (= ${dailyGrant} / ${decayRate}%)`);
  }

  console.log("\nSeed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
