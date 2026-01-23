import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";

// Gas constants
const GAS_TIP_AMOUNT = 3; // 灯（ともしび）の金額

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/messages/[id]/gas
 * 回答に灯（ともしび）を送る
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

    const db = getPrismaClient();
    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    // メッセージを取得
    const message = await db.chatMessage.findUnique({
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

    // 送信者のウォレットを取得
    const senderWallet = await db.wallet.findUnique({
      where: { userId: payload.userId },
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
    await db.$transaction(async (tx) => {
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
