import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, ErrorResponses } from "@/lib/api-helpers";

/**
 * GET /api/crypto/key
 * ユーザーの暗号化されたマスター鍵を取得
 * クロスデバイス対応: 他のデバイスからログインした際に鍵を復元
 */
export async function GET(request: NextRequest) {
  try {
    // JWT 認証 (Cookie から)
    const auth = await authenticateRequest(request);
    if ("error" in auth) return auth.error;
    const { payload } = auth;

    // ユーザーの暗号化鍵を取得
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        encryptedMasterKey: true,
        masterKeySalt: true,
        masterKeyIv: true,
      },
    });

    if (!user || !user.encryptedMasterKey) {
      return NextResponse.json(
        { error: "Master key not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      encryptedKey: user.encryptedMasterKey,
      salt: user.masterKeySalt,
      iv: user.masterKeyIv,
    });
  } catch (error) {
    console.error("Error fetching master key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crypto/key
 * ユーザーの暗号化されたマスター鍵を保存
 * 初回ログイン時にクライアントが生成したマスター鍵を保存
 */
export async function POST(request: NextRequest) {
  try {
    // JWT 認証 (Cookie から)
    const auth = await authenticateRequest(request);
    if ("error" in auth) return auth.error;
    const { payload } = auth;

    const body = await request.json();
    const { encryptedKey, salt, iv } = body;

    if (!encryptedKey || !salt || !iv) {
      return NextResponse.json(
        { error: "Missing required fields: encryptedKey, salt, iv" },
        { status: 400 }
      );
    }

    // ユーザーの暗号化鍵を保存
    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        encryptedMasterKey: encryptedKey,
        masterKeySalt: salt,
        masterKeyIv: iv,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving master key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
