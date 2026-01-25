/**
 * メッセージの暗号化状況を確認するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/check-encryption-status.ts
 */

import { PrismaClient } from "@prisma/client";

const ENCRYPTED_PREFIX = "$enc$";

async function main() {
  console.log("=== メッセージ暗号化状況チェック ===\n");

  const prisma = new PrismaClient();

  try {
    const messages = await prisma.chatMessage.findMany({
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });

    const encrypted = messages.filter((m) => m.content.startsWith(ENCRYPTED_PREFIX));
    const plaintext = messages.filter((m) => !m.content.startsWith(ENCRYPTED_PREFIX));

    console.log(`総メッセージ数: ${messages.length}`);
    console.log(`暗号化済み: ${encrypted.length} (${((encrypted.length / messages.length) * 100).toFixed(1)}%)`);
    console.log(`平文: ${plaintext.length} (${((plaintext.length / messages.length) * 100).toFixed(1)}%)`);

    if (plaintext.length > 0) {
      console.log("\n--- 平文メッセージのサンプル (最大5件) ---");
      plaintext.slice(0, 5).forEach((m) => {
        console.log(`  ID: ${m.id}`);
        console.log(`  作成日時: ${m.createdAt}`);
        console.log(`  内容 (先頭50文字): ${m.content.slice(0, 50)}...`);
        console.log();
      });

      console.log("マイグレーションを実行するには:");
      console.log("  npx tsx scripts/migrate-encrypt-messages.ts");
    } else {
      console.log("\n全てのメッセージが暗号化されています。");
      console.log("後方互換性コードを削除できます。");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("チェック失敗:", error);
  process.exit(1);
});
