import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, ErrorResponses } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/posts/[id] - Get post by ID (with replies)
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        wallet: {
          select: {
            id: true,
            address: true,
            walletType: true,
          },
        },
        _count: {
          select: {
            transactions: true,
            replies: true,
          },
        },
        transactions: {
          select: {
            id: true,
            amount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            wallet: {
              select: {
                id: true,
                address: true,
                    walletType: true,
              },
            },
            _count: {
              select: {
                transactions: true,
                replies: true,
              },
            },
          },
        },
        parent: {
          include: {
            wallet: {
              select: {
                id: true,
                address: true,
                    walletType: true,
              },
            },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    logger.error("Get post error:", {}, error);
    return ErrorResponses.internalError();
  }
}

// DELETE /api/posts/[id] - Delete post (owner only)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { wallet: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Verify ownership
    if (post.wallet.userId !== payload.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await prisma.post.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("Delete post error:", {}, error);
    return ErrorResponses.internalError();
  }
}
