import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { getPrismaClient } from "@/lib/prisma";

const SYSTEM_PROMPT_KEY = "default_prompt";

// GET: デフォルトプロンプトを取得（認証不要）
export async function GET() {
  try {
    const prisma = getPrismaClient();

    if (!prisma) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const config = await prisma.systemConfig.findUnique({
      where: { key: SYSTEM_PROMPT_KEY },
    });

    if (config) {
      return NextResponse.json({
        prompt: config.value,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
        source: "database",
      });
    }

    // DBにない場合（seed未実行）
    return NextResponse.json({
      prompt: "",
      updatedAt: null,
      updatedBy: null,
      source: "empty",
    });
  } catch (error) {
    console.error("Failed to get system prompt:", error);
    return NextResponse.json(
      { error: "Failed to get system prompt" },
      { status: 500 }
    );
  }
}

// PUT: デフォルトプロンプトを更新（ログインユーザーのみ）
export async function PUT(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const payload = await verifyJWT(token);

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not available" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { prompt } = body;

    if (typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt format" },
        { status: 400 }
      );
    }

    // DBにupsert
    const config = await prisma.systemConfig.upsert({
      where: { key: SYSTEM_PROMPT_KEY },
      update: {
        value: prompt,
        updatedBy: payload.userId,
      },
      create: {
        key: SYSTEM_PROMPT_KEY,
        value: prompt,
        updatedBy: payload.userId,
      },
    });

    return NextResponse.json({
      prompt: config.value,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
      source: "database",
    });
  } catch (error) {
    console.error("Failed to update system prompt:", error);
    return NextResponse.json(
      { error: "Failed to update system prompt" },
      { status: 500 }
    );
  }
}
