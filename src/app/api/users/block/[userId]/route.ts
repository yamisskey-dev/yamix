import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// DELETE /api/users/block/[userId] - Unblock a user
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { userId: blockedUserId } = await params;

  try {
    // Try to delete the block
    try {
      await prisma.userBlock.delete({
        where: {
          blockerId_blockedId: {
            blockerId: payload.userId,
            blockedId: blockedUserId,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "ブロックを解除しました",
      });
    } catch (error: unknown) {
      // Check if it's a Prisma error with a code property
      if (typeof error === "object" && error !== null && "code" in error) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2025") {
          // Record not found
          return NextResponse.json(
            { error: "ブロックが見つかりません" },
            { status: 404 }
          );
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error("Unblock user error", { blockedUserId }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
