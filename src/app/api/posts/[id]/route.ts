import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/posts/[id] - Get post by ID (with replies)
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    if (isPrismaAvailable() && prisma) {
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
    } else {
      // In-memory fallback
      const post = memoryDB.posts.get(id);
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      const wallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.id === post.walletId
      );

      const replies = Array.from(memoryDB.posts.values())
        .filter((p) => p.parentId === id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((r) => {
          const rWallet = Array.from(memoryDB.wallets.values()).find(
            (w) => w.id === r.walletId
          );
          return {
            ...r,
            wallet: rWallet
              ? {
                  id: rWallet.id,
                  address: rWallet.address,
                  walletType: rWallet.walletType,
                }
              : null,
          };
        });

      return NextResponse.json({
        ...post,
        wallet: wallet
          ? {
              id: wallet.id,
              address: wallet.address,
              walletType: wallet.walletType,
            }
          : null,
        replies,
      });
    }
  } catch (error) {
    logger.error("Get post error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[id] - Delete post (owner only)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    if (isPrismaAvailable() && prisma) {
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
    } else {
      // In-memory fallback
      const post = memoryDB.posts.get(id);
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      const wallet = Array.from(memoryDB.wallets.values()).find(
        (w) => w.id === post.walletId
      );

      if (!wallet || wallet.userId !== payload.userId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      // Delete replies first
      for (const [key, p] of memoryDB.posts.entries()) {
        if (p.parentId === id) {
          memoryDB.posts.delete(key);
        }
      }

      memoryDB.posts.delete(id);
      return new NextResponse(null, { status: 204 });
    }
  } catch (error) {
    logger.error("Delete post error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
