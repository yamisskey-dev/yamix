"use client";

import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { localSessionStore } from "@/lib/local-session-store";
import { useToastActions } from "@/components/Toast";
import type { LocalMessage, SessionInfo } from "./chat-types";

type LocalSession = ReturnType<typeof localSessionStore.get>;

interface CurrentUser {
  id: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * ローカルセッション（local- プレフィックス）の初期化とサーバー同期
 */
export function useLocalSessionSync(opts: {
  isLocalSession: boolean;
  localSession: LocalSession | null;
  currentUser: CurrentUser | null | undefined;
  pendingServerSessionId: string | null;
  setPendingServerSessionId: Dispatch<SetStateAction<string | null>>;
  setSessionInfo: Dispatch<SetStateAction<SessionInfo | null>>;
  setMessages: Dispatch<SetStateAction<LocalMessage[]>>;
}) {
  const {
    isLocalSession,
    localSession,
    currentUser,
    pendingServerSessionId,
    setPendingServerSessionId,
    setSessionInfo,
    setMessages,
  } = opts;

  const router = useRouter();
  const toast = useToastActions();

  useEffect(() => {
    if (!isLocalSession || !localSession || !currentUser) return;

    // Set session info from local data
    setSessionInfo({
      consultType: localSession.consultType as "PRIVATE" | "PUBLIC" | "DIRECTED",
      userId: currentUser.id,
      isOwner: true,
      isAnonymous: localSession.isAnonymous,
      currentUserId: currentUser.id,
      title: null,
      responseCount: 0,
    });

    // Display local messages
    const localMessages: LocalMessage[] = localSession.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: typeof m.content === "string" ? m.content : "[メッセージ]",
      timestamp: m.timestamp,
      responder: undefined,
    }));

    // Only update messages if not currently streaming (prevents overwriting AI response)
    setMessages((prev) => {
      // Skip if assistant message already exists (SSE streaming completed or in progress)
      if (prev.some((m) => m.role === "assistant")) {
        return prev;
      }
      // Skip if messages are not empty and have same content (avoid unnecessary re-initialization)
      if (prev.length > 0 && prev.length === localMessages.length) {
        return prev;
      }
      return localMessages;
    });

    // Start immediate sync (not background!)
    if (!localSession.synced && !localSession.syncing) {
      import("@/lib/sync-session").then(({ syncSessionToServer }) => {
        syncSessionToServer({
          localId: localSession.id,
          onSuccess: (serverId) => {
            // Update state to trigger initial message send useEffect
            setPendingServerSessionId(serverId);

            // Also save to sessionStorage for persistence
            sessionStorage.setItem(`pendingServerSession-${localSession.id}`, serverId);
            sessionStorage.setItem(`pendingInitialMessage-${serverId}`, localSession.id);

            // DON'T navigate yet - will navigate after SSE completes
          },
          onError: (error) => {
            console.error("[LOCAL SESSION] Sync failed:", error);
            toast.error("サーバーとの同期に失敗しました");
          },
        });
      });
    } else if (localSession.synced && localSession.serverId && !pendingServerSessionId) {
      // Already synced (from previous visit), redirect to server session immediately
      // NOTE: If pendingServerSessionId exists, we're in the middle of initial message send, don't redirect yet
      router.replace(`/main/chat/${localSession.serverId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocalSession, localSession, currentUser, router, toast]);
}
