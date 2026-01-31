import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { RedisService } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { createJWT, createTokenCookie } from "@/lib/jwt";
import { TOKEN_ECONOMY } from "@/types";
import { parseJsonBody, ErrorResponses } from "@/lib/api-helpers";

// Generate an ETH-style address (0x + 40 hex chars)
function generateAddress(): string {
  return "0x" + randomBytes(20).toString("hex");
}

interface CallbackRequest {
  token: string;
  host: string;
}

interface MisskeyUser {
  id: string;
  username: string;
  name?: string;
  avatarUrl?: string;
}

export async function POST(req: NextRequest) {
  const bodyResult = await parseJsonBody<CallbackRequest>(req);
  if ("error" in bodyResult) return bodyResult.error;
  const data = bodyResult.data;

  if (!data.token || !data.host) {
    return NextResponse.json(
      { error: "Token and host are required" },
      { status: 400 }
    );
  }

  const { token, host } = data;

  try {
    // Verify session exists
    const sessionData = await RedisService.get(`login/misskey/${token}`);
    if (!sessionData) {
      return NextResponse.json(
        { error: "Session expired or invalid" },
        { status: 401 }
      );
    }

    const sessionInfo = JSON.parse(sessionData);

    // Get server info
    let server: { id: string; appSecret: string | null } | null = null;

    server = await prisma.server.findFirst({
      where: { instances: host },
    });

    if (!server || !server.appSecret) {
      return NextResponse.json(
        { error: "Server not found" },
        { status: 404 }
      );
    }

    // Get user key from Misskey
    const userKeyRes = await fetch(`https://${host}/api/auth/session/userkey`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appSecret: server.appSecret,
        token,
      }),
    });

    if (!userKeyRes.ok) {
      const errorText = await userKeyRes.text();
      logger.error("Failed to get userkey:", { detail: errorText });
      return NextResponse.json(
        { error: "Failed to authenticate with Misskey" },
        { status: 401 }
      );
    }

    const { accessToken, user: misskeyUser }: { accessToken: string; user: MisskeyUser } =
      await userKeyRes.json();

    // Create access token hash (Misskey's way)
    const hashedToken = createHash("sha256")
      .update(accessToken + server.appSecret, "utf-8")
      .digest("hex");

    // Create user handle
    const handle = `@${misskeyUser.username}@${host}`;
    const now = new Date();

    let userId: string;
    let walletId: string;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { handle },
        update: {
          token: hashedToken,
          updatedAt: now,
        },
        create: {
          handle,
          account: misskeyUser.username,
          hostName: host,
          token: hashedToken,
          serverId: server.id,
        },
        include: { wallet: true },
      });

      await tx.profile.upsert({
        where: { userId: user.id },
        update: {
          displayName: misskeyUser.name || misskeyUser.username,
          avatarUrl: misskeyUser.avatarUrl,
          updatedAt: now,
        },
        create: {
          userId: user.id,
          displayName: misskeyUser.name || misskeyUser.username,
          avatarUrl: misskeyUser.avatarUrl,
        },
      });

      let wallet = user.wallet;
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            address: generateAddress(),
            balance: TOKEN_ECONOMY.INITIAL_BALANCE,
            walletType: "HUMAN",
            userId: user.id,
          },
        });
      }

      return { user, wallet };
    });

    userId = result.user.id;
    walletId = result.wallet.id;

    // Clean up session
    await RedisService.delete(`login/misskey/${token}`);

    // Create JWT with walletId included
    const jwt = await createJWT({
      sub: handle,
      userId,
      walletId,
      hostName: host,
    });

    // Return success with Set-Cookie header
    const response = NextResponse.json({
      success: true,
      handle,
      walletId,
      displayName: misskeyUser.name || misskeyUser.username,
      avatarUrl: misskeyUser.avatarUrl,
    });

    response.headers.set("Set-Cookie", createTokenCookie(jwt));

    return response;
  } catch (error) {
    logger.error("Callback error:", {}, error);
    return ErrorResponses.internalError();
  }
}
