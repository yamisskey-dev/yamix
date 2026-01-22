import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// YAMI経済パラメータ設定
// YAMI_ECONOMY.md に基づく初期値
const economyDefaults = [
  {
    key: "DAILY_GRANT_AMOUNT",
    value: 3,
    description: "毎日の無料YAMI付与量",
  },
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
  {
    key: "RESPONSE_REWARD",
    value: 4,
    description: "人間の回答に対する報酬",
  },
  {
    key: "INITIAL_BALANCE",
    value: 10,
    description: "新規ユーザーの初期YAMI残高",
  },
  {
    key: "MAX_BALANCE",
    value: 1000,
    description: "YAMI残高の上限（BCC参考）",
  },
];

async function main() {
  console.log("Seeding economy config...");

  for (const config of economyDefaults) {
    await prisma.economyConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config,
    });
    console.log(`  ✓ ${config.key}: ${config.value}`);
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
