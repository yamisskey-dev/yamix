"use client";

import { useState, useRef, useEffect, use, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ChatBubble, CrisisAlert } from "@/components/ChatBubble";
import { localSessionStore } from "@/lib/local-session-store";
import { chatApi, userApi, messageApi, api } from "@/lib/api-client";
import { clientLogger } from "@/lib/client-logger";
import { useToastActions } from "@/components/Toast";
import type { ChatMessage, ChatSessionWithMessages } from "@/types";
import { messageQueue } from "@/lib/message-queue";
import { indexedDB } from "@/lib/indexed-db";
import { hasMentionYamii } from "@/lib/constants";
import {
  fetcher,
  transformMessage,
  checkCrisisAlert,
  type LocalMessage,
  type SessionInfo,
} from "./chat-types";
import { handleSSEResponse } from "./sse-response";
import { usePollingMessages } from "./use-polling-messages";
import { useLocalSessionSync } from "./use-local-session-sync";
import { useInitialMessageSend } from "./use-initial-message-send";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatSkeleton } from "./ChatSkeleton";

// 動的インポートで初期ロードを高速化
const ConfirmModal = lazy(() => import("@/components/Modal").then(mod => ({ default: mod.ConfirmModal })));

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function ChatSessionPage({ params }: PageProps) {
  const { sessionId } = use(params);
  const router = useRouter();
  const toast = useToastActions();

  // Check if this is a local session (local-first approach)
  const isLocalSession = sessionId.startsWith('local-');
  const localSession = isLocalSession ? localSessionStore.get(sessionId) : null;

  // SWR for session data fetching (skip for local sessions)
  const { data: sessionData, isLoading: isFetching, mutate: mutateSession } = useSWR<ChatSessionWithMessages>(
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
      if (mapped) return mapped;
    }

    // Case 2: Check for pending initial message (for server IDs after sync)
    const pendingLocalId = sessionStorage.getItem(`pendingInitialMessage-${sessionId}`);
    if (pendingLocalId) {
      const localSession = localSessionStore.get(pendingLocalId);
      const mapped = mapMessages(localSession);
      if (mapped) return mapped;
    }

    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [expectingAIResponse, setExpectingAIResponse] = useState(false);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [error, setError] = useState<string>();
  const [inputValue, setInputValue] = useState("");
  const [isAnonymousResponse, setIsAnonymousResponse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  const anonymousUserMapRef = useRef<Map<string, string>>(new Map());

  // Track when streaming just completed to prevent SWR overwrite
  const streamingJustCompletedRef = useRef(false);

  // Handle local session (local-first approach)
  useLocalSessionSync({
    isLocalSession,
    localSession,
    currentUser,
    pendingServerSessionId,
    setPendingServerSessionId,
    setSessionInfo,
    setMessages,
  });

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
  }, [sessionData, currentUser, isLoading]);

  // Send pending initial message after sync completes (optimistic UI approach)
  useInitialMessageSend({
    sessionId,
    pendingServerSessionId,
    currentUser,
    setMessages,
    setIsLoading,
    setSessionInfo,
    setShowCrisisAlert,
    setError,
    streamingJustCompletedRef,
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Poll for new messages with adaptive backoff
  usePollingMessages({
    sessionId,
    sessionInfo,
    messages,
    setMessages,
    anonymousUserMapRef,
  });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        role: "user",
        content: responseContent,
        timestamp: new Date(),
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

  if (isFetching) {
    return <ChatSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header - Always visible to prevent layout shift */}
      <ChatHeader
        sessionId={sessionId}
        sessionInfo={sessionInfo}
        onDeleteClick={() => deleteModalRef.current?.showModal()}
      />

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

          {messages.map((msg) => (
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
          ))}

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
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        sessionInfo={sessionInfo}
        isAnonymousResponse={isAnonymousResponse}
        onToggleAnonymous={() => setIsAnonymousResponse(!isAnonymousResponse)}
        syncPending={!!(isLocalSession && localSession && !localSession.synced)}
      />

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
