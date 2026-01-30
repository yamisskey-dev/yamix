import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB, generateId } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { TOKEN_ECONOMY } from "@/types";
import { logger } from "@/lib/logger";

// GET /api/posts - Get all posts (with pagination)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    if (isPrismaAvailable() && prisma) {
      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where: { parentId: null }, // Only top-level posts
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
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
        }),
        prisma.post.count({ where: { parentId: null } }),
      ]);

      return NextResponse.json({
        posts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      // In-memory fallback
      const allPosts = Array.from(memoryDB.posts.values())
        .filter((p) => p.parentId === null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = allPosts.length;
      const posts = allPosts.slice((page - 1) * limit, page * limit).map((p) => {
        const wallet = Array.from(memoryDB.wallets.values()).find(
          (w) => w.id === p.walletId
        );
        return {
          ...p,
          wallet: wallet
            ? {
                id: wallet.id,
                address: wallet.address,
                walletType: wallet.walletType,
              }
            : null,
        };
      });

      return NextResponse.json({
        posts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }
  } catch (error) {
    logger.error("Get posts error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/posts - Create a new post or reply
export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { content?: string; parentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { content, parentId } = body;
  const walletId = payload.walletId; // Use walletId from JWT (1:1 user-wallet)

  if (!content) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  try {
    if (isPrismaAvailable() && prisma) {
      // Get user's wallet
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
      }

      // If reply, verify parent post exists
      let parentPost = null;
      if (parentId) {
        parentPost = await prisma.post.findUnique({
          where: { id: parentId },
          include: { wallet: true },
        });

        if (!parentPost) {
          return NextResponse.json(
            { error: "Parent post not found" },
            { status: 400 }
          );
        }
      }

      // Check if self-reply (free)
      const isSelfReply = parentPost && parentPost.walletId === walletId;

      // Determine cost based on target type
      const isReply = !!parentPost;
      const targetIsAI = parentPost?.wallet.walletType === "AI_SYSTEM";
      const postCost = isSelfReply
        ? 0
        : isReply
          ? targetIsAI
            ? TOKEN_ECONOMY.COST_CONSULT_AI
            : TOKEN_ECONOMY.COST_CONSULT_HUMAN
          : TOKEN_ECONOMY.COST_DISCUSSION;

      // Check balance
      if (wallet.balance < postCost) {
        return NextResponse.json(
          { error: "Insufficient balance to post" },
          { status: 400 }
        );
      }

      // Determine reward for parent post owner
      const replyReward =
        parentPost && parentPost.walletId !== walletId
          ? parentPost.wallet.walletType === "AI_SYSTEM"
            ? TOKEN_ECONOMY.REWARD_RESPONSE_AI
            : TOKEN_ECONOMY.REWARD_RESPONSE_HUMAN
          : 0;

      // Create post and handle token economy atomically
      const post = await prisma.$transaction(async (tx) => {
        // Deduct cost
        if (postCost > 0) {
          await tx.wallet.update({
            where: { id: walletId },
            data: { balance: { decrement: postCost } },
          });
        }

        // Reward parent post owner for receiving a reply
        if (replyReward > 0 && parentPost) {
          const parentWallet = await tx.wallet.findUnique({
            where: { id: parentPost.walletId },
          });

          if (parentWallet && parentWallet.balance < TOKEN_ECONOMY.MAX_BALANCE) {
            const newBalance = Math.min(
              parentWallet.balance + replyReward,
              TOKEN_ECONOMY.MAX_BALANCE
            );
            await tx.wallet.update({
              where: { id: parentPost.walletId },
              data: { balance: newBalance },
            });
          }
        }

        // Create post
        return tx.post.create({
          data: {
            content,
            walletId,
            parentId: parentId || null,
            postType: isReply ? "RESPONSE" : "CONSULTATION",
            targetType: isReply ? (targetIsAI ? "AI" : "HUMAN") : null,
            tokenCost: postCost,
            tokenReward: 0, // Will be updated when receiving replies
          },
          include: {
            wallet: {
              select: {
                id: true,
                address: true,
                walletType: true,
              },
            },
          },
        });
      });

      return NextResponse.json(post, { status: 201 });
    } else {
      // In-memory fallback
      const wallet = memoryDB.wallets.get(walletId);

      if (!wallet) {
        return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
      }

      let parentPost = null;
      if (parentId) {
        parentPost = memoryDB.posts.get(parentId);
        if (!parentPost) {
          return NextResponse.json(
            { error: "Parent post not found" },
            { status: 400 }
          );
        }
      }

      const isSelfReply = parentPost && parentPost.walletId === walletId;
      const parentWalletMem = parentPost
        ? Array.from(memoryDB.wallets.values()).find((w) => w.id === parentPost.walletId)
        : null;
      const targetIsAI = parentWalletMem?.walletType === "AI_SYSTEM";
      const isReply = !!parentPost;

      const postCost = isSelfReply
        ? 0
        : isReply
          ? targetIsAI
            ? TOKEN_ECONOMY.COST_CONSULT_AI
            : TOKEN_ECONOMY.COST_CONSULT_HUMAN
          : TOKEN_ECONOMY.COST_DISCUSSION;

      if (wallet.balance < postCost) {
        return NextResponse.json(
          { error: "Insufficient balance to post" },
          { status: 400 }
        );
      }

      const replyReward =
        parentPost && parentPost.walletId !== walletId
          ? targetIsAI
            ? TOKEN_ECONOMY.REWARD_RESPONSE_AI
            : TOKEN_ECONOMY.REWARD_RESPONSE_HUMAN
          : 0;

      // Deduct cost
      if (postCost > 0) {
        wallet.balance -= postCost;
      }

      // Reward parent post owner
      if (replyReward > 0 && parentWalletMem) {
        if (parentWalletMem.balance < TOKEN_ECONOMY.MAX_BALANCE) {
          parentWalletMem.balance = Math.min(
            parentWalletMem.balance + replyReward,
            TOKEN_ECONOMY.MAX_BALANCE
          );
        }
      }

      const postType = isReply ? "RESPONSE" : "CONSULTATION";
      const targetType = isReply ? (targetIsAI ? "AI" : "HUMAN") : null;

      const post = {
        id: generateId(),
        content,
        walletId,
        parentId: parentId || null,
        postType: postType as "RESPONSE" | "CONSULTATION",
        targetType: targetType as "AI" | "HUMAN" | null,
        tokenCost: postCost,
        tokenReward: 0,
        createdAt: new Date(),
      };

      memoryDB.posts.set(post.id, post);

      return NextResponse.json(
        {
          ...post,
          wallet: {
            id: wallet.id,
            address: wallet.address,
            walletType: wallet.walletType,
          },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    logger.error("Create post error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
