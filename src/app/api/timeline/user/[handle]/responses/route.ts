import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifyJWT, getTokenFromCookie } from "@/lib/jwt";
import type { TimelineConsultation, TimelineResponse } from "@/types";
import { decryptMessage } from "@/lib/encryption";

// In-memory types
interface MemoryChatMessage {
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  isCrisis: boolean;
  responderId?: string;
  isAnonymous: boolean;
  createdAt: Date;
}

interface MemoryChatSession {
  id: string;
  userId: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC";
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface RouteParams {
  params: Promise<{ handle: string }>;
}

// GET /api/timeline/user/[handle]/responses - Get user's responses to public consultations
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { handle } = await params;
  const decodedHandle = decodeURIComponent(handle);

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const cursor = searchParams.get("cursor");

  try {
    const db = getPrismaClient();

    // Check if the viewer is authenticated and viewing their own profile
    const token = getTokenFromCookie(req.headers.get("cookie"));
    let currentUserId: string | null = null;
    if (token) {
      const payload = await verifyJWT(token);
      if (payload) {
        currentUserId = payload.userId;
      }
    }

    if (db) {
      // Find user by handle
      const user = await db.user.findUnique({
        where: { handle: decodedHandle },
        include: { profile: true },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Check if viewing own profile
      const isOwnProfile = currentUserId === user.id;

      // Get user's responses (as responderId)
      const responses = await db.chatMessage.findMany({
        where: {
          responderId: user.id,
          role: "ASSISTANT",
          ...(isOwnProfile ? {} : { isAnonymous: false }), // 他人のプロフィールでは匿名回答を除外
          session: {
            consultType: "PUBLIC", // Only public consultations
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        include: {
          session: {
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
              messages: {
                where: { role: "USER" },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
        },
      });

      const hasMore = responses.length > limit;
      const items = responses.slice(0, limit);

      const consultations: TimelineConsultation[] = items.map((response) => {
        const session = response.session;
        // Decrypt message content (backwards compatible)
        const rawQuestion = session.messages[0]?.content || "";
        const question = decryptMessage(rawQuestion, session.userId);
        const answer = decryptMessage(response.content, session.userId);

        return {
          id: response.id,
          sessionId: session.id,
          question,
          answer,
          consultType: session.consultType,
          isAnonymous: session.isAnonymous,
          user: session.isAnonymous
            ? null
            : {
                handle: session.user.handle,
                displayName: session.user.profile?.displayName || null,
                avatarUrl: session.user.profile?.avatarUrl || null,
              },
          replyCount: 0,
          replies: [],
          createdAt: response.createdAt,
          isUserResponse: true, // このアイテムはユーザーの回答
          responder: response.isAnonymous
            ? null
            : {
                handle: user.handle,
                displayName: user.profile?.displayName || null,
                avatarUrl: user.profile?.avatarUrl || null,
              },
        };
      });

      const response: TimelineResponse = {
        consultations,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json({
        ...response,
        user: {
          handle: user.handle,
          displayName: user.profile?.displayName || null,
          avatarUrl: user.profile?.avatarUrl || null,
        },
      });
    } else {
      // In-memory fallback
      const allUsers = Array.from(memoryDB.users.values());
      const targetUser = allUsers.find((u) => u.handle === decodedHandle);

      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const isOwnProfile = currentUserId === targetUser.id;

      // Get user's responses
      const chatMessagesStore = memoryDB.chatMessages as Map<string, MemoryChatMessage>;
      const chatSessionsStore = memoryDB.chatSessions as unknown as Map<string, MemoryChatSession>;

      const userResponses = Array.from(chatMessagesStore.values())
        .filter((m) => m.responderId === targetUser.id && m.role === "ASSISTANT" && (isOwnProfile || !m.isAnonymous))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      let startIndex = 0;
      if (cursor) {
        const cursorIndex = userResponses.findIndex((r) => r.id === cursor);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }

      const responses = userResponses.slice(startIndex, startIndex + limit + 1);
      const hasMore = responses.length > limit;
      const items = responses.slice(0, limit);

      const consultations: TimelineConsultation[] = items
        .map((response) => {
          const session = chatSessionsStore.get(response.sessionId);
          if (!session || session.consultType !== "PUBLIC") return null;

          const messages = Array.from(chatMessagesStore.values())
            .filter((m) => m.sessionId === session.id && m.role === "USER")
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

          // Decrypt message content (backwards compatible)
          const rawQuestion = messages[0]?.content || "";
          const question = decryptMessage(rawQuestion, session.userId);
          const answer = decryptMessage(response.content, session.userId);

          return {
            id: response.id,
            sessionId: session.id,
            question,
            answer,
            consultType: session.consultType,
            isAnonymous: session.isAnonymous,
            user: session.isAnonymous
              ? null
              : {
                  handle: decodedHandle,
                  displayName: null as string | null,
                  avatarUrl: null as string | null,
                },
            replyCount: 0,
            replies: [],
            createdAt: response.createdAt,
            isUserResponse: true,
            responder: response.isAnonymous
              ? null
              : {
                  handle: decodedHandle,
                  displayName: null,
                  avatarUrl: null,
                },
          } as TimelineConsultation;
        })
        .filter((c): c is TimelineConsultation => c !== null);

      const responseData: TimelineResponse = {
        consultations,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json({
        ...responseData,
        user: {
          handle: decodedHandle,
          displayName: null,
          avatarUrl: null,
        },
      });
    }
  } catch (error) {
    logger.error("Get user responses error", { handle: decodedHandle }, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
