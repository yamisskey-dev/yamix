/**
 * 起動時自動マイグレーション
 * 平文メッセージを暗号化する
 */

import { getPrismaClient } from "@/lib/prisma";
import { encryptMessage, isEncrypted } from "@/lib/encryption";
import { logger } from "@/lib/logger";

export async function migrateUnencryptedMessages(): Promise<void> {
  const db = getPrismaClient();
  if (!db) {
    logger.info("[auto-migrate] Database not available, skipping");
    return;
  }

  try {
    // 平文メッセージをカウント（$enc$で始まらないもの）
    const plaintextCount = await db.chatMessage.count({
      where: {
        NOT: {
          content: {
            startsWith: "$enc$",
          },
        },
      },
    });

    if (plaintextCount === 0) {
      logger.info("[auto-migrate] All messages already encrypted");
      return;
    }

    logger.info(`[auto-migrate] Found ${plaintextCount} unencrypted messages, migrating...`);

    // 平文メッセージを取得
    const messages = await db.chatMessage.findMany({
      where: {
        NOT: {
          content: {
            startsWith: "$enc$",
          },
        },
      },
      include: {
        session: {
          select: {
            userId: true,
          },
        },
      },
    });

    let successCount = 0;
    let errorCount = 0;

    for (const message of messages) {
      try {
        // 再確認（競合防止）
        if (isEncrypted(message.content)) {
          continue;
        }

        const encryptedContent = encryptMessage(message.content, message.session.userId);

        await db.chatMessage.update({
          where: { id: message.id },
          data: { content: encryptedContent },
        });

        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`[auto-migrate] Failed to encrypt message ${message.id}`, {}, error);
      }
    }

    logger.info(`[auto-migrate] Migration complete: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    logger.error("[auto-migrate] Migration failed", {}, error);
    // エラーでもアプリは起動する（後方互換性があるので）
  }
}
