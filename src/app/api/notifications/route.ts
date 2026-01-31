import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, parseJsonBody, ErrorResponses } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { parseLimit } from "@/lib/validation";

/**
 * GET /api/notifications
 * ユーザーの通知一覧を取得
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  try {
    // Database mode - fetch extra to account for filtered-out notifications
    const rawNotifications = await prisma.notification.findMany({
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
      const crisisSessions = await prisma.chatSession.findMany({
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
    const allUnread = await prisma.notification.findMany({
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
  } catch (error) {
    logger.error("Get notifications error", { userId: payload.userId }, error);
    return ErrorResponses.internalError();
  }
}

/**
 * PUT /api/notifications
 * 通知を既読にする
 */
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const bodyResult = await parseJsonBody<{ notificationIds?: string[]; markAllRead?: boolean }>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

  try {
    if (body.markAllRead) {
      // 全て既読にする
      await prisma.notification.updateMany({
        where: {
          userId: payload.userId,
          isRead: false,
        },
        data: { isRead: true },
      });
    } else if (body.notificationIds && Array.isArray(body.notificationIds)) {
      // 指定IDのみ既読にする
      await prisma.notification.updateMany({
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
    return ErrorResponses.internalError();
  }
}
