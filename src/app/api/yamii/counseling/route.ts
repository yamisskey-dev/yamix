import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { yamiiClient } from "@/lib/yamii-client";
import type { ConversationMessage } from "@/types";
import { logger } from "@/lib/logger";

interface CounselingRequest {
  message: string;
  sessionId?: string;
  conversationHistory?: ConversationMessage[];
}

export async function POST(req: NextRequest) {
  // Verify authentication
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

  let data: CounselingRequest;

  try {
    data = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!data.message || typeof data.message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  try {
    const response = await yamiiClient.sendCounselingMessage(
      data.message,
      payload.sub, // Use user handle as user_id
      {
        sessionId: data.sessionId,
        conversationHistory: data.conversationHistory,
      }
    );

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Yamii API error:", {}, error);

    // Return fallback response when yamii is unavailable
    return NextResponse.json({
      response: "申し訳ありません。現在AIサーバーに接続できません。しばらくしてからもう一度お試しください。",
      session_id: data.sessionId || crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      emotion_analysis: {
        primary_emotion: "neutral",
        intensity: 0,
        stability: 1,
        is_crisis: false,
        all_emotions: { neutral: 1 },
        confidence: 0,
      },
      advice_type: "general_support",
      follow_up_questions: [],
      is_crisis: false,
      _offline: true, // Flag to indicate offline mode
    });
  }
}
