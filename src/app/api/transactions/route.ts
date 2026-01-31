import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { TOKEN_ECONOMY } from "@/types";
import { logger } from "@/lib/logger";

// POST /api/transactions - Send tokens to a post (reaction)
export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { postId?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { postId } = body;
  const senderId = payload.walletId; // Use walletId from JWT (1:1 user-wallet)
  const amount = body.amount || TOKEN_ECONOMY.REACTION_DEFAULT;

  if (!postId) {
    return NextResponse.json(
      { error: "postId is required" },
      { status: 400 }
    );
  }

  try {
    // Get the post with author
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { wallet: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Get sender wallet
    const sender = await prisma.wallet.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      return NextResponse.json(
        { error: "Sender wallet not found" },
        { status: 404 }
      );
    }

    // Prevent self-transaction
    if (post.walletId === senderId) {
      return NextResponse.json(
        { error: "Cannot send tokens to yourself" },
        { status: 400 }
      );
    }

    // Check balance
    if (sender.balance < amount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Execute transaction atomically
    const transaction = await prisma.$transaction(async (tx) => {
      // Decrease sender balance
      await tx.wallet.update({
        where: { id: senderId },
        data: { balance: { decrement: amount } },
      });

      // Increase receiver balance (with cap)
      const newBalance = Math.min(
        post.wallet.balance + amount,
        TOKEN_ECONOMY.MAX_BALANCE
      );
      await tx.wallet.update({
        where: { id: post.walletId },
        data: { balance: newBalance },
      });

      // Create transaction record
      return tx.transaction.create({
        data: {
          postId,
          senderId,
          amount,
          txType: "REACTION",
        },
      });
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    logger.error("Create transaction error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/transactions - Get transactions
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("postId");

  try {
    const where = postId ? { postId } : {};

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    logger.error("Get transactions error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
