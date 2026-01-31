import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptMessage } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { authenticateRequest, ErrorResponses } from "@/lib/api-helpers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/chat/sessions/[id]/poll?after=<ISO timestamp>
// Lightweight endpoint to poll for new messages
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;
  const { payload } = authResult;

  const { id } = await params;
  const after = req.nextUrl.searchParams.get("after");

  if (!after) {
    return NextResponse.json({ error: "Missing 'after' parameter" }, { status: 400 });
  }

  const afterDate = new Date(after);
  if (isNaN(afterDate.getTime())) {
    return NextResponse.json({ error: "Invalid 'after' parameter" }, { status: 400 });
  }

  try {
    // Verify session exists and user has access
    const session = await prisma.chatSession.findUnique({
      where: { id },
      select: {
        userId: true,
        consultType: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isOwner = session.userId === payload.userId;

    // Authorization check
    if (!isOwner) {
      if (session.consultType === "PRIVATE") {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
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
      }
    }

    // Fetch only new messages
    const newMessages = await prisma.chatMessage.findMany({
      where: {
        sessionId: id,
        createdAt: { gt: afterDate },
        ...(isOwner ? {} : { isHidden: false }),
      },
      orderBy: { createdAt: "asc" },
      include: {
        responder: {
          include: {
            profile: true,
          },
        },
      },
    });

    const messages = newMessages.map((m: typeof newMessages[number]) => ({
      id: m.id,
      role: m.role,
      content: decryptMessage(m.content, session.userId),
      createdAt: m.createdAt.toISOString(),
      responderId: m.responderId,
      isAnonymous: m.isAnonymous,
      isCrisis: m.isCrisis,
      gasAmount: m.gasAmount,
      responder: m.responder
        ? {
            id: m.responder.id,
            handle: m.responder.handle,
            displayName: m.responder.profile?.displayName || null,
            avatarUrl: m.responder.profile?.avatarUrl || null,
          }
        : null,
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    logger.error("Poll error", { sessionId: id }, error);
    return ErrorResponses.internalError();
  }
}
