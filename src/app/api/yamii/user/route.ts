import { NextRequest, NextResponse } from "next/server";
import { yamiiClient } from "@/lib/yamii-client";
import { logger } from "@/lib/logger";
import { authenticateRequest } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  try {
    const profile = await yamiiClient.getUserProfile(payload.userId);
    return NextResponse.json(profile);
  } catch (error) {
    // 404 is expected for first-time users
    const is404 = error instanceof Error && error.message.includes("404");
    if (is404) {
      logger.info("User profile not found in Yamii (first-time user), returning default profile", { userId: payload.userId });
    } else {
      logger.error("Failed to get yamii user profile:", {}, error);
    }
    // Return default profile if user doesn't exist yet
    return NextResponse.json({
      user_id: payload.userId,
      phase: "stranger",
      total_interactions: 0,
      trust_score: 0,
    });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  try {
    const body = await req.json();
    const { explicit_profile, display_name } = body;

    const result = await yamiiClient.updateUserProfile(payload.userId, {
      explicit_profile,
      display_name,
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Failed to update yamii user profile:", {}, error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  try {
    const result = await yamiiClient.deleteUserData(payload.userId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Failed to delete yamii user data:", {}, error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 }
    );
  }
}
