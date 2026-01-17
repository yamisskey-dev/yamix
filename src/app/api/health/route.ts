import { NextResponse } from "next/server";
import { prisma, isPrismaAvailable } from "@/lib/prisma";

export async function GET() {
  const status = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: "unknown",
  };

  try {
    if (isPrismaAvailable() && prisma) {
      await prisma.$queryRaw`SELECT 1`;
      status.database = "connected";
    } else {
      status.database = "in-memory";
    }
  } catch {
    status.database = "disconnected";
    status.status = "degraded";
  }

  return NextResponse.json(status);
}
