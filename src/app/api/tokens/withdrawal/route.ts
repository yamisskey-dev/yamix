import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, parseJsonBody, ErrorResponses } from "@/lib/api-helpers";
import { TOKEN_ECONOMY } from "@/types";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

// POST /api/tokens/withdrawal - Initiate YAMI withdrawal to Optimism ETH
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  if (checkRateLimit(`withdrawal:${payload.userId}`, RateLimits.AUTH)) {
    return ErrorResponses.rateLimitExceeded();
  }

  const bodyResult = await parseJsonBody<{ walletId?: string; amount?: number; ethAddress?: string }>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

  const { walletId, amount, ethAddress } = body;

  if (!walletId || !amount || !ethAddress) {
    return NextResponse.json(
      { error: "walletId, amount, and ethAddress are required" },
      { status: 400 }
    );
  }

  // Validate Optimism address format (same as ETH)
  if (!/^0x[a-fA-F0-9]{40}$/.test(ethAddress)) {
    return NextResponse.json(
      { error: "Invalid Optimism address format" },
      { status: 400 }
    );
  }

  if (amount < TOKEN_ECONOMY.MIN_WITHDRAWAL) {
    return NextResponse.json(
      { error: `Minimum withdrawal is ${TOKEN_ECONOMY.MIN_WITHDRAWAL} YAMI` },
      { status: 400 }
    );
  }

  // Calculate Optimism ETH amount after fee
  const feeAmount = Math.floor(amount * TOKEN_ECONOMY.WITHDRAWAL_FEE_PERCENT / 100);
  const netAmount = amount - feeAmount;
  const ethAmount = (parseFloat(TOKEN_ECONOMY.ETH_PER_YAMI) * netAmount).toFixed(6);

  try {
    // Verify wallet belongs to user and has sufficient balance
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    if (wallet.userId !== payload.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (wallet.balance < amount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Create withdrawal and deduct balance atomically
    const [withdrawal] = await prisma.$transaction([
      prisma.tokenWithdrawal.create({
        data: {
          walletId,
          amount,
          ethAmount,
          ethAddress,
          status: "PENDING",
        },
      }),
      prisma.wallet.update({
        where: { id: walletId },
        data: { balance: { decrement: amount } },
      }),
    ]);

    return NextResponse.json({
      withdrawal,
      details: {
        network: TOKEN_ECONOMY.NETWORK,
        chainId: TOKEN_ECONOMY.CHAIN_ID,
        grossAmount: amount,
        feeAmount,
        feePercent: TOKEN_ECONOMY.WITHDRAWAL_FEE_PERCENT,
        netAmount,
        ethAmount,
        ethAddress,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error("YAMI withdrawal error:", {}, error);
    return ErrorResponses.internalError();
  }
}

// GET /api/tokens/withdrawal - Get withdrawal history
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

    const withdrawals = await prisma.tokenWithdrawal.findMany({
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

    return NextResponse.json(withdrawals);
  } catch (error) {
    logger.error("Get withdrawal history error:", {}, error);
    return ErrorResponses.internalError();
  }
}
