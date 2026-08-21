"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { localSessionStore } from "@/lib/local-session-store";
import { useToastActions } from "@/components/Toast";
import { handleSSEResponse } from "./sse-response";
import type { LocalMessage, SessionInfo } from "./chat-types";

interface CurrentUser {
  id: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * ローカルセッションの同期完了後、保留中の初回メッセージをサーバーへ送信する
 * （楽観的 UI: ローカル表示 → サーバー送信 → SSE 完了後にサーバーセッションへ遷移）
 */
export function useInitialMessageSend(opts: {
  sessionId: string;
  pendingServerSessionId: string | null;
  currentUser: CurrentUser | null | undefined;
  setMessages: Dispatch<SetStateAction<LocalMessage[]>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setSessionInfo: Dispatch<SetStateAction<SessionInfo | null>>;
  setShowCrisisAlert: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | undefined>>;
  streamingJustCompletedRef: MutableRefObject<boolean>;
}) {
  const {
    sessionId,
    pendingServerSessionId,
    currentUser,
    setMessages,
    setIsLoading,
    setSessionInfo,
    setShowCrisisAlert,
    setError,
    streamingJustCompletedRef,
  } = opts;

  const router = useRouter();
  const toast = useToastActions();
  const pendingMessageSentRef = useRef(false);

  useEffect(() => {
    // For local sessions, check if server session is ready
    let targetSessionId = sessionId;
    if (sessionId.startsWith("local-")) {
      if (!pendingServerSessionId) {
        return; // Wait for server session to be created
      }
      targetSessionId = pendingServerSessionId;
    }

    // Check if there's a pending initial message for the target session
    const pendingLocalId = sessionStorage.getItem(`pendingInitialMessage-${targetSessionId}`);
    if (!pendingLocalId || pendingMessageSentRef.current) {
      return;
    }

    // Get the local session to retrieve the initial message
    const localSession = localSessionStore.get(pendingLocalId);
    if (!localSession || localSession.messages.length === 0) {
      sessionStorage.removeItem(`pendingInitialMessage-${targetSessionId}`);
      return;
    }

    // Wait for currentUser to be loaded
    if (!currentUser) {
      return;
    }

    const initialMessage = localSession.messages[0];

    // Mark as sent immediately to prevent duplicate sends
    pendingMessageSentRef.current = true;
    sessionStorage.removeItem(`pendingInitialMessage-${targetSessionId}`);

    // Display local message immediately (optimistic UI)
    const displayContent = typeof initialMessage.content === "string"
      ? initialMessage.content
      : "[メッセージ]";

    const userMessage: LocalMessage = {
      id: initialMessage.id,
      role: "user",
      content: displayContent,
      timestamp: initialMessage.timestamp,
      responder: {
        displayName: currentUser.displayName,
        avatarUrl: currentUser.avatarUrl,
        handle: currentUser.handle,
      },
    };

    // Add message optimistically (preserve any existing messages)
    setMessages((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === userMessage.id)) {
        return prev;
      }
      return [...prev, userMessage];
    });
    setIsLoading(true);

    // Send message to SERVER session (not local session)
    fetch(`/api/chat/sessions/${targetSessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: initialMessage.content }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          console.error("[CHAT] Initial message send failed:", {
            status: res.status,
            statusText: res.statusText,
            body: errorText,
            targetSessionId,
          });
          throw new Error(`Failed to send initial message: ${res.status} ${res.statusText}`);
        }

        // Handle SSE response for AI reply
        await handleSSEResponse(res, userMessage.id, {
          setMessages,
          setIsLoading,
          setSessionInfo,
          setShowCrisisAlert,
          showToast: toast.showToast,
          onStreamComplete: async () => {
            streamingJustCompletedRef.current = true;

            // Navigate to server session AFTER SSE completes (prevents state loss)
            if (sessionId.startsWith("local-")) {
              // Find assistant message ID from current state
              setMessages((currentMessages) => {
                const assistantMsg = currentMessages.find((m) => m.role === "assistant");
                const assistantMessageId = assistantMsg?.id;

                // Poll server to verify DB save completed
                const pollForMessage = async (attemptCount = 0): Promise<void> => {
                  const maxAttempts = 15; // 15 attempts * 200ms = 3 seconds max

                  if (attemptCount >= maxAttempts) {
                    sessionStorage.removeItem(`pendingServerSession-${sessionId}`);
                    router.replace(`/main/chat/${targetSessionId}`);
                    return;
                  }

                  try {
                    const response = await fetch(`/api/chat/sessions/${targetSessionId}`);
                    if (response.ok) {
                      const data = await response.json();

                      // Check if assistant message exists in the response
                      const hasAssistantMessage = data.messages?.some(
                        (m: { id: string; role: string }) =>
                          m.role === "ASSISTANT" && (!assistantMessageId || m.id === assistantMessageId)
                      );

                      if (hasAssistantMessage) {
                        sessionStorage.removeItem(`pendingServerSession-${sessionId}`);
                        router.replace(`/main/chat/${targetSessionId}`);
                        return;
                      }
                    }

                    // Message not found yet, retry after 200ms
                    setTimeout(() => pollForMessage(attemptCount + 1), 200);
                  } catch (error) {
                    console.error("[LOCAL SESSION] Polling error:", error);
                    // On error, retry
                    setTimeout(() => pollForMessage(attemptCount + 1), 200);
                  }
                };

                // Start polling immediately
                pollForMessage();

                // Return currentMessages unchanged
                return currentMessages;
              });
            }
          },
        });
      })
      .catch((err) => {
        console.error("[CHAT] Initial message send failed:", err);
        setIsLoading(false);
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, pendingServerSessionId, currentUser, toast, router]);
}
