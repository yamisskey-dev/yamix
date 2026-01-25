/**
 * 既存の平文メッセージを暗号化するマイグレーションスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/migrate-encrypt-messages.ts
 *
 * 注意:
 *   - 必ずバックアップを取ってから実行してください
 *   - src/lib/encryption.ts と同じ暗号化方式を使用
 *   - 冪等性あり（すでに暗号化されているメッセージはスキップ）
 */

import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const ENCRYPTED_PREFIX = "$enc$";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * マスターキーを取得 (encryption.ts と同じロジック)
 */
function getMasterKey(): Buffer {
  const envKey = process.env.MESSAGE_ENCRYPTION_KEY;
  if (envKey) {
    return Buffer.from(envKey, "base64");
  }

  // 開発環境用のフォールバック（encryption.ts と同じ）
  console.warn(
    "WARNING: MESSAGE_ENCRYPTION_KEY not set. Using derived key from JWT_SECRET."
  );
  const jwtSecret = process.env.JWT_SECRET || "development-secret";
  return crypto.pbkdf2Sync(jwtSecret, "yamix-fallback-salt", 100000, KEY_LENGTH, "sha256");
}

/**
 * ユーザーIDからキーを派生 (encryption.ts と同じロジック)
 */
function deriveUserKey(userId: string, context: string = "chat_message"): Buffer {
  const masterKey = getMasterKey();
  const salt = crypto
    .createHash("sha256")
    .update(`yamix:${userId}:${context}`)
    .digest()
    .subarray(0, SALT_LENGTH);

  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, "sha256");
}

function encryptMessage(plaintext: string, userId: string): string {
  const key = deriveUserKey(userId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return ENCRYPTED_PREFIX + combined.toString("base64");
}

function isEncrypted(content: string): boolean {
  return content.startsWith(ENCRYPTED_PREFIX);
}

async function main() {
  console.log("=== メッセージ暗号化マイグレーション ===\n");

  const prisma = new PrismaClient();

  try {
    // 全メッセージを取得（セッション情報も含む）
    console.log("メッセージを取得中...");
    const messages = await prisma.chatMessage.findMany({
      include: {
        session: {
          select: {
            userId: true,
          },
        },
      },
    });

    console.log(`総メッセージ数: ${messages.length}`);

    // 平文メッセージをフィルタリング
    const plaintextMessages = messages.filter((m) => !isEncrypted(m.content));
    console.log(`平文メッセージ数: ${plaintextMessages.length}`);

    if (plaintextMessages.length === 0) {
      console.log("\n暗号化が必要なメッセージはありません。");
      return;
    }

    console.log("\n暗号化を開始します...\n");

    let successCount = 0;
    let errorCount = 0;

    for (const message of plaintextMessages) {
      try {
        const encryptedContent = encryptMessage(message.content, message.session.userId);

        await prisma.chatMessage.update({
          where: { id: message.id },
          data: { content: encryptedContent },
        });

        successCount++;
        if (successCount % 100 === 0) {
          console.log(`進捗: ${successCount}/${plaintextMessages.length}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`エラー (ID: ${message.id}):`, error);
      }
    }

    console.log("\n=== 完了 ===");
    console.log(`成功: ${successCount}`);
    console.log(`エラー: ${errorCount}`);

    if (errorCount === 0) {
      console.log("\n全てのメッセージが暗号化されました。");
      console.log("後方互換性コード（平文読み込み）を削除できます。");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("マイグレーション失敗:", error);
  process.exit(1);
});
