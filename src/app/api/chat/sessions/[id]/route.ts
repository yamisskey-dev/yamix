import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { decryptMessage } from "@/lib/encryption";
import { authenticateRequest, parseJsonBody, ErrorResponses } from "@/lib/api-helpers";
import { QUERY_LIMITS } from "@/lib/constants";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/chat/sessions/[id] - Get session with messages
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;
  const { payload } = authResult;

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
          take: QUERY_LIMITS.MAX_MESSAGES_PER_SESSION,
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
        .map((m) => {
          // E2EE対応: クライアントサイド暗号化されたメッセージはサーバーで復号しない
          let content: string | { ciphertext: string; iv: string; salt: string; isEncrypted: true };

          if (m.isE2EE && m.encryptedIv) {
            // E2EE暗号化メッセージ: 暗号化データとしてクライアントに返す
            content = {
              ciphertext: m.content,
              iv: m.encryptedIv,
              salt: '', // E2EEではメッセージごとのソルトは使用しない
              isEncrypted: true as const,
            };
          } else {
            // サーバーサイド暗号化メッセージ: サーバーで復号して返す
            content = decryptMessage(m.content, session.userId);
          }

          return {
            ...m,
            content,
            responder: m.responder ? {
              id: m.responder.id,
              handle: m.responder.handle,
              displayName: m.responder.profile?.displayName || null,
              avatarUrl: m.responder.profile?.avatarUrl || null,
            } : null,
          };
        }),
      targets: session.consultType === "DIRECTED" ? session.targets.map((t) => ({
        userId: t.userId,
        handle: t.user.handle,
        displayName: t.user.profile?.displayName || null,
      })) : undefined,
    });
  } catch (error) {
    logger.error("Get chat session error", { sessionId: id }, error);
    return ErrorResponses.internalError();
  }
}

// PATCH /api/chat/sessions/[id] - Update session
// title と consultType が更新可能（isAnonymousは作成時のみ設定可能）
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;
  const { payload } = authResult;

  const { id } = await params;

  const bodyResult = await parseJsonBody<{ title?: string; consultType?: "PRIVATE" | "PUBLIC" }>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

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
    return ErrorResponses.internalError();
  }
}

// DELETE /api/chat/sessions/[id] - Delete session
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;
  const { payload } = authResult;

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
    return ErrorResponses.internalError();
  }
}
