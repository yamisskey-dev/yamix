import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, ErrorResponses } from "@/lib/api-helpers";
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
    const auth = await authenticateRequest(req);
    if ("error" in auth) return auth.error;
    const { payload } = auth;

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

    // トランザクション実行（残高チェックも含める - SECURITY: Race condition fix）
    const result = await prisma.$transaction(async (tx) => {
      // SECURITY FIX: Check balance inside transaction to prevent race conditions
      const senderWallet = await tx.wallet.findUnique({
        where: { userId: payload.userId },
        include: {
          user: true,
        },
      });

      if (!senderWallet) {
        throw new Error("Sender wallet not found");
      }

      // 残高チェック（トランザクション内）
      if (senderWallet.balance < GAS_TIP_AMOUNT) {
        throw new Error("Insufficient balance");
      }

      // 受信者のウォレットを取得
      const recipientWallet = await tx.wallet.findUnique({
        where: { id: message.responder!.wallet!.id },
      });

      if (!recipientWallet) {
        throw new Error("Recipient wallet not found");
      }
      // 送信者からYAMIを減らす
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: { decrement: GAS_TIP_AMOUNT } },
      });

      // 回答者にYAMIを追加
      await tx.wallet.update({
        where: { id: recipientWallet.id },
        data: { balance: { increment: GAS_TIP_AMOUNT } },
      });

      // メッセージのgasAmountを更新
      const updatedMessage = await tx.chatMessage.update({
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
          senderId: recipientWallet.id,
          amount: GAS_TIP_AMOUNT,
          txType: "GAS_TIP",
        },
      });

      return {
        senderHandle: senderWallet.user.handle,
        newGasAmount: updatedMessage.gasAmount,
      };
    });

    // Handle transaction errors
    if (!result) {
      return NextResponse.json(
        { error: "Transaction failed" },
        { status: 500 }
      );
    }

    const { senderHandle, newGasAmount } = result;

    logger.info("Gas tip sent successfully", {
      messageId,
      senderId: payload.userId,
      recipientId: message.responderId,
      amount: GAS_TIP_AMOUNT,
    });

    // 通知を送信
    await notifyGasReceived(
      message.responderId,
      senderHandle,
      message.session.id
    );

    return NextResponse.json({
      success: true,
      gasAmount: newGasAmount,
    });
  } catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === "Insufficient balance") {
        return NextResponse.json(
          { error: "Insufficient balance" },
          { status: 400 }
        );
      }
      if (error.message === "Sender wallet not found") {
        return NextResponse.json(
          { error: "Sender wallet not found" },
          { status: 404 }
        );
      }
    }

    logger.error("Send gas error", {}, error);
    return ErrorResponses.internalError();
  }
}
