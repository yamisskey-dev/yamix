import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, parseJsonBody, ErrorResponses } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { decryptMessage } from "@/lib/encryption";
import { parseLimit } from "@/lib/validation";

/**
 * GET /api/bookmarks
 * ユーザーのブックマーク一覧を取得
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));

  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: payload.userId },
      include: {
        session: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true, role: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      bookmarks: bookmarks.map((b: typeof bookmarks[number]) => {
        // Decrypt message content for preview (backwards compatible)
        const rawContent = b.session.messages[0]?.content;
        const decryptedContent = rawContent
          ? decryptMessage(rawContent, b.session.userId)
          : null;
        return {
          id: b.id,
          sessionId: b.sessionId,
          createdAt: b.createdAt,
          session: {
            id: b.session.id,
            title: b.session.title,
            consultType: b.session.consultType,
            isAnonymous: b.session.isAnonymous,
            preview: decryptedContent?.slice(0, 50) || null,
            updatedAt: b.session.updatedAt,
            user: {
              id: b.session.user.id,
              handle: b.session.user.handle,
              displayName: b.session.user.profile?.displayName || null,
              avatarUrl: b.session.user.profile?.avatarUrl || null,
            },
          },
        };
      }),
    });
  } catch (error) {
    logger.error("Get bookmarks error", { userId: payload.userId }, error);
    return ErrorResponses.internalError();
  }
}

/**
 * POST /api/bookmarks
 * セッションをブックマークに追加
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  if (checkRateLimit(`bookmark:${payload.userId}`, RateLimits.GENERAL)) {
    return ErrorResponses.rateLimitExceeded();
  }

  const bodyResult = await parseJsonBody<{ sessionId: string }>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    // セッションが存在し、かつ公開されているか確認
    const session = await prisma.chatSession.findUnique({
      where: { id: body.sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 自分のセッションか、公開セッションのみブックマーク可能
    if (session.userId !== payload.userId && session.consultType !== "PUBLIC") {
      return NextResponse.json({ error: "Cannot bookmark private session" }, { status: 403 });
    }

    // ブックマークを作成（すでに存在する場合はエラーにならない）
    const bookmark = await prisma.bookmark.upsert({
      where: {
        userId_sessionId: {
          userId: payload.userId,
          sessionId: body.sessionId,
        },
      },
      create: {
        userId: payload.userId,
        sessionId: body.sessionId,
      },
      update: {}, // 既に存在する場合は何もしない
    });

    return NextResponse.json({
      success: true,
      bookmark: {
        id: bookmark.id,
        sessionId: bookmark.sessionId,
        createdAt: bookmark.createdAt,
      },
    });
  } catch (error) {
    logger.error("Create bookmark error", { userId: payload.userId }, error);
    return ErrorResponses.internalError();
  }
}

/**
 * DELETE /api/bookmarks
 * ブックマークを削除
 */
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    // ブックマークを削除
    await prisma.bookmark.deleteMany({
      where: {
        userId: payload.userId,
        sessionId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Delete bookmark error", { userId: payload.userId }, error);
    return ErrorResponses.internalError();
  }
}
