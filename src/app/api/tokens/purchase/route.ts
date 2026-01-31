import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, parseJsonBody, ErrorResponses } from "@/lib/api-helpers";
import { TOKEN_ECONOMY } from "@/types";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

// POST /api/tokens/purchase - Initiate YAMI purchase with Optimism ETH
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  if (checkRateLimit(`purchase:${payload.userId}`, RateLimits.AUTH)) {
    return ErrorResponses.rateLimitExceeded();
  }

  const bodyResult = await parseJsonBody<{ walletId?: string; amount?: number }>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

  const { walletId, amount } = body;

  if (!walletId || !amount) {
    return NextResponse.json(
      { error: "walletId and amount are required" },
      { status: 400 }
    );
  }

  if (amount < TOKEN_ECONOMY.MIN_PURCHASE) {
    return NextResponse.json(
      { error: `Minimum purchase is ${TOKEN_ECONOMY.MIN_PURCHASE} YAMI` },
      { status: 400 }
    );
  }

  // Calculate Optimism ETH amount
  const ethAmount = (parseFloat(TOKEN_ECONOMY.ETH_PER_YAMI) * amount).toFixed(6);

  try {
    // Verify wallet belongs to user
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    if (wallet.userId !== payload.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Check max balance
    if (wallet.balance + amount > TOKEN_ECONOMY.MAX_BALANCE) {
      return NextResponse.json(
        { error: `Purchase would exceed max balance of ${TOKEN_ECONOMY.MAX_BALANCE} YAMI` },
        { status: 400 }
      );
    }

    // Create pending purchase record
    const purchase = await prisma.tokenPurchase.create({
      data: {
        walletId,
        amount,
        ethAmount,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      purchase,
      paymentInfo: {
        network: TOKEN_ECONOMY.NETWORK,
        chainId: TOKEN_ECONOMY.CHAIN_ID,
        ethAmount,
        // In production, this would be the YAMI DAO treasury address on Optimism
        recipientAddress: process.env.YAMI_DAO_TREASURY_ADDRESS || (() => { throw new Error("YAMI_DAO_TREASURY_ADDRESS must be set"); })(),
        memo: `Purchase ${amount} YAMI for wallet ${walletId}`,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error("YAMI purchase error:", {}, error);
    return ErrorResponses.internalError();
  }
}

// GET /api/tokens/purchase - Get purchase history
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const { searchParams } = new URL(req.url);
  const walletId = searchParams.get("walletId");

  try {
    // Get user's wallets
    const wallets = await prisma.wallet.findMany({
      where: { userId: payload.userId },
      select: { id: true },
    });

    const walletIds = wallets.map((w) => w.id);

    // Filter by walletId if provided
    const whereClause = walletId && walletIds.includes(walletId)
      ? { walletId }
      : { walletId: { in: walletIds } };

    const purchases = await prisma.tokenPurchase.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        wallet: {
          select: {
            id: true,
            address: true,
          },
        },
      },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    logger.error("Get purchase history error:", {}, error);
    return ErrorResponses.internalError();
  }
}
