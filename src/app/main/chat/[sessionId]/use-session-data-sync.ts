"use client";

import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ChatMessage, ChatSessionWithMessages } from "@/types";
import { transformMessage, type LocalMessage, type SessionInfo } from "./chat-types";

interface CurrentUser {
  id: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * SWR で取得したセッションデータを画面状態（sessionInfo / messages）へ反映する
 */
export function useSessionDataSync(opts: {
  sessionData: ChatSessionWithMessages | undefined;
  currentUser: CurrentUser | null | undefined;
  isLoading: boolean;
  anonymousUserMapRef: MutableRefObject<Map<string, string>>;
  streamingJustCompletedRef: MutableRefObject<boolean>;
  setSessionInfo: Dispatch<SetStateAction<SessionInfo | null>>;
  setMessages: Dispatch<SetStateAction<LocalMessage[]>>;
}) {
  const {
    sessionData,
    currentUser,
    isLoading,
    anonymousUserMapRef,
    streamingJustCompletedRef,
    setSessionInfo,
    setMessages,
  } = opts;

  useEffect(() => {
    if (!sessionData || !currentUser) return;

    const isOwner = sessionData.userId === currentUser.id;
    const currentUserId = currentUser.id;

    const responseCount = sessionData.messages.filter(
      (m: ChatMessage) => m.role === "ASSISTANT" && m.responderId
    ).length;

    setSessionInfo({
      consultType: sessionData.consultType,
      userId: sessionData.userId,
      isOwner,
      isAnonymous: sessionData.isAnonymous,
      currentUserId,
      title: sessionData.title,
      responseCount,
      crisisCount: sessionData.crisisCount,
      targets: sessionData.targets,
    });

    // Build anonymous user map
    const anonymousUserMap = new Map<string, string>();
    sessionData.messages.forEach((m: ChatMessage) => {
      if (m.responderId && m.isAnonymous && m.responderId !== currentUserId) {
        if (!anonymousUserMap.has(m.responderId)) {
          anonymousUserMap.set(m.responderId, String.fromCharCode(65 + anonymousUserMap.size));
        }
      }
    });
    anonymousUserMapRef.current = new Map(anonymousUserMap);

    // Update messages (SWR handles deduplication automatically)
    // Don't overwrite messages while loading (message is being sent)
    if (isLoading) return;

    setMessages((prev) => {
      // Skip if streaming just completed (prevent overwriting fresh AI response)
      if (streamingJustCompletedRef.current) {
        streamingJustCompletedRef.current = false; // Reset for next time
        return prev;
      }
      // Skip if local messages exist (not yet synced to server)
      const hasLocalMessages = prev.some(m => m.id.startsWith('local-'));
      if (hasLocalMessages) return prev;
      // If local state has more messages than server data, don't overwrite (race condition)
      if (prev.length > sessionData.messages.length) return prev;
      return sessionData.messages.map((m: ChatMessage) =>
        transformMessage(m, isOwner, currentUserId, sessionData.isAnonymous, sessionData.user, anonymousUserMap)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData, currentUser, isLoading]);
}
