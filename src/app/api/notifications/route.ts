import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";

// In-memory notification type
interface MemoryNotification {
  id: string;
  userId: string;
  type: "RESPONSE" | "MENTION" | "GAS_RECEIVED" | "SYSTEM";
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}

/**
 * GET /api/notifications
 * ユーザーの通知一覧を取得
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

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  try {
    const db = getPrismaClient();

    if (db) {
      // Database mode - fetch extra to account for filtered-out notifications
      const rawNotifications = await db.notification.findMany({
        where: {
          userId: payload.userId,
          ...(unreadOnly && { isRead: false }),
        },
        orderBy: { createdAt: "desc" },
        take: limit + 50, // 余分に取得してフィルタ後にlimit適用
      });

      // モデレーション非公開化されたセッションの通知を除外
      // linkUrlからセッションIDを抽出し、自分がオーナーでないcrisis非公開化セッションを除外
      const sessionIdPattern = /\/main\/chat\/([a-zA-Z0-9_-]+)/;
      const sessionIdsInNotifs = new Set<string>();
      for (const n of rawNotifications) {
        const match = n.linkUrl?.match(sessionIdPattern);
        if (match) sessionIdsInNotifs.add(match[1]);
      }

      // crisis非公開化された、自分がオーナーでないセッションを特定
      let hiddenSessionIds = new Set<string>();
      if (sessionIdsInNotifs.size > 0) {
        const crisisSessions = await db.chatSession.findMany({
          where: {
            id: { in: Array.from(sessionIdsInNotifs) },
            consultType: "PRIVATE",
            userId: { not: payload.userId },
            messages: { some: { isCrisis: true } },
          },
          select: { id: true },
        });
        hiddenSessionIds = new Set(crisisSessions.map((s) => s.id));
      }

      const notifications = rawNotifications
        .filter((n) => {
          if (hiddenSessionIds.size === 0) return true;
          const match = n.linkUrl?.match(sessionIdPattern);
          if (!match) return true;
          return !hiddenSessionIds.has(match[1]);
        })
        .slice(0, limit);

      // 未読数も同様にフィルタ
      const allUnread = await db.notification.findMany({
        where: {
          userId: payload.userId,
          isRead: false,
        },
        select: { id: true, linkUrl: true },
      });
      const unreadCount = allUnread.filter((n) => {
        if (hiddenSessionIds.size === 0) return true;
        const match = n.linkUrl?.match(sessionIdPattern);
        if (!match) return true;
        return !hiddenSessionIds.has(match[1]);
      }).length;

      return NextResponse.json({
        notifications,
        unreadCount,
      });
    } else {
      // In-memory fallback
      const notificationsStore = memoryDB.notifications as Map<string, MemoryNotification>;

      // Filter by userId and unreadOnly
      let userNotifications = Array.from(notificationsStore.values())
        .filter((n) => n.userId === payload.userId);

      if (unreadOnly) {
        userNotifications = userNotifications.filter((n) => !n.isRead);
      }

      // Sort by createdAt desc and limit
      const notifications = userNotifications
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        }));

      // Count unread
      const unreadCount = Array.from(notificationsStore.values())
        .filter((n) => n.userId === payload.userId && !n.isRead)
        .length;

      return NextResponse.json({
        notifications,
        unreadCount,
      });
    }
  } catch (error) {
    logger.error("Get notifications error", { userId: payload.userId }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications
 * 通知を既読にする
 */
export async function PUT(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { notificationIds?: string[]; markAllRead?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const db = getPrismaClient();

    if (db) {
      // Database mode
      if (body.markAllRead) {
        // 全て既読にする
        await db.notification.updateMany({
          where: {
            userId: payload.userId,
            isRead: false,
          },
          data: { isRead: true },
        });
      } else if (body.notificationIds && Array.isArray(body.notificationIds)) {
        // 指定IDのみ既読にする
        await db.notification.updateMany({
          where: {
            userId: payload.userId,
            id: { in: body.notificationIds },
          },
          data: { isRead: true },
        });
      } else {
        return NextResponse.json(
          { error: "Either notificationIds or markAllRead must be provided" },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } else {
      // In-memory fallback
      const notificationsStore = memoryDB.notifications as Map<string, MemoryNotification>;

      if (body.markAllRead) {
        // 全て既読にする
        for (const [id, notification] of notificationsStore.entries()) {
          if (notification.userId === payload.userId && !notification.isRead) {
            notification.isRead = true;
            notificationsStore.set(id, notification);
          }
        }
      } else if (body.notificationIds && Array.isArray(body.notificationIds)) {
        // 指定IDのみ既読にする
        for (const notificationId of body.notificationIds) {
          const notification = notificationsStore.get(notificationId);
          if (notification && notification.userId === payload.userId) {
            notification.isRead = true;
            notificationsStore.set(notificationId, notification);
          }
        }
      } else {
        return NextResponse.json(
          { error: "Either notificationIds or markAllRead must be provided" },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    logger.error("Mark notifications read error", { userId: payload.userId }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
