import { NextResponse } from "next/server";
import { yamiiClient } from "@/lib/yamii-client";

// Yamix version from package.json
const YAMIX_VERSION = process.env.npm_package_version || "1.0.0";

export async function GET() {
  let yamiiVersion: string | null = null;
  let yamiiStatus: "connected" | "error" = "error";

  try {
    const health = await yamiiClient.healthCheck();
    yamiiVersion = health.version;
    yamiiStatus = "connected";
  } catch {
    // Yamii unreachable
  }

  return NextResponse.json({
    yamix: {
      version: YAMIX_VERSION,
    },
    yamii: {
      version: yamiiVersion,
      status: yamiiStatus,
    },
  });
}
