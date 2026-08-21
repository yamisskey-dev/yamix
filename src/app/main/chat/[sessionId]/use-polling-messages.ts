"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { api } from "@/lib/api-client";
import type { LocalMessage, SessionInfo } from "./chat-types";

/** /poll エンドポイントが返すメッセージの形 */
interface PolledMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  gasAmount?: number;
  isCrisis?: boolean;
  responderId?: string | null;
  isAnonymous?: boolean;
  responder?: {
    displayName: string | null;
    avatarUrl: string | null;
    handle?: string;
  } | null;
}

/**
 * 公開相談の新着メッセージポーリング（指数バックオフ付き）
 */
export function usePollingMessages(opts: {
  sessionId: string;
  sessionInfo: SessionInfo | null;
  messages: LocalMessage[];
  setMessages: Dispatch<SetStateAction<LocalMessage[]>>;
  anonymousUserMapRef: MutableRefObject<Map<string, string>>;
}) {
  const { sessionId, sessionInfo, messages, setMessages, anonymousUserMapRef } = opts;

  const lastPollTimeRef = useRef<string | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const pollFailCountRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep messageIds ref in sync
  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
    if (messages.length > 0) {
      const latest = messages[messages.length - 1].timestamp.toISOString();
      if (!lastPollTimeRef.current || latest > lastPollTimeRef.current) {
        lastPollTimeRef.current = latest;
      }
    }
  }, [messages]);

  // Transform polled messages
  const transformPolledMessage = useCallback(
    (m: PolledMessage): LocalMessage | null => {
      if (!sessionInfo) return null;
      if (messageIdsRef.current.has(m.id)) return null;

      const { isOwner, currentUserId, isAnonymous } = sessionInfo;

      const isMyMessage =
        currentUserId &&
        ((m.role === "USER" && isOwner) ||
          (m.role === "ASSISTANT" && m.responderId === currentUserId));

      if (isMyMessage) {
        return {
          id: m.id,
          role: "user",
          content: m.content,
          timestamp: new Date(m.createdAt),
          gasAmount: m.gasAmount,
          isCrisis: m.isCrisis,
        };
      }

      if (!isOwner && m.role === "USER") {
        return {
          id: m.id,
          role: "assistant",
          content: m.content,
          timestamp: new Date(m.createdAt),
          gasAmount: m.gasAmount,
          isCrisis: m.isCrisis,
          responder: {
            displayName: null,
            avatarUrl: null,
            isAnonymous,
          },
        };
      }

      // Build anonymous label for new responders
      if (m.responderId && m.isAnonymous && m.responderId !== currentUserId) {
        if (!anonymousUserMapRef.current.has(m.responderId)) {
          anonymousUserMapRef.current.set(
            m.responderId,
            String.fromCharCode(65 + anonymousUserMapRef.current.size)
          );
        }
      }

      return {
        id: m.id,
        role: "assistant",
        content: m.content,
        timestamp: new Date(m.createdAt),
        gasAmount: m.gasAmount,
        isCrisis: m.isCrisis,
        responder: m.responder
          ? {
              displayName: m.isAnonymous
                ? `User ${anonymousUserMapRef.current.get(m.responderId!)}`
                : m.responder.displayName,
              avatarUrl: m.isAnonymous ? null : m.responder.avatarUrl,
              isAnonymous: m.isAnonymous,
              handle: m.isAnonymous ? undefined : m.responder.handle,
              responderId: m.responderId || undefined,
            }
          : undefined,
      };
    },
    [sessionInfo, anonymousUserMapRef]
  );

  // Poll for new messages with adaptive backoff
  useEffect(() => {
    if (!sessionInfo || sessionInfo.consultType === "PRIVATE") return;

    // Calculate polling interval with exponential backoff
    const getPollingInterval = () => {
      const failCount = pollFailCountRef.current;
      if (failCount === 0) return 5000;   // 5 seconds
      if (failCount === 1) return 10000;  // 10 seconds
      if (failCount === 2) return 30000;  // 30 seconds
      return 60000;                       // 60 seconds max
    };

    const poll = async () => {
      // Skip polling when tab is hidden (browser optimization)
      if (document.hidden) return;

      const after = lastPollTimeRef.current || new Date(0).toISOString();
      try {
        const data = await api.get<{ messages: PolledMessage[] }>(
          `/api/chat/sessions/${sessionId}/poll`,
          { params: { after } }
        );

        // Reset fail count on successful poll
        pollFailCountRef.current = 0;

        if (data.messages?.length > 0) {
          const newMsgs = data.messages
            .map(transformPolledMessage)
            .filter((m): m is LocalMessage => m !== null);
          if (newMsgs.length > 0) {
            setMessages((prev) => [...prev, ...newMsgs]);
          }
        }

        // Reschedule with base interval on success
        scheduleNextPoll(5000);
      } catch {
        // Increment fail count and reschedule with backoff
        pollFailCountRef.current++;
        const nextInterval = getPollingInterval();
        scheduleNextPoll(nextInterval);
      }
    };

    const scheduleNextPoll = (interval: number) => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
      pollIntervalRef.current = setTimeout(poll, interval);
    };

    // Start initial poll
    scheduleNextPoll(5000);

    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
    };
  }, [sessionId, sessionInfo, transformPolledMessage, setMessages]);
}
