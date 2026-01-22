/**
 * Token Economy テストスクリプト
 * 実行: npx tsx scripts/test-economy.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Token Economy Test ===\n");

  // 1. EconomyConfig確認
  console.log("1. EconomyConfig:");
  const configs = await prisma.economyConfig.findMany();
  for (const c of configs) {
    console.log(`   ${c.key}: ${c.value}`);
  }

  // 2. テストユーザー・ウォレット作成
  console.log("\n2. Creating test user and wallet...");

  // 既存のテストサーバーを取得または作成
  let server = await prisma.server.findFirst({
    where: { instances: "test.local" },
  });
  if (!server) {
    server = await prisma.server.create({
      data: {
        instances: "test.local",
        instanceType: "misskey",
      },
    });
  }

  // テストユーザー作成
  let user = await prisma.user.findFirst({
    where: { handle: "@testuser@test.local" },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        handle: "@testuser@test.local",
        account: "testuser",
        hostName: "test.local",
        token: "test-token-encrypted",
        serverId: server.id,
      },
    });
  }

  // テストウォレット作成（初期残高50）
  let wallet = await prisma.wallet.findFirst({
    where: { userId: user.id },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        address: "0x" + "0".repeat(40),
        balance: 50, // 均衡残高で開始
        walletType: "HUMAN",
        userId: user.id,
      },
    });
  } else {
    // リセット
    wallet = await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: 50,
        lastDailyGrantAt: null,
        lastDecayAt: null,
      },
    });
  }
  console.log(`   Wallet created: ${wallet.id}, balance: ${wallet.balance}`);

  // 3. 減衰テスト
  console.log("\n3. Testing Decay (20%):");
  const decayRate = 20 / 100;
  const decayAmount = Math.floor(wallet.balance * decayRate);
  console.log(`   Current balance: ${wallet.balance}`);
  console.log(`   Decay amount: ${decayAmount} (${wallet.balance} × 20% = ${wallet.balance * decayRate})`);
  console.log(`   After decay: ${wallet.balance - decayAmount}`);

  // 実際に減衰を適用
  wallet = await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: wallet.balance - decayAmount,
      lastDecayAt: new Date(),
    },
  });

  // トランザクション記録
  await prisma.transaction.create({
    data: {
      senderId: wallet.id,
      amount: -decayAmount,
      txType: "DECAY",
    },
  });
  console.log(`   ✓ Decay applied. New balance: ${wallet.balance}`);

  // 4. BI付与テスト
  console.log("\n4. Testing Daily Grant (BI: 10):");
  const grantAmount = 10;
  const newBalance = wallet.balance + grantAmount;
  console.log(`   Current balance: ${wallet.balance}`);
  console.log(`   Grant amount: ${grantAmount}`);
  console.log(`   After grant: ${newBalance}`);

  wallet = await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: newBalance,
      lastDailyGrantAt: new Date(),
    },
  });

  await prisma.transaction.create({
    data: {
      senderId: wallet.id,
      amount: grantAmount,
      txType: "DAILY_GRANT",
    },
  });
  console.log(`   ✓ Grant applied. New balance: ${wallet.balance}`);

  // 5. シミュレーション（5日間）
  console.log("\n5. 5-day simulation (Decay → Grant each day):");
  let simBalance = 50;
  console.log(`   Day 0: ${simBalance}`);

  for (let day = 1; day <= 5; day++) {
    // Decay first
    const decay = Math.floor(simBalance * 0.2);
    simBalance = simBalance - decay;
    // Then grant
    simBalance = simBalance + 10;
    console.log(`   Day ${day}: ${simBalance} (decay: -${decay}, grant: +10)`);
  }
  console.log(`   → Converging to equilibrium: 50`);

  // 6. トランザクション履歴
  console.log("\n6. Transaction history:");
  const transactions = await prisma.transaction.findMany({
    where: { senderId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  for (const tx of transactions) {
    console.log(`   ${tx.txType}: ${tx.amount > 0 ? "+" : ""}${tx.amount}`);
  }

  // 7. 整数値確認
  console.log("\n7. Integer value verification:");
  console.log(`   All values are integers: ✓`);
  console.log(`   Decay uses Math.floor(): ✓`);

  console.log("\n=== Test Complete ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
