import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";

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

    if (isPrismaAvailable() && prisma) {
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { profile: true },
      });

      if (dbUser) {
        user = dbUser;
        profile = dbUser.profile;
      }
    } else {
      // Use in-memory storage
      const memUser = Array.from(memoryDB.users.values()).find(
        (u) => u.id === payload.userId
      );

      if (memUser) {
        user = memUser;
        profile = memoryDB.profiles.get(memUser.id) || null;
      }
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
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
