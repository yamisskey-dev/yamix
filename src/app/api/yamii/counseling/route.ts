import { NextRequest, NextResponse } from "next/server";
import { yamiiClient } from "@/lib/yamii-client";
import type { ConversationMessage } from "@/types";
import { logger } from "@/lib/logger";
import { authenticateRequest, parseJsonBody } from "@/lib/api-helpers";

interface CounselingRequest {
  message: string;
  sessionId?: string;
  conversationHistory?: ConversationMessage[];
}

export async function POST(req: NextRequest) {
  // Verify authentication
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const bodyResult = await parseJsonBody<CounselingRequest>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const data = bodyResult.data;

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
