import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { yamiiClient } from "@/lib/yamii-client";

export async function GET(req: NextRequest) {
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

  try {
    const profile = await yamiiClient.getUserProfile(payload.userId);
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Failed to get yamii user profile:", error);
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

  try {
    const body = await req.json();
    const { explicit_profile, display_name } = body;

    const result = await yamiiClient.updateUserProfile(payload.userId, {
      explicit_profile,
      display_name,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update yamii user profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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

  try {
    const result = await yamiiClient.deleteUserData(payload.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to delete yamii user data:", error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 }
    );
  }
}
