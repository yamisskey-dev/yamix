import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, memoryDB } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { TimelineConsultation, TimelineResponse } from "@/types";

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory types
interface MemoryChatSession {
  id: string;
  userId: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC";
  isAnonymous: boolean;
  createdAt: Date;
}

interface MemoryChatMessage {
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  responderId?: string;
  createdAt: Date;
}

// Access memory stores from memoryDB
const chatSessionsStore = memoryDB.chatSessions as Map<string, MemoryChatSession>;
const chatMessagesStore = memoryDB.chatMessages as Map<string, MemoryChatMessage>;

// GET /api/timeline - Get individual posts (questions + answers) chronologically
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const cursor = searchParams.get("cursor");

  try {
    const db = getPrismaClient();

    if (db) {
      // Get all messages from public sessions, ordered by creation time
      const messages = await db.chatMessage.findMany({
        where: {
          session: {
            consultType: "PUBLIC",
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
                orderBy: { createdAt: "asc" },
                include: {
                  responder: {
                    include: {
                      profile: true,
                    },
                  },
                },
              },
            },
          },
          responder: {
            include: {
              profile: true,
            },
          },
        },
      });

      const hasMore = messages.length > limit;
      const items = messages.slice(0, limit);

      const consultations: TimelineConsultation[] = items.map((msg) => {
        const session = msg.session;

        // Find the previous USER message for this message
        let question = "";
        let questionMessage = null; // Store the actual message object
        if (msg.role === "USER") {
          question = msg.content;
          questionMessage = msg;
        } else {
          // For ASSISTANT messages, find the most recent USER message before this one
          const allUserMessages = session.messages.filter((m: any) => m.role === "USER");
          const previousUserMessages = allUserMessages.filter(
            (m: any) => new Date(m.createdAt) < new Date(msg.createdAt)
          );

          if (previousUserMessages.length > 0) {
            questionMessage = previousUserMessages[previousUserMessages.length - 1];
            question = questionMessage.content;
          }
        }

        if (msg.role === "USER") {
          // User question post
          // Check if this USER message has a responder (someone other than owner asked)
          const questionAuthor = msg.responder || session.user;
          return {
            id: msg.id,
            sessionId: session.id,
            question: msg.content,
            answer: null,
            consultType: session.consultType,
            isAnonymous: session.isAnonymous,
            user: session.isAnonymous
              ? null
              : {
                  handle: questionAuthor.handle,
                  displayName: questionAuthor.profile?.displayName || null,
                  avatarUrl: questionAuthor.profile?.avatarUrl || null,
                },
            replyCount: 0,
            replies: [],
            createdAt: msg.createdAt,
            isUserResponse: false,
          };
        } else {
          // Assistant response post
          // Determine who asked the question (from questionMessage)
          let questionAuthor = session.user; // Default to session owner
          if (questionMessage && questionMessage.responder) {
            // Someone else asked this question
            questionAuthor = questionMessage.responder;
          }

          return {
            id: msg.id,
            sessionId: session.id,
            question, // Previous USER message
            answer: msg.content,
            consultType: session.consultType,
            isAnonymous: session.isAnonymous,
            user: session.isAnonymous
              ? null
              : {
                  handle: questionAuthor.handle,
                  displayName: questionAuthor.profile?.displayName || null,
                  avatarUrl: questionAuthor.profile?.avatarUrl || null,
                },
            replyCount: 0,
            replies: [],
            createdAt: msg.createdAt,
            isUserResponse: true,
            responder: msg.responder
              ? {
                  handle: msg.responder.handle,
                  displayName: msg.responder.profile?.displayName || null,
                  avatarUrl: msg.responder.profile?.avatarUrl || null,
                }
              : null, // null means AI response
          };
        }
      });

      const response: TimelineResponse = {
        consultations,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json(response);
    } else {
      // In-memory fallback
      const allMessages = Array.from(chatMessagesStore.values())
        .map((msg) => {
          const session = chatSessionsStore.get(msg.sessionId);
          if (!session || session.consultType !== "PUBLIC") return null;
          return { msg, session };
        })
        .filter((item): item is { msg: MemoryChatMessage; session: MemoryChatSession } => item !== null)
        .sort((a, b) => b.msg.createdAt.getTime() - a.msg.createdAt.getTime());

      let startIndex = 0;
      if (cursor) {
        const cursorIndex = allMessages.findIndex((item) => item.msg.id === cursor);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }

      const messages = allMessages.slice(startIndex, startIndex + limit + 1);
      const hasMore = messages.length > limit;
      const items = messages.slice(0, limit);

      const consultations: TimelineConsultation[] = items.map(({ msg, session }) => {
        // Find the previous USER message for this message
        let question = "";
        let questionMessage: MemoryChatMessage | null = null;
        if (msg.role === "USER") {
          question = msg.content;
          questionMessage = msg;
        } else {
          // For ASSISTANT messages, find the most recent USER message before this one
          const sessionMessages = Array.from(chatMessagesStore.values())
            .filter((m) => m.sessionId === session.id && m.role === "USER" && m.createdAt < msg.createdAt)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          if (sessionMessages.length > 0) {
            questionMessage = sessionMessages[sessionMessages.length - 1];
            question = questionMessage.content;
          }
        }

        if (msg.role === "USER") {
          return {
            id: msg.id,
            sessionId: session.id,
            question: msg.content,
            answer: null,
            consultType: session.consultType,
            isAnonymous: session.isAnonymous,
            user: session.isAnonymous
              ? null
              : {
                  handle: "anonymous",
                  displayName: null as string | null,
                  avatarUrl: null as string | null,
                },
            replyCount: 0,
            replies: [],
            createdAt: msg.createdAt,
            isUserResponse: false,
          } as TimelineConsultation;
        } else {
          return {
            id: msg.id,
            sessionId: session.id,
            question, // Previous USER message
            answer: msg.content,
            consultType: session.consultType,
            isAnonymous: session.isAnonymous,
            user: session.isAnonymous
              ? null
              : {
                  handle: "anonymous",
                  displayName: null as string | null,
                  avatarUrl: null as string | null,
                },
            replyCount: 0,
            replies: [],
            createdAt: msg.createdAt,
            isUserResponse: true,
            responder: null, // In-memory doesn't have responder info
          } as TimelineConsultation;
        }
      });

      const response: TimelineResponse = {
        consultations,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    logger.error("Get timeline error", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
