import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { decryptMessage } from "@/lib/encryption";
import { parseLimit } from "@/lib/validation";

/**
 * GET /api/bookmarks
 * ユーザーのブックマーク一覧を取得
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
  const limit = parseLimit(searchParams.get("limit"));

  try {
    const db = getPrismaClient();

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const bookmarks = await db.bookmark.findMany({
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
      bookmarks: bookmarks.map((b) => {
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookmarks
 * セッションをブックマークに追加
 */
export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { sessionId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const db = getPrismaClient();

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    // セッションが存在し、かつ公開されているか確認
    const session = await db.chatSession.findUnique({
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
    const bookmark = await db.bookmark.upsert({
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bookmarks
 * ブックマークを削除
 */
export async function DELETE(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const db = getPrismaClient();

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    // ブックマークを削除
    await db.bookmark.deleteMany({
      where: {
        userId: payload.userId,
        sessionId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Delete bookmark error", { userId: payload.userId }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
