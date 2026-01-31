import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";

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
    let user: {
      id: string;
      handle: string;
      account: string;
      hostName: string;
      ethAddress: string | null;
    } | null = null;
    let profile: {
      displayName: string | null;
      avatarUrl: string | null;
    } | null = null;

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { profile: true },
    });

    if (dbUser) {
      user = dbUser;
      profile = dbUser.profile;
    }

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: user.id,
      handle: user.handle,
      account: user.account,
      hostName: user.hostName,
      displayName: profile?.displayName,
      avatarUrl: profile?.avatarUrl,
      ethAddress: user.ethAddress,
      allowDirectedConsult: (profile as { allowDirectedConsult?: boolean })?.allowDirectedConsult ?? false,
    });
  } catch (error) {
    logger.error("Get profile error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/auth/me - Update profile settings
export async function PATCH(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { allowDirectedConsult?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await prisma.profile.update({
      where: { userId: payload.userId },
      data: {
        ...(body.allowDirectedConsult !== undefined && { allowDirectedConsult: body.allowDirectedConsult }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Update profile error", {}, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
