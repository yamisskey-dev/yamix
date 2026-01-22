import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma, isPrismaAvailable, memoryDB, generateId } from "@/lib/prisma";
import { RedisService } from "@/lib/redis";
import { createJWT, createTokenCookie } from "@/lib/jwt";
import { TOKEN_ECONOMY } from "@/types";

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
  let data: CallbackRequest;

  try {
    data = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

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

    if (isPrismaAvailable() && prisma) {
      server = await prisma.server.findFirst({
        where: { instances: host },
      });
    } else {
      server = memoryDB.servers.get(host) || null;
    }

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
      console.error("Failed to get userkey:", errorText);
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

    if (isPrismaAvailable() && prisma) {
      // Upsert user with wallet in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Upsert user
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

        // Upsert profile
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

        // Create wallet if not exists (1:1 relation)
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
    } else {
      // Use in-memory storage
      const existingUser = Array.from(memoryDB.users.values()).find(u => u.handle === handle);

      if (existingUser) {
        existingUser.token = hashedToken;
        existingUser.updatedAt = now;
        userId = existingUser.id;
      } else {
        userId = generateId();
        memoryDB.users.set(handle, {
          id: userId,
          handle,
          account: misskeyUser.username,
          hostName: host,
          token: hashedToken,
          serverId: server.id,
          ethAddress: null,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Upsert profile in memory
      const existingProfile = memoryDB.profiles.get(userId);
      if (existingProfile) {
        existingProfile.displayName = misskeyUser.name || misskeyUser.username;
        existingProfile.avatarUrl = misskeyUser.avatarUrl || null;
        existingProfile.updatedAt = now;
      } else {
        memoryDB.profiles.set(userId, {
          id: generateId(),
          userId,
          displayName: misskeyUser.name || misskeyUser.username,
          avatarUrl: misskeyUser.avatarUrl || null,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Create wallet if not exists (1:1 relation)
      const existingWallet = Array.from(memoryDB.wallets.values()).find(w => w.userId === userId);
      if (existingWallet) {
        walletId = existingWallet.id;
      } else {
        walletId = generateId();
        memoryDB.wallets.set(walletId, {
          id: walletId,
          address: generateAddress(),
          balance: TOKEN_ECONOMY.INITIAL_BALANCE,
          walletType: "HUMAN",
          userId,
          createdAt: now,
        });
      }
    }

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

    console.log(`User logged in: ${handle}`);

    return response;
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
