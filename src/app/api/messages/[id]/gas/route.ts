import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { notifyGasReceived } from "@/lib/notifications";

// Gas constants
const GAS_TIP_AMOUNT = 3; // 💜の金額

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/messages/[id]/gas
 * 回答に💜（ガス）を送る
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: messageId } = await params;
    const token = getTokenFromCookie(req.headers.get("cookie"));

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // レート制限チェック
    const rateLimitKey = `gas:${payload.userId}`;
    if (checkRateLimit(rateLimitKey, RateLimits.GAS_TIP)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // メッセージを取得
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        session: true,
        responder: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // 回答メッセージでない場合はエラー
    if (message.role !== "ASSISTANT") {
      return NextResponse.json(
        { error: "Can only send gas to assistant messages" },
        { status: 400 }
      );
    }

    // 回答者が存在しない（AIの回答）場合はエラー
    if (!message.responderId || !message.responder) {
      return NextResponse.json(
        { error: "Can only send gas to human responses" },
        { status: 400 }
      );
    }

    // 自分の回答には送れない
    if (message.responderId === payload.userId) {
      return NextResponse.json(
        { error: "Cannot send gas to your own response" },
        { status: 400 }
      );
    }

    // 送信者のウォレットとユーザー情報を取得
    const senderWallet = await prisma.wallet.findUnique({
      where: { userId: payload.userId },
      include: {
        user: true,
      },
    });

    if (!senderWallet) {
      return NextResponse.json(
        { error: "Sender wallet not found" },
        { status: 404 }
      );
    }

    // 残高チェック
    if (senderWallet.balance < GAS_TIP_AMOUNT) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // トランザクション実行
    await prisma.$transaction(async (tx) => {
      // 送信者からYAMIを減らす
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: { decrement: GAS_TIP_AMOUNT } },
      });

      // 回答者にYAMIを追加
      await tx.wallet.update({
        where: { id: message.responder!.wallet!.id },
        data: { balance: { increment: GAS_TIP_AMOUNT } },
      });

      // メッセージのgasAmountを更新
      await tx.chatMessage.update({
        where: { id: messageId },
        data: { gasAmount: { increment: GAS_TIP_AMOUNT } },
      });

      // トランザクション記録（送信者の支出）
      await tx.transaction.create({
        data: {
          senderId: senderWallet.id,
          amount: -GAS_TIP_AMOUNT,
          txType: "GAS_TIP",
        },
      });

      // トランザクション記録（受信者の収入）
      await tx.transaction.create({
        data: {
          senderId: message.responder!.wallet!.id,
          amount: GAS_TIP_AMOUNT,
          txType: "GAS_TIP",
        },
      });
    });

    logger.info("Gas tip sent successfully", {
      messageId,
      senderId: payload.userId,
      recipientId: message.responderId,
      amount: GAS_TIP_AMOUNT,
    });

    // 通知を送信
    await notifyGasReceived(
      message.responderId,
      senderWallet.user.handle,
      message.session.id
    );

    return NextResponse.json({
      success: true,
      gasAmount: message.gasAmount + GAS_TIP_AMOUNT,
    });
  } catch (error) {
    logger.error("Send gas error", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
