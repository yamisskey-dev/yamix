import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, parseJsonBody, ErrorResponses } from "@/lib/api-helpers";
import { TOKEN_ECONOMY } from "@/types";
import { logger } from "@/lib/logger";
import { parseLimit, parsePage } from "@/lib/validation";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

// GET /api/posts - Get all posts (with pagination)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parsePage(searchParams.get("page"));
  const limit = parseLimit(searchParams.get("limit"));

  try {
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
  } catch (error) {
    logger.error("Get posts error:", {}, error);
    return ErrorResponses.internalError();
  }
}

// POST /api/posts - Create a new post or reply
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  if (checkRateLimit(`post:${payload.userId}`, RateLimits.MESSAGE_SEND)) {
    return ErrorResponses.rateLimitExceeded();
  }

  const bodyResult = await parseJsonBody<{ content?: string; parentId?: string }>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

  const { content, parentId } = body;
  const walletId = payload.walletId; // Use walletId from JWT (1:1 user-wallet)

  if (!content) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  try {
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
  } catch (error) {
    logger.error("Create post error:", {}, error);
    return ErrorResponses.internalError();
  }
}
