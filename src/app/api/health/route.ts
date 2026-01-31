import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const status = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: "unknown",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    status.database = "connected";
  } catch {
    status.database = "error";
    status.status = "degraded";
  }

  return NextResponse.json(status);
}
