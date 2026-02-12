import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { optionalAuth, ErrorResponses } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import type { TimelineConsultation, TimelineResponse } from "@/types";
import { decryptMessage } from "@/lib/encryption";
import { parseLimit } from "@/lib/validation";

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/timeline - Get individual posts (questions + answers) chronologically
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor");

  // Optional auth - if logged in, also show DIRECTED sessions targeting this user
  const payload = await optionalAuth(req);

  try {
    // Build session filter: PUBLIC + DIRECTED sessions targeting this user
    const sessionFilter: Record<string, unknown>[] = [{ consultType: "PUBLIC" }];
    if (payload) {
      sessionFilter.push({
        consultType: "DIRECTED",
        targets: { some: { userId: payload.userId } },
      });
      // Also show DIRECTED sessions owned by this user
      sessionFilter.push({
        consultType: "DIRECTED",
        userId: payload.userId,
      });
    }

    // Get all messages from visible sessions, ordered by creation time
    const messages = await prisma.chatMessage.findMany({
      where: {
        session: {
          OR: sessionFilter,
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
      const ownerId = session.user.id;

      // Decrypt message content (backwards compatible)
      const decryptedMsgContent = decryptMessage(msg.content, ownerId);

      // Find the previous USER message for this message
      let question = "";
      let questionMessage = null; // Store the actual message object
      if (msg.role === "USER") {
        question = decryptedMsgContent;
        questionMessage = msg;
      } else {
        // For ASSISTANT messages, find the most recent USER message before this one
        const allUserMessages = session.messages.filter((m) => m.role === "USER");
        const previousUserMessages = allUserMessages.filter(
          (m) => new Date(m.createdAt) < new Date(msg.createdAt)
        );

        if (previousUserMessages.length > 0) {
          questionMessage = previousUserMessages[previousUserMessages.length - 1];
          // Decrypt question content (backwards compatible)
          question = decryptMessage(questionMessage.content, ownerId);
        }
      }

      if (msg.role === "USER") {
        // User question post
        // Check if this USER message has a responder (someone other than owner asked)
        const questionAuthor = msg.responder || session.user;
        return {
          id: msg.id,
          sessionId: session.id,
          title: session.title || null,
          question: decryptedMsgContent,
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
          title: session.title || null,
          question, // Previous USER message (already decrypted)
          answer: decryptedMsgContent,
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
  } catch (error) {
    logger.error("Get timeline error", {}, error);
    return ErrorResponses.internalError();
  }
}
