import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";

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

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const notifications = await db.notification.findMany({
      where: {
        userId: payload.userId,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // 未読数も返す
    const unreadCount = await db.notification.count({
      where: {
        userId: payload.userId,
        isRead: false,
      },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
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

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

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
  } catch (error) {
    logger.error("Mark notifications read error", { userId: payload.userId }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
