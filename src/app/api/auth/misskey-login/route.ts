import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaAvailable, memoryDB, generateId } from "@/lib/prisma";
import { RedisService } from "@/lib/redis";
import { detectInstance, isMisskeyLike } from "@/lib/detect-instance";
import { logger } from "@/lib/logger";
import type { MiAuthSession } from "@/types";

const WEB_URL = process.env.WEB_URL || "http://localhost:3000";

interface LoginRequest {
  host: string;
}

interface ServerRecord {
  id: string;
  instances: string;
  instanceType: string;
  appSecret: string | null;
}

export async function POST(req: NextRequest) {
  let data: LoginRequest;

  try {
    data = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!data.host || typeof data.host !== "string") {
    return NextResponse.json(
      { error: "Host is required" },
      { status: 400 }
    );
  }

  const misskeyHost = data.host.toLowerCase().trim();

  try {
    // Check instance type
    const instanceType = await detectInstance(misskeyHost);

    if (!instanceType || !isMisskeyLike(instanceType)) {
      return NextResponse.json(
        { error: "This is not a supported Misskey instance" },
        { status: 400 }
      );
    }

    // Check if we have existing app credentials for this instance
    let server: ServerRecord | null = null;

    if (isPrismaAvailable() && prisma) {
      server = await prisma.server.findFirst({
        where: { instances: misskeyHost },
      });
    } else {
      // Use in-memory storage
      server = memoryDB.servers.get(misskeyHost) || null;
    }

    // If no app exists or appSecret is invalid, create new app
    if (!server || !server.appSecret) {
      const appPayload = {
        name: "Yamix",
        description: "Yamii AI相談フロントエンド - 人生相談AIプラットフォーム",
        permission: ["read:account"],
        callbackUrl: `${WEB_URL}/misskey-callback`,
      };

      const createAppRes = await fetch(`https://${misskeyHost}/api/app/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appPayload),
      });

      if (!createAppRes.ok) {
        const errorText = await createAppRes.text();
        logger.error("Failed to create Misskey app:", { detail: errorText });
        return NextResponse.json(
          { error: `Failed to create app on instance: ${errorText}` },
          { status: 500 }
        );
      }

      const appData = await createAppRes.json();
      const appSecret = appData.secret;

      // Store server record
      if (isPrismaAvailable() && prisma) {
        server = await prisma.server.upsert({
          where: { instances: misskeyHost },
          update: {
            appSecret,
            instanceType,
          },
          create: {
            instances: misskeyHost,
            appSecret,
            instanceType,
          },
        });
      } else {
        // Use in-memory storage
        const now = new Date();
        server = {
          id: server?.id || generateId(),
          instances: misskeyHost,
          instanceType,
          appSecret,
        };
        memoryDB.servers.set(misskeyHost, {
          ...server,
          createdAt: now,
          updatedAt: now,
        });
      }

      console.log(`Created new Misskey app for ${misskeyHost}`);
    }

    // Generate auth session
    const sessionRes = await fetch(
      `https://${misskeyHost}/api/auth/session/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appSecret: server.appSecret }),
      }
    );

    if (!sessionRes.ok) {
      const errorData = await sessionRes.json().catch(() => ({}));

      // If app secret is invalid, clear it and retry
      if (errorData.error?.code === "NO_SUCH_APP") {
        if (isPrismaAvailable() && prisma) {
          await prisma.server.update({
            where: { instances: misskeyHost },
            data: { appSecret: null },
          });
        } else {
          const existing = memoryDB.servers.get(misskeyHost);
          if (existing) {
            existing.appSecret = null;
          }
        }
        return NextResponse.json(
          { error: "App credentials expired. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create auth session" },
        { status: 500 }
      );
    }

    const authSession: MiAuthSession = await sessionRes.json();

    // Store session token with 5 minute expiry
    await RedisService.setWithExpiry(
      `login/misskey/${authSession.token}`,
      JSON.stringify({ token: authSession.token, host: misskeyHost, serverId: server.id }),
      300
    );

    console.log(`Created Misskey auth session for ${misskeyHost}`);

    return NextResponse.json(authSession);
  } catch (error) {
    logger.error("Misskey login error:", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
