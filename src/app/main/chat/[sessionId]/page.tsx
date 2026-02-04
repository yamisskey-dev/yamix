"use client";

import { useState, useRef, useEffect, useCallback, use, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { encodeHandle } from "@/lib/encode-handle";
import { ChatBubble, CrisisAlert } from "@/components/ChatBubble";
import { ConsultTypeIcon, getConsultTypeLabel } from "@/components/ConsultTypeIcon";
import { CrisisStrikeIndicator } from "@/components/CrisisStrikeIndicator";
import { localSessionStore, type OptimisticSession } from "@/lib/local-session-store";

// 動的インポートで初期ロードを高速化
const BookmarkButton = lazy(() => import("@/components/BookmarkButton").then(mod => ({ default: mod.BookmarkButton })));
const LoadingSpinner = lazy(() => import("@/components/LoadingSpinner").then(mod => ({ default: mod.LoadingSpinner })));
const ConfirmModal = lazy(() => import("@/components/Modal").then(mod => ({ default: mod.ConfirmModal })));
import { chatApi, userApi, messageApi, api } from "@/lib/api-client";
import { processSSEStream } from "@/hooks/useSSEStream";
import { clientLogger } from "@/lib/client-logger";
import { devLog } from "@/lib/dev-logger";
import { useToastActions } from "@/components/Toast";
import type { ChatMessage, ChatSessionWithMessages } from "@/types";
import { messageQueue } from "@/lib/message-queue";
import { indexedDB } from "@/lib/indexed-db";
import { hasMentionYamii } from "@/lib/constants";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

interface ResponderInfo {
  displayName: string | null;
  avatarUrl: string | null;
  isAnonymous?: boolean;
  handle?: string;
  responderId?: string;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  responder?: ResponderInfo | null;
  gasAmount?: number;
  isCrisis?: boolean;
}

interface SessionInfo {
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
  userId: string;
  isOwner: boolean;
  isAnonymous: boolean;
  currentUserId: string | null;
  title: string | null;
  responseCount: number;
  crisisCount?: number;
  targets?: { userId: string; handle: string; displayName: string | null }[];
}

// SWR fetcher function
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('NOT_FOUND');
    }
    throw new Error('Failed to fetch');
  }
  return res.json();
};

/**
 * サーバーメッセージをローカル表示用に変換
 * 注: E2EE復号は呼び出し元で事前に完了している前提
 */
function transformMessage(
  m: ChatMessage,
  isOwner: boolean,
  currentUserId: string | null,
  sessionIsAnonymous: boolean,
  sessionUser: ChatSessionWithMessages["user"],
  anonymousUserMap: Map<string, string>
): LocalMessage {
  const isMyMessage = currentUserId && (
    (m.role === "USER" && isOwner) ||
    (m.role === "ASSISTANT" && m.responderId === currentUserId)
  );

  if (isMyMessage) {
    return {
      id: m.id,
      role: "user",
      content: m.content as string,
      timestamp: new Date(m.createdAt),
      gasAmount: m.gasAmount,
      isCrisis: m.isCrisis,
    };
  }

  if (!isOwner && m.role === "USER") {
    return {
      id: m.id,
      role: "assistant",
      content: m.content as string,
      timestamp: new Date(m.createdAt),
      gasAmount: m.gasAmount,
      isCrisis: m.isCrisis,
      responder: {
        displayName: sessionIsAnonymous ? null : (sessionUser?.displayName || null),
        avatarUrl: sessionIsAnonymous ? null : (sessionUser?.avatarUrl || null),
        isAnonymous: sessionIsAnonymous,
        handle: sessionIsAnonymous ? undefined : sessionUser?.handle,
      },
    };
  }

  return {
    id: m.id,
    role: "assistant",
    content: m.content as string,
    timestamp: new Date(m.createdAt),
    gasAmount: m.gasAmount,
    isCrisis: m.isCrisis,
    responder: m.responder ? {
      displayName: m.isAnonymous
        ? `User ${anonymousUserMap.get(m.responderId!)}`
        : m.responder.displayName,
      avatarUrl: m.isAnonymous ? null : m.responder.avatarUrl,
      isAnonymous: m.isAnonymous,
      handle: m.isAnonymous ? undefined : m.responder.handle,
      responderId: m.responderId || undefined,
    } : undefined,
  };
}

/**
 * 危機アラートのチェックと表示
 */
function checkCrisisAlert(isCrisis: boolean | undefined): boolean {
  if (!isCrisis) return false;
  const disabled = localStorage.getItem("yamix_crisis_alert_disabled");
  return !disabled;
}

/**
 * SSEストリーミングレスポンスの処理
 * 初回メッセージ送信とチャット送信で共通化
 */
async function handleSSEResponse(
  res: Response,
  userMessageId: string,
  callbacks: {
    setMessages: React.Dispatch<React.SetStateAction<LocalMessage[]>>;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setSessionInfo: React.Dispatch<React.SetStateAction<SessionInfo | null>>;
    setShowCrisisAlert: React.Dispatch<React.SetStateAction<boolean>>;
    showToast: (message: string, type?: "success" | "error" | "warning" | "info") => void;
    onStreamComplete?: () => void;
  }
): Promise<void> {
  const contentType = res.headers.get("content-type") || "";
  devLog.log('[SSE DEBUG] handleSSEResponse called, contentType:', contentType);

  if (contentType.includes("text/event-stream") && res.body) {
    const streamingMsgId = crypto.randomUUID();
    let streamStarted = false;
    let chunkCount = 0;
    let contentBuffer = "";
    let rafId: number | null = null;

    // Batch chunk updates using requestAnimationFrame
    const flushContentBuffer = () => {
      if (contentBuffer.length > 0) {
        const bufferedContent = contentBuffer;
        contentBuffer = "";
        callbacks.setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId
              ? { ...m, content: m.content + bufferedContent }
              : m
          )
        );
      }
      rafId = null;
    };

    const scheduleUpdate = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(flushContentBuffer);
      }
    };

    try {
      devLog.log('[SSE DEBUG] Starting SSE stream processing');
      await processSSEStream(res, {
        onInit(event) {
          devLog.log('[SSE DEBUG] onInit called, event:', event);
          if (event.userMessageId) {
            callbacks.setMessages((prev) =>
              prev.map((m) =>
                m.id === userMessageId ? { ...m, id: event.userMessageId! } : m
              )
            );
          }
          if (event.sessionTitle) {
            callbacks.setSessionInfo((prev) => prev ? { ...prev, title: event.sessionTitle! } : null);
            window.dispatchEvent(new CustomEvent("newChatSessionCreated"));
          }
        },
        onChunk(chunk) {
          chunkCount++;
          devLog.log('[SSE DEBUG] onChunk called, chunk #', chunkCount, 'length:', chunk.length);
          if (!streamStarted) {
            streamStarted = true;
            devLog.log('[SSE DEBUG] First chunk, creating assistant message');
            // Note: Don't set isLoading=false here, it will be set in finally block
            // Setting it here causes race condition with SWR update useEffect
            callbacks.setMessages((prev) => {
              devLog.log('[SSE DEBUG] Adding assistant message, prev.length:', prev.length, 'prev:', prev.map(m => ({ id: m.id, role: m.role })));
              return [...prev, {
                id: streamingMsgId,
                role: "assistant",
                content: chunk,
                timestamp: new Date(),
              }];
            });
          } else {
            // Buffer the chunk and schedule an update
            contentBuffer += chunk;
            scheduleUpdate();
          }
        },
        onDone(event) {
          devLog.log('[SSE DEBUG] onDone called, total chunks:', chunkCount, 'event:', event);

          // Cancel any pending RAF and flush remaining buffer
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          flushContentBuffer();

          const realMsgId = event.assistantMessageId || streamingMsgId;
          callbacks.setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingMsgId ? { ...m, id: realMsgId } : m
            )
          );
          if (event.sessionPrivatized) {
            callbacks.setSessionInfo((prev) => prev ? { ...prev, consultType: "PRIVATE" } : null);
            callbacks.showToast("この相談は安全のため非公開に変更されました", "warning");
          }
          if (checkCrisisAlert(event.isCrisis)) {
            callbacks.setShowCrisisAlert(true);
          }
        },
        onError(error) {
          console.error('[SSE DEBUG] onError called, error:', error);
          // Clean up RAF on error
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          throw new Error(error);
        },
      });
      devLog.log('[SSE DEBUG] SSE stream processing completed');
    } finally {
      devLog.log('[SSE DEBUG] Finally block, setting isLoading to false');
      // Clean up RAF in finally block
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        flushContentBuffer();
      }
      // Mark streaming as just completed to prevent SWR overwrite
      callbacks.onStreamComplete?.();
      callbacks.setIsLoading(false);
      // Log to verify message was added (will be visible in next render)
      devLog.log('[SSE DEBUG] SSE processing finished, check next render for messages count');
    }
  } else {
    devLog.log('[SSE DEBUG] Non-streaming response, parsing JSON');
    // Non-streaming JSON response
    const data = await res.json();

    if (data.sessionPrivatized) {
      callbacks.setSessionInfo((prev) => prev ? { ...prev, consultType: "PRIVATE" } : null);
      callbacks.showToast("この相談は安全のため非公開に変更されました", "warning");
    }
    if (checkCrisisAlert(data.isCrisis)) {
      callbacks.setShowCrisisAlert(true);
    }
    if (data.assistantMessage) {
      callbacks.setMessages((prev) => [...prev, {
        id: data.assistantMessage.id,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);
    }
    callbacks.setIsLoading(false);
  }
}

export default function ChatSessionPage({ params }: PageProps) {
  const { sessionId } = use(params);
  const router = useRouter();
  const toast = useToastActions();

  // Check if this is a local session (local-first approach)
  const isLocalSession = sessionId.startsWith('local-');
  const localSession = isLocalSession ? localSessionStore.get(sessionId) : null;

  // SWR for session data fetching (skip for local sessions)
  const { data: sessionData, error: sessionError, isLoading: isFetching, mutate: mutateSession } = useSWR<ChatSessionWithMessages>(
    isLocalSession ? null : `/api/chat/sessions/${sessionId}`,
    fetcher,
    {
      dedupingInterval: 2000, // Prevent duplicate requests within 2 seconds
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: true, // Refetch on reconnect
      revalidateIfStale: false, // Don't auto-revalidate stale data (polling handles updates)
      shouldRetryOnError: (error: Error) => {
        // Don't retry on 404
        return error.message !== 'NOT_FOUND';
      },
      onError: (err: Error) => {
        if (err.message === 'NOT_FOUND') {
          router.replace("/main");
        }
      }
    }
  );

  // SWR for current user
  const { data: currentUser } = useSWR<{ id: string; handle: string; displayName: string | null; avatarUrl: string | null } | null>(
    '/api/auth/me',
    fetcher,
    {
      dedupingInterval: 60000, // Cache for 1 minute
      revalidateOnFocus: false
    }
  );

  // Initialize messages with pending initial message if available (avoids race condition)
  const [messages, setMessages] = useState<LocalMessage[]>(() => {
    if (typeof window === 'undefined') return [];

    // Helper to map local session messages to LocalMessage format
    const mapMessages = (localSession: ReturnType<typeof localSessionStore.get>) => {
      if (!localSession || localSession.messages.length === 0) return null;
      return localSession.messages.map(m => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: typeof m.content === 'string' ? m.content : '[暗号化メッセージ]',
        timestamp: m.timestamp,
      }));
    };

    // Case 1: If sessionId is a local ID, get directly from store
    if (sessionId.startsWith('local-')) {
      const localSession = localSessionStore.get(sessionId);
      const mapped = mapMessages(localSession);
      if (mapped) {
        devLog.log('[CHAT DEBUG] Initializing messages from local session (direct)');
        return mapped;
      }
    }

    // Case 2: Check for pending initial message (for server IDs after sync)
    const pendingLocalId = sessionStorage.getItem(`pendingInitialMessage-${sessionId}`);
    devLog.log('[INIT DEBUG] Case 2 check - sessionId:', sessionId, 'pendingLocalId:', pendingLocalId);
    if (pendingLocalId) {
      const localSession = localSessionStore.get(pendingLocalId);
      const mapped = mapMessages(localSession);
      devLog.log('[INIT DEBUG] Found local session:', !!localSession, 'mapped messages:', mapped?.length);
      if (mapped) {
        devLog.log('[CHAT DEBUG] Initializing messages from pending initial message');
        return mapped;
      }
    }

    devLog.log('[INIT DEBUG] No initialization source found, returning empty array');
    return [];
  });

  devLog.log('[CHAT DEBUG] ChatSessionPage RENDER, sessionId:', sessionId, 'messages.length:', messages.length);
  const [isLoading, setIsLoading] = useState(false);
  const [expectingAIResponse, setExpectingAIResponse] = useState(false);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [error, setError] = useState<string>();
  const [inputValue, setInputValue] = useState("");
  const [isAnonymousResponse, setIsAnonymousResponse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteModalRef = useRef<HTMLDialogElement>(null);
  const blockModalRef = useRef<HTMLDialogElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [blockTargetId, setBlockTargetId] = useState<string | null>(null);
  const [isBlocking, setIsBlocking] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [sentGasMessageIds, setSentGasMessageIds] = useState<Set<string>>(new Set());

  // Track server session ID for local sessions (triggers initial message send)
  const [pendingServerSessionId, setPendingServerSessionId] = useState<string | null>(() => {
    // Initialize from sessionStorage if available
    if (typeof window !== 'undefined' && sessionId.startsWith('local-')) {
      return sessionStorage.getItem(`pendingServerSession-${sessionId}`);
    }
    return null;
  });

  // Polling refs
  const lastPollTimeRef = useRef<string | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const anonymousUserMapRef = useRef<Map<string, string>>(new Map());
  const pollFailCountRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track when streaming just completed to prevent SWR overwrite
  const streamingJustCompletedRef = useRef(false);

  // Handle local session (local-first approach)
  useEffect(() => {
    if (!isLocalSession || !localSession || !currentUser) return;

    devLog.log('[LOCAL SESSION] Detected local session:', localSession.id);

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
      content: typeof m.content === 'string' ? m.content : '[メッセージ]',
      timestamp: m.timestamp,
      responder: undefined,
    }));

    // Only update messages if not currently streaming (prevents overwriting AI response)
    setMessages((prev) => {
      // Skip if assistant message already exists (SSE streaming completed or in progress)
      if (prev.some(m => m.role === 'assistant')) {
        devLog.log('[LOCAL SESSION] Skipping setMessages: assistant message exists');
        return prev;
      }
      // Skip if messages are not empty and have same content (avoid unnecessary re-initialization)
      if (prev.length > 0 && prev.length === localMessages.length) {
        devLog.log('[LOCAL SESSION] Skipping setMessages: messages already initialized');
        return prev;
      }
      devLog.log('[CHAT DEBUG] Initializing messages from local session (direct)');
      return localMessages;
    });

    // Start immediate sync (not background!)
    if (!localSession.synced && !localSession.syncing) {
      devLog.log('[LOCAL SESSION] Starting immediate sync...');

      import('@/lib/sync-session').then(({ syncSessionToServer }) => {
        syncSessionToServer({
          localId: localSession.id,
          onSuccess: (serverId) => {
            devLog.log('[LOCAL SESSION] Sync complete, server ID:', serverId);

            // Update state to trigger initial message send useEffect
            setPendingServerSessionId(serverId);

            // Also save to sessionStorage for persistence
            sessionStorage.setItem(`pendingServerSession-${localSession.id}`, serverId);
            sessionStorage.setItem(`pendingInitialMessage-${serverId}`, localSession.id);

            // DON'T navigate yet - will navigate after SSE completes
          },
          onError: (error) => {
            console.error('[LOCAL SESSION] Sync failed:', error);
            toast.error('サーバーとの同期に失敗しました');
          },
        });
      });
    } else if (localSession.synced && localSession.serverId && !pendingServerSessionId) {
      // Already synced (from previous visit), redirect to server session immediately
      // NOTE: If pendingServerSessionId exists, we're in the middle of initial message send, don't redirect yet
      router.replace(`/main/chat/${localSession.serverId}`);
    }
  }, [isLocalSession, localSession, currentUser, router, toast]);

  // Process session data from SWR
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
    if (isLoading) {
      devLog.log('[CHAT DEBUG] Skipping setMessages: message is being sent (isLoading=true)');
      return;
    }

    setMessages((prev) => {
      // Skip if streaming just completed (prevent overwriting fresh AI response)
      if (streamingJustCompletedRef.current) {
        devLog.log('[CHAT DEBUG] Skipping setMessages: streaming just completed');
        streamingJustCompletedRef.current = false; // Reset for next time
        return prev;
      }
      // Skip if local messages exist (not yet synced to server)
      const hasLocalMessages = prev.some(m => m.id.startsWith('local-'));
      if (hasLocalMessages) {
        devLog.log('[CHAT DEBUG] Skipping setMessages: has local messages not yet synced');
        return prev;
      }
      // If local state has more messages than server data, don't overwrite (race condition)
      if (prev.length > sessionData.messages.length) {
        devLog.log('[CHAT DEBUG] Skipping setMessages: prev has more messages than sessionData (race condition, prev:', prev.length, 'server:', sessionData.messages.length, ')');
        return prev;
      }
      return sessionData.messages.map((m: ChatMessage) =>
        transformMessage(m, isOwner, currentUserId, sessionData.isAnonymous, sessionData.user, anonymousUserMap)
      );
    });
  }, [sessionData, currentUser, isLoading]);

  // Send pending initial message after sync completes (optimistic UI approach)
  const pendingMessageSentRef = useRef(false);
  useEffect(() => {
    devLog.log('[INITIAL MSG DEBUG] useEffect triggered, sessionId:', sessionId, 'pendingServerSessionId:', pendingServerSessionId, 'pendingMessageSentRef:', pendingMessageSentRef.current);

    // For local sessions, check if server session is ready
    let targetSessionId = sessionId;
    if (sessionId.startsWith('local-')) {
      devLog.log('[INITIAL MSG DEBUG] Local session detected, pendingServerSessionId:', pendingServerSessionId);

      if (!pendingServerSessionId) {
        devLog.log('[INITIAL MSG DEBUG] Waiting for server session...');
        return; // Wait for server session to be created
      }

      targetSessionId = pendingServerSessionId;
    }

    // Check if there's a pending initial message for the target session
    const pendingLocalId = sessionStorage.getItem(`pendingInitialMessage-${targetSessionId}`);
    devLog.log('[INITIAL MSG DEBUG] pendingLocalId:', pendingLocalId, 'targetSessionId:', targetSessionId);

    if (!pendingLocalId || pendingMessageSentRef.current) {
      devLog.log('[INITIAL MSG DEBUG] Early return - pendingLocalId:', !!pendingLocalId, 'pendingMessageSentRef:', pendingMessageSentRef.current);
      return;
    }

    // Get the local session to retrieve the initial message
    const localSession = localSessionStore.get(pendingLocalId);
    devLog.log('[INITIAL MSG DEBUG] localSession:', localSession ? 'found' : 'null', 'messages:', localSession?.messages?.length);

    if (!localSession || localSession.messages.length === 0) {
      devLog.log('[INITIAL MSG DEBUG] No local session or no messages, cleaning up');
      sessionStorage.removeItem(`pendingInitialMessage-${targetSessionId}`);
      return;
    }

    // Wait for currentUser to be loaded
    if (!currentUser) {
      devLog.log('[INITIAL MSG DEBUG] Waiting for currentUser');
      return;
    }

    const initialMessage = localSession.messages[0];
    devLog.log('[CHAT DEBUG] Auto-sending pending initial message to server session:', targetSessionId);

    // Mark as sent immediately to prevent duplicate sends
    pendingMessageSentRef.current = true;
    sessionStorage.removeItem(`pendingInitialMessage-${targetSessionId}`);

    // Display local message immediately (optimistic UI)
    const displayContent = typeof initialMessage.content === 'string'
      ? initialMessage.content
      : '[メッセージ]';

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
    devLog.log('[INITIAL MSG DEBUG] About to setMessages with userMessage:', userMessage.id);
    setMessages((prev) => {
      devLog.log('[INITIAL MSG DEBUG] setMessages callback, prev.length:', prev.length, 'prev:', prev.map(m => ({ id: m.id, role: m.role })));
      // Avoid duplicates
      if (prev.some((m) => m.id === userMessage.id)) {
        devLog.log('[INITIAL MSG DEBUG] Duplicate detected, returning prev');
        return prev;
      }
      devLog.log('[INITIAL MSG DEBUG] Adding userMessage to messages');
      return [...prev, userMessage];
    });
    devLog.log('[INITIAL MSG DEBUG] setIsLoading(true)');
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
          console.error('[CHAT DEBUG] Initial message send failed:', {
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
            if (sessionId.startsWith('local-')) {
              devLog.log('[LOCAL SESSION] SSE complete, preparing to navigate...');

              // Find assistant message ID from current state
              setMessages((currentMessages) => {
                const assistantMsg = currentMessages.find(m => m.role === 'assistant');
                const assistantMessageId = assistantMsg?.id;

                devLog.log('[LOCAL SESSION] Assistant message ID:', assistantMessageId);

                // Poll server to verify DB save completed
                const pollForMessage = async (attemptCount = 0): Promise<void> => {
                  const maxAttempts = 15; // 15 attempts * 200ms = 3 seconds max

                  if (attemptCount >= maxAttempts) {
                    devLog.log('[LOCAL SESSION] Polling timeout, navigating anyway');
                    sessionStorage.removeItem(`pendingServerSession-${sessionId}`);
                    router.replace(`/main/chat/${targetSessionId}`);
                    return;
                  }

                  try {
                    devLog.log(`[LOCAL SESSION] Polling for message (attempt ${attemptCount + 1}/${maxAttempts})...`);

                    const response = await fetch(`/api/chat/sessions/${targetSessionId}`);
                      if (response.ok) {
                        const data = await response.json();

                        // Check if assistant message exists in the response
                        const hasAssistantMessage = data.messages?.some(
                          (m: { id: string; role: string }) =>
                            m.role === 'ASSISTANT' && (!assistantMessageId || m.id === assistantMessageId)
                        );

                        if (hasAssistantMessage) {
                          devLog.log('[LOCAL SESSION] Message confirmed in DB, navigating now');
                          sessionStorage.removeItem(`pendingServerSession-${sessionId}`);
                          router.replace(`/main/chat/${targetSessionId}`);
                          return;
                        }
                      }

                      // Message not found yet, retry after 200ms
                      setTimeout(() => pollForMessage(attemptCount + 1), 200);
                    } catch (error) {
                      console.error('[LOCAL SESSION] Polling error:', error);
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
          console.error('[CHAT DEBUG] Initial message send failed:', err);
          setIsLoading(false);
          setError(err instanceof Error ? err.message : "エラーが発生しました");
        });
  }, [sessionId, pendingServerSessionId, currentUser, toast, router]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any): LocalMessage | null => {
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
                ? `User ${anonymousUserMapRef.current.get(m.responderId)}`
                : m.responder.displayName,
              avatarUrl: m.isAnonymous ? null : m.responder.avatarUrl,
              isAnonymous: m.isAnonymous,
              handle: m.isAnonymous ? undefined : m.responder.handle,
              responderId: m.responderId || undefined,
            }
          : undefined,
      };
    },
    [sessionInfo]
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
        const data = await api.get<{ messages: unknown[] }>(
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
  }, [sessionId, sessionInfo, transformPolledMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Online/Offline event handling for message queue
  useEffect(() => {
    const handleOnline = async () => {
      clientLogger.info("Online - processing message queue");
      toast.showToast("オンラインに復帰しました。未送信メッセージを送信中...", "info");

      try {
        await messageQueue.processQueue();

        // Reload messages after queue is processed
        if (!isLocalSession) {
          mutateSession();
        }
      } catch (err) {
        clientLogger.error("Failed to process queue:", err);
      }
    };

    const handleOffline = () => {
      clientLogger.info("Offline - messages will be queued");
      toast.showToast("オフラインです。メッセージはキューに保存されます", "warning");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [sessionId, isLocalSession]);

  const openBlockModal = (userId: string) => {
    setBlockTargetId(userId);
    blockModalRef.current?.showModal();
  };

  const handleBlock = async () => {
    if (!blockTargetId) return;
    setIsBlocking(true);

    try {
      await userApi.blockUser(blockTargetId);
      toast.success("ユーザーをブロックしました");
      window.location.reload();
    } catch (error) {
      clientLogger.error("Block error:", error);
      toast.error(error instanceof Error ? error.message : "ブロックに失敗しました");
    } finally {
      setIsBlocking(false);
      setBlockTargetId(null);
    }
  };

  const handleSendGas = async (messageId: string) => {
    try {
      const data = await messageApi.sendGas(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, gasAmount: data.gasAmount } : m
        )
      );
      // 送信済みメッセージIDを記録
      setSentGasMessageIds((prev) => new Set(prev).add(messageId));
      toast.success("💜を送りました（3 YAMI）");
    } catch (error) {
      clientLogger.error("Send gas error:", error);
      toast.error(error instanceof Error ? error.message : "💜の送信に失敗しました");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await chatApi.deleteSession(sessionId);
      window.dispatchEvent(new CustomEvent("chatSessionDeleted", { detail: { sessionId } }));
      router.push("/main");
    } catch (error) {
      clientLogger.error("Delete session error:", error);
      toast.error(error instanceof Error ? error.message : "削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !sessionInfo) return;

    // ローカルセッション同期中は送信を無効化（403エラー防止）
    if (isLocalSession && localSession && !localSession.synced) {
      toast.showToast("サーバーと同期中です。少々お待ちください", "info");
      return;
    }

    const { isOwner } = sessionInfo;
    const canRespond = sessionInfo.consultType === "PUBLIC" || sessionInfo.consultType === "DIRECTED";

    if (isOwner) {
      const messageContent = inputValue.trim();
      const userMessage: LocalMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageContent,
        timestamp: new Date(),
      };

      // AI応答が期待されるかどうかを判定
      const willGetAIResponse = sessionInfo.consultType === "PRIVATE" ||
        hasMentionYamii(messageContent);

      // 楽観的更新: ローカルストアを使用して統一的に処理
      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsLoading(true);
      setExpectingAIResponse(willGetAIResponse);
      setError(undefined);

      // ローカルストアに追加（IndexedDB永続化 + リアクティブ更新）
      await localSessionStore.addMessage(sessionId, {
        ...userMessage,
        synced: false,
      });

      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage.content }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "メッセージの送信に失敗しました");
        }

        await handleSSEResponse(res, userMessage.id, {
          setMessages,
          setIsLoading,
          setSessionInfo,
          setShowCrisisAlert,
          showToast: toast.showToast,
          onStreamComplete: () => {
            streamingJustCompletedRef.current = true;
          },
        });

        // 同期完了をマーク（統一的な処理）
        await localSessionStore.updateMessage(sessionId, userMessage.id, {
          synced: true,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "エラーが発生しました";
        setError(errorMessage);
        setIsLoading(false);

        // ネットワークエラーの場合のみオフラインキューに追加
        // TypeError は fetch のネットワーク接続失敗を示す
        const isNetworkError = err instanceof TypeError || !navigator.onLine;

        if (isNetworkError) {
          // ネットワークエラー: オフラインキューに追加
          try {
            await messageQueue.enqueue({
              id: userMessage.id,
              role: userMessage.role,
              content: userMessage.content,
              timestamp: userMessage.timestamp,
              sessionId: sessionId,
            });

            toast.showToast("オフラインです。オンライン復帰時に自動送信します", "info");
          } catch (queueErr) {
            clientLogger.error("Failed to enqueue message:", queueErr);
          }
        } else {
          // APIエラー（YAMIトークン不足、認証エラー等）: エラーメッセージを表示
          toast.showToast(errorMessage, "error");
        }
      }
    } else if (canRespond) {
      const responseContent = inputValue.trim();

      // Optimistic UI: Show response immediately
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticResponse: LocalMessage = {
        id: optimisticId,
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
        responder: currentUser ? {
          displayName: isAnonymousResponse ? null : currentUser.displayName,
          avatarUrl: isAnonymousResponse ? null : currentUser.avatarUrl,
          isAnonymous: isAnonymousResponse,
          handle: isAnonymousResponse ? undefined : currentUser.handle,
          responderId: currentUser.id,
        } : undefined,
      };

      setMessages((prev) => [...prev, optimisticResponse]);
      setInputValue("");
      setIsLoading(true);
      setExpectingAIResponse(false); // 回答者は自分のメッセージを追加するだけなのでAI応答は期待しない
      setError(undefined);

      // ローカルストアに追加（統一的な処理）
      await localSessionStore.addMessage(sessionId, {
        ...optimisticResponse,
        synced: false,
        responderId: currentUser?.id,
      });

      try {
        const data = await api.post<{
          message: { id: string; content: string };
          isAIResponse?: boolean;
          isCrisis?: boolean;
          userMessage?: { id: string };
          reward?: number;
          rewardCapped?: boolean;
        }>(`/api/chat/sessions/${sessionId}/respond`, {
          content: responseContent,
          isAnonymous: isAnonymousResponse,
        });

        // Replace optimistic message with real one(s)
        if (data.isAIResponse) {
          if (checkCrisisAlert(data.isCrisis)) {
            setShowCrisisAlert(true);
          }

          const userMsg: LocalMessage = {
            id: data.userMessage!.id,
            role: "user",
            content: responseContent,
            timestamp: new Date(),
          };
          const aiMessage: LocalMessage = {
            id: data.message.id,
            role: "assistant",
            content: data.message.content,
            timestamp: new Date(),
            responder: null,
          };
          // Remove optimistic message and add real messages
          setMessages((prev) => [...prev.filter(m => !m.id.startsWith('optimistic-')), userMsg, aiMessage]);

          // Update IndexedDB: remove optimistic, add synced messages
          try {
            const db = await indexedDB.init();
            const tx = db.transaction('messages', 'readwrite');
            const store = tx.objectStore('messages');

            // Delete optimistic message
            await new Promise<void>((resolve, reject) => {
              const deleteReq = store.delete(optimisticId);
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => reject(deleteReq.error);
            });

            // Save real messages as synced
            await indexedDB.saveMessage({
              id: userMsg.id,
              role: userMsg.role,
              content: userMsg.content,
              timestamp: userMsg.timestamp,
              sessionId: sessionId,
              synced: true,
            });
            await indexedDB.saveMessage({
              id: aiMessage.id,
              role: aiMessage.role,
              content: aiMessage.content,
              timestamp: aiMessage.timestamp,
              sessionId: sessionId,
              synced: true,
            });
          } catch (err) {
            clientLogger.error("Failed to update IndexedDB after AI response:", err);
          }
        } else {
          const responseMessage: LocalMessage = {
            id: data.message.id,
            role: "user",
            content: responseContent,
            timestamp: new Date(),
          };
          // Remove optimistic message and add real message
          setMessages((prev) => [...prev.filter(m => !m.id.startsWith('optimistic-')), responseMessage]);

          // Update IndexedDB: remove optimistic, add synced message
          try {
            const db = await indexedDB.init();
            const tx = db.transaction('messages', 'readwrite');
            const store = tx.objectStore('messages');

            // Delete optimistic message
            await new Promise<void>((resolve, reject) => {
              const deleteReq = store.delete(optimisticId);
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => reject(deleteReq.error);
            });

            // Save real message as synced
            await indexedDB.saveMessage({
              id: responseMessage.id,
              role: responseMessage.role,
              content: responseMessage.content,
              timestamp: responseMessage.timestamp,
              sessionId: sessionId,
              synced: true,
            });
          } catch (err) {
            clientLogger.error("Failed to update IndexedDB after response:", err);
          }

          if (data.reward && data.reward > 0) {
            clientLogger.info(`+${data.reward} YAMI を獲得しました！`);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "エラーが発生しました";
        setError(errorMessage);

        // ネットワークエラーの場合のみオフラインキューに追加
        const isNetworkError = err instanceof TypeError || !navigator.onLine;

        if (isNetworkError) {
          // ネットワークエラー: オフラインキューに追加（楽観的UIを維持）
          try {
            await messageQueue.enqueue({
              id: optimisticId,
              role: "assistant",
              content: responseContent,
              timestamp: optimisticResponse.timestamp,
              sessionId: sessionId,
              responderId: currentUser?.id,
              isAnonymous: isAnonymousResponse,
            });

            toast.showToast("オフラインです。オンライン復帰時に自動送信します", "info");
          } catch (queueErr) {
            // If queueing also fails, remove the optimistic message
            setMessages((prev) => prev.filter(m => !m.id.startsWith('optimistic-')));
            clientLogger.error("Failed to enqueue response:", queueErr);
          }
        } else {
          // APIエラー: 楽観的UIを削除してエラーメッセージを表示
          setMessages((prev) => prev.filter(m => !m.id.startsWith('optimistic-')));
          toast.showToast(errorMessage, "error");
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  if (isFetching) {
    return (
      <div className="flex-1 flex flex-col h-full p-4 space-y-4 animate-fade-in">
        <div className="chat chat-start">
          <div className="chat-image avatar">
            <div className="w-8 h-8 rounded-full bg-base-300 skeleton" />
          </div>
          <div className="chat-bubble bg-base-200/60 shadow-none">
            <div className="skeleton bg-base-300 h-4 w-48 mb-2 rounded" />
            <div className="skeleton bg-base-300 h-4 w-32 rounded" />
          </div>
        </div>
        <div className="chat chat-end">
          <div className="chat-bubble bg-primary/20 shadow-none">
            <div className="skeleton bg-primary/30 h-4 w-40 rounded" />
          </div>
        </div>
        <div className="chat chat-start">
          <div className="chat-image avatar">
            <div className="w-8 h-8 rounded-full bg-base-300 skeleton" />
          </div>
          <div className="chat-bubble bg-base-200/60 shadow-none">
            <div className="skeleton bg-base-300 h-4 w-56 mb-2 rounded" />
            <div className="skeleton bg-base-300 h-4 w-44 mb-2 rounded" />
            <div className="skeleton bg-base-300 h-4 w-36 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header - Always visible to prevent layout shift */}
      <div className="border-b border-base-300 px-4 py-2 flex items-center justify-between bg-base-100">
        {sessionInfo && sessionInfo.title ? (
          <>
            {/* Actual header content */}
            <div className="flex items-center gap-2 truncate flex-1">
              <div className="shrink-0 text-base-content/40" title={getConsultTypeLabel(sessionInfo.consultType)}>
                <ConsultTypeIcon type={sessionInfo.consultType} />
              </div>
              <h1 className="text-sm font-medium truncate">{sessionInfo.title}</h1>
              {sessionInfo.consultType === "DIRECTED" && sessionInfo.targets && sessionInfo.targets.length > 0 && (
                <div className="flex items-center gap-1 shrink-0 text-[11px] text-base-content/50">
                  <span className="truncate max-w-[200px]">
                    {sessionInfo.targets.map((t, i) => (
                      <span key={t.userId}>
                        {i > 0 && ", "}
                        <Link href={`/main/user/${encodeHandle(t.handle)}`} className="hover:underline hover:text-accent" onClick={(e) => e.stopPropagation()}>
                          {t.displayName || `@${t.handle}`}
                        </Link>
                      </span>
                    ))}
                  </span>
                </div>
              )}
              <CrisisStrikeIndicator
                crisisCount={sessionInfo.crisisCount || 0}
                consultType={sessionInfo.consultType}
                className="ml-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <Suspense fallback={<div className="w-8 h-8" />}>
                <BookmarkButton sessionId={sessionId} />
              </Suspense>
              {sessionInfo.isOwner && (
                <button
                  className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                  onClick={() => deleteModalRef.current?.showModal()}
                  title="この相談を削除"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Skeleton header content - prevents layout shift */}
            <div className="flex items-center gap-2 truncate flex-1">
              <div className="skeleton w-4 h-4 rounded bg-base-300" />
              <div className="skeleton h-4 w-48 rounded bg-base-300" />
            </div>
            <div className="flex items-center gap-2">
              <div className="skeleton w-8 h-8 rounded bg-base-300" />
            </div>
          </>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="max-w-6xl mx-auto">
          {showCrisisAlert && (
            <CrisisAlert
              onClose={() => setShowCrisisAlert(false)}
              onDisable={() => {
                localStorage.setItem("yamix_crisis_alert_disabled", "true");
                setShowCrisisAlert(false);
              }}
            />
          )}

          {messages.length === 0 && !isLoading && !showCrisisAlert && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <p className="text-base-content/50 text-lg">
                今日はどうしましたか？
              </p>
            </div>
          )}

          {messages.map((msg, index) => {
            devLog.log(`[CHAT DEBUG] Rendering message ${index + 1}/${messages.length}:`, {
              id: msg.id,
              role: msg.role,
              contentLength: msg.content?.length || 0,
              contentPreview: msg.content?.substring(0, 50) || '(empty)',
            });
            return (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                responder={msg.responder || undefined}
                isSessionOwner={sessionInfo?.isOwner}
                onBlock={openBlockModal}
                messageId={msg.id}
                gasAmount={msg.gasAmount}
                onSendGas={handleSendGas}
                isCrisis={sessionInfo?.consultType !== "PRIVATE" ? msg.isCrisis : undefined}
                hasSentGas={sentGasMessageIds.has(msg.id)}
                isBlockingUser={msg.responder?.responderId === blockTargetId && isBlocking}
              />
            );
          })}

          {isLoading && expectingAIResponse && <ChatBubble role="assistant" content="" isLoading />}

          {error && (
            <div className="alert alert-error text-sm" role="alert" aria-live="polite">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-base-200/50 rounded-2xl border border-base-300/50">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                sessionInfo?.isOwner
                  ? sessionInfo.consultType === "PRIVATE"
                    ? "相談してみましょう"
                    : "メッセージを入力..."
                  : "回答を入力..."
              }
              className="w-full resize-none min-h-[5rem] px-4 pt-4 pb-2 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0"
              rows={1}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />

            <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-base-300/30">
              <div className="flex items-center gap-1">
                {sessionInfo && !sessionInfo.isOwner && (sessionInfo.consultType === "PUBLIC" || sessionInfo.consultType === "DIRECTED") && (
                  <button
                    type="button"
                    className={`btn btn-xs gap-1 ${
                      isAnonymousResponse
                        ? "btn-secondary btn-outline"
                        : "btn-ghost opacity-60"
                    }`}
                    onClick={() => setIsAnonymousResponse(!isAnonymousResponse)}
                    disabled={isLoading}
                    aria-label="匿名で回答"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM6 8.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs">匿名</span>
                  </button>
                )}
              </div>

              <button
                onClick={handleSubmit}
                className="btn btn-primary btn-circle btn-sm"
                disabled={isLoading || !inputValue.trim() || !!(isLocalSession && localSession && !localSession.synced)}
                aria-label="送信"
              >
                {isLoading ? (
                  <Suspense fallback={<span className="loading loading-spinner loading-xs" />}>
                    <LoadingSpinner size="xs" inline />
                  </Suspense>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-center text-base-content/40 mt-2">
            Shift + Enter で改行
          </p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Suspense fallback={null}>
        <ConfirmModal
          ref={deleteModalRef}
          title="相談を削除"
          body={
            sessionInfo && (sessionInfo.consultType === "PUBLIC" || sessionInfo.consultType === "DIRECTED") && sessionInfo.responseCount > 0
              ? `この相談には${sessionInfo.responseCount}件の回答があります。\n削除すると他のユーザーの回答も消えます。\n\nこの操作は取り消せません。\n\n本当に削除しますか？`
              : `この相談とすべての回答が完全に削除されます。\nこの操作は取り消せません。\n\n本当に削除しますか？`
          }
          confirmText={isDeleting ? "削除中..." : "削除する"}
          cancelText="キャンセル"
          onConfirm={handleDelete}
          confirmButtonClass="btn-error"
        />
      </Suspense>

      {/* Block Confirmation Modal */}
      <Suspense fallback={null}>
        <ConfirmModal
          ref={blockModalRef}
          title="ユーザーをブロック"
          body={"このユーザーをブロックしますか？\n\nブロックすると：\n• このユーザーの匿名・非匿名すべての回答がブロックされます\n• あなたの公開相談に回答できなくなります"}
          confirmText={isBlocking ? "ブロック中..." : "ブロック"}
          cancelText="キャンセル"
          onConfirm={handleBlock}
          confirmButtonClass="btn-error"
        />
      </Suspense>
    </div>
  );
}
