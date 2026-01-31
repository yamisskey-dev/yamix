import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { authenticateRequest, parseJsonBody, ErrorResponses } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

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
    return ErrorResponses.internalError();
  }
}

// PATCH /api/auth/me - Update profile settings
export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const bodyResult = await parseJsonBody<{ allowDirectedConsult?: boolean }>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

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
    return ErrorResponses.internalError();
  }
}
