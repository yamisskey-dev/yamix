import { getPrismaClient } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type NotificationType = "RESPONSE" | "MENTION" | "GAS_RECEIVED" | "SYSTEM";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
}

/**
 * 通知を作成する
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const db = getPrismaClient();

    if (!db) {
      logger.warn("Database not available, notification not created", { ...params });
      return;
    }

    await db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        linkUrl: params.linkUrl,
      },
    });

    logger.info("Notification created", { ...params });
  } catch (error) {
    logger.error("Failed to create notification", { ...params }, error);
    // Don't throw - notifications are not critical
  }
}

/**
 * Gas受信通知を作成
 */
export async function notifyGasReceived(
  recipientId: string,
  senderHandle: string,
  sessionId: string
): Promise<void> {
  await createNotification({
    userId: recipientId,
    type: "GAS_RECEIVED",
    title: "灯（ともしび）を受け取りました",
    message: `@${senderHandle}さんからあなたの回答に灯が送られました`,
    linkUrl: `/main/chat/${sessionId}`,
  });
}

/**
 * 相談への回答通知を作成
 */
export async function notifyResponse(
  consultationOwnerId: string,
  responderHandle: string,
  sessionId: string,
  isAnonymous: boolean
): Promise<void> {
  const displayName = isAnonymous ? "匿名ユーザー" : `@${responderHandle}さん`;

  await createNotification({
    userId: consultationOwnerId,
    type: "RESPONSE",
    title: "相談に回答がありました",
    message: `${displayName}があなたの相談に回答しました`,
    linkUrl: `/main/chat/${sessionId}`,
  });
}

/**
 * メンション通知を作成
 */
export async function notifyMention(
  mentionedUserId: string,
  mentionerHandle: string,
  sessionId: string
): Promise<void> {
  await createNotification({
    userId: mentionedUserId,
    type: "MENTION",
    title: "メンションされました",
    message: `@${mentionerHandle}さんがあなたに言及しました`,
    linkUrl: `/main/chat/${sessionId}`,
  });
}
