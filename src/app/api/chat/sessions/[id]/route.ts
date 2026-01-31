import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { decryptMessage } from "@/lib/encryption";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/chat/sessions/[id] - Get session with messages
export async function GET(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
          include: {
            responder: {
              include: {
                profile: true,
              },
            },
          },
        },
        targets: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check authorization: owner, PUBLIC viewers, or DIRECTED targets
    const isOwner = session.userId === payload.userId;
    const isPublic = session.consultType === "PUBLIC";

    if (!isOwner && !isPublic) {
      // DIRECTED: allow target users
      if (session.consultType === "DIRECTED") {
        const isTarget = await prisma.chatSessionTarget.findUnique({
          where: {
            sessionId_userId: {
              sessionId: id,
              userId: payload.userId,
            },
          },
        });
        if (!isTarget) {
          return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    }

    // Format response with user info (decrypt messages for client)
    return NextResponse.json({
      ...session,
      user: {
        id: session.user.id,
        handle: session.user.handle,
        displayName: session.user.profile?.displayName || null,
        avatarUrl: session.user.profile?.avatarUrl || null,
      },
      messages: session.messages
        .filter((m) => isOwner || !m.isHidden) // Hide moderated messages from non-owners
        .map((m) => ({
          ...m,
          content: decryptMessage(m.content, session.userId), // Decrypt with owner's key
          responder: m.responder ? {
            id: m.responder.id,
            handle: m.responder.handle,
            displayName: m.responder.profile?.displayName || null,
            avatarUrl: m.responder.profile?.avatarUrl || null,
          } : null,
        })),
      targets: session.consultType === "DIRECTED" ? session.targets.map((t) => ({
        userId: t.userId,
        handle: t.user.handle,
        displayName: t.user.profile?.displayName || null,
      })) : undefined,
    });
  } catch (error) {
    logger.error("Get chat session error", { sessionId: id }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/chat/sessions/[id] - Update session
// title と consultType が更新可能（isAnonymousは作成時のみ設定可能）
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id } = await params;

  let body: { title?: string; consultType?: "PRIVATE" | "PUBLIC" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // タイトルまたはconsultTypeが指定されているか確認
  if (body.title === undefined && body.consultType === undefined) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // consultTypeのバリデーション
  if (body.consultType && !["PRIVATE", "PUBLIC"].includes(body.consultType)) {
    return NextResponse.json({ error: "Invalid consultType" }, { status: 400 });
  }

  try {
    const session = await prisma.chatSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.userId !== payload.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const updateData: { title?: string; consultType?: "PRIVATE" | "PUBLIC"; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.consultType !== undefined) {
      // crisis非公開化されたセッションは再公開禁止
      if (body.consultType !== "PRIVATE") {
        const hasCrisis = await prisma.chatMessage.findFirst({
          where: { sessionId: id, isCrisis: true },
          select: { id: true },
        });
        if (hasCrisis) {
          return NextResponse.json(
            { error: "安全上の理由により、この相談は非公開から変更できません" },
            { status: 403 }
          );
        }
      }
      updateData.consultType = body.consultType;
    }

    const updated = await prisma.chatSession.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error("Update chat session error", { sessionId: id }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/sessions/[id] - Delete session
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const session = await prisma.chatSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.userId !== payload.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await prisma.chatSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Delete chat session error", { sessionId: id }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
