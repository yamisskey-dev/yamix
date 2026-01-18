/**
 * Yamii プロンプト API プロキシ
 * Yamii API (/v1/config/prompt) へのプロキシエンドポイント
 */

import { NextRequest, NextResponse } from "next/server";

const YAMII_API_URL = process.env.YAMII_API_URL || "http://localhost:8000";

interface YamiiPromptResponse {
  prompt: string;
  updated_at: string | null;
  source: "file" | "default";
}

/**
 * GET /api/system/prompt
 * Yamiiからデフォルトプロンプトを取得
 */
export async function GET() {
  try {
    const res = await fetch(`${YAMII_API_URL}/v1/config/prompt`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // サーバーサイドなのでキャッシュを無効化
      cache: "no-store",
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: `Yamii API error: ${error}` },
        { status: res.status }
      );
    }

    const data: YamiiPromptResponse = await res.json();

    // フロントエンド用にレスポンスを変換
    return NextResponse.json({
      prompt: data.prompt,
      updatedAt: data.updated_at,
      source: data.source,
    });
  } catch (error) {
    console.error("Failed to fetch prompt from Yamii:", error);
    return NextResponse.json(
      { error: "Yamii APIへの接続に失敗しました" },
      { status: 503 }
    );
  }
}

/**
 * PUT /api/system/prompt
 * Yamiiのデフォルトプロンプトを更新
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${YAMII_API_URL}/v1/config/prompt`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: `Yamii API error: ${error}` },
        { status: res.status }
      );
    }

    const data: YamiiPromptResponse = await res.json();

    // フロントエンド用にレスポンスを変換
    return NextResponse.json({
      prompt: data.prompt,
      updatedAt: data.updated_at,
      source: data.source,
    });
  } catch (error) {
    console.error("Failed to update prompt on Yamii:", error);
    return NextResponse.json(
      { error: "Yamii APIへの接続に失敗しました" },
      { status: 503 }
    );
  }
}
