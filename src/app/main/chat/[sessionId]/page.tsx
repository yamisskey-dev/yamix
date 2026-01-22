"use client";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ChatBubble, CrisisAlert } from "@/components/ChatBubble";
import type { ChatMessage, ChatSessionWithMessages } from "@/types";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

interface ResponderInfo {
  displayName: string | null;
  avatarUrl: string | null;
  isAnonymous?: boolean;
  handle?: string;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  responder?: ResponderInfo | null;
}

export default function ChatSessionPage({ params }: PageProps) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [error, setError] = useState<string>();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    consultType: "PRIVATE" | "PUBLIC";
    userId: string;
    isOwner: boolean;
    isAnonymous: boolean;
    currentUserId: string | null;
  } | null>(null);

  // Fetch session data
  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Get current user
        const meRes = await fetch("/api/auth/me");
        const currentUser = meRes.ok ? await meRes.json() : null;

        const res = await fetch(`/api/chat/sessions/${sessionId}`);
        if (!res.ok) {
          if (res.status === 404) {
            router.replace("/main");
            return;
          }
          throw new Error("Failed to fetch session");
        }

        const session: ChatSessionWithMessages = await res.json();

        const isOwner = currentUser ? session.userId === currentUser.id : false;
        const currentUserId = currentUser?.id || null;

        // Store session info
        setSessionInfo({
          consultType: session.consultType,
          userId: session.userId,
          isOwner,
          isAnonymous: session.isAnonymous,
          currentUserId,
        });

        setMessages(
          session.messages.map((m: ChatMessage) => {
            // Check if this is current user's message
            const isMyMessage = currentUserId && (
              (m.role === "USER" && isOwner) || // My question (if I'm the owner)
              (m.role === "ASSISTANT" && m.responderId === currentUserId) // My response
            );

            // My messages go to the right without avatar/name
            if (isMyMessage) {
              return {
                id: m.id,
                role: "user" as const,
                content: m.content,
                timestamp: new Date(m.createdAt),
              };
            }

            // If viewing someone else's chat, show their USER messages on the left with avatar
            if (!isOwner && m.role === "USER") {
              return {
                id: m.id,
                role: "assistant" as const,
                content: m.content,
                timestamp: new Date(m.createdAt),
                responder: {
                  displayName: session.user?.displayName || null,
                  avatarUrl: session.user?.avatarUrl || null,
                  isAnonymous: session.isAnonymous,
                  handle: session.user?.handle,
                },
              };
            }

            // Other ASSISTANT messages (AI or others' responses) on the left
            return {
              id: m.id,
              role: "assistant" as const,
              content: m.content,
              timestamp: new Date(m.createdAt),
              responder: m.responder ? {
                displayName: m.responder.displayName,
                avatarUrl: m.responder.avatarUrl,
                isAnonymous: false,
                handle: m.responder.handle,
              } : undefined, // undefined = AI
            };
          })
        );
      } catch (err) {
        console.error("Error fetching session:", err);
        setError("セッションの読み込みに失敗しました");
      } finally {
        setIsFetching(false);
      }
    };

    fetchSession();
  }, [sessionId, router]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !sessionInfo) return;

    const isOwner = sessionInfo.isOwner;
    const isPublic = sessionInfo.consultType === "PUBLIC";

    // For owner or when responding to public consultation
    if (isOwner) {
      // Owner posting a message (could be question or follow-up)
      const userMessage: LocalMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: inputValue.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsLoading(true);
      setError(undefined);

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

        const data = await res.json();

        // If we got an AI response (PRIVATE always, PUBLIC with @yamii mention)
        if (data.assistantMessage) {
          if (data.isCrisis && typeof window !== "undefined") {
            const disabled = localStorage.getItem("yamix_crisis_alert_disabled");
            if (!disabled) {
              setShowCrisisAlert(true);
            }
          }

          const assistantMessage: LocalMessage = {
            id: data.assistantMessage.id,
            role: "assistant",
            content: data.response,
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    } else if (isPublic) {
      // Non-owner responding to public consultation
      const responseContent = inputValue.trim();
      setInputValue("");
      setIsLoading(true);
      setError(undefined);

      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: responseContent }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "回答の送信に失敗しました");
        }

        const data = await res.json();

        // Check if this is an AI response (when @yamii was mentioned)
        if (data.isAIResponse) {
          // AI response - display crisis alert if needed
          if (data.isCrisis && typeof window !== "undefined") {
            const disabled = localStorage.getItem("yamix_crisis_alert_disabled");
            if (!disabled) {
              setShowCrisisAlert(true);
            }
          }

          // Add user's message first (the message with @yamii)
          const userMsg: LocalMessage = {
            id: data.userMessage.id,
            role: "user",
            content: responseContent,
            timestamp: new Date(),
          };

          // Add AI response as assistant message (no responder = AI)
          const aiMessage: LocalMessage = {
            id: data.message.id,
            role: "assistant",
            content: data.message.content,
            timestamp: new Date(),
            responder: null, // AI response
          };

          setMessages((prev) => [...prev, userMsg, aiMessage]);
        } else {
          // Human response - get current user info for display
          const meRes = await fetch("/api/auth/me");
          const currentUser = meRes.ok ? await meRes.json() : null;

          // Add the response as an assistant message with responder info
          const responseMessage: LocalMessage = {
            id: data.message.id,
            role: "assistant",
            content: responseContent,
            timestamp: new Date(),
            responder: currentUser ? {
              displayName: currentUser.profile?.displayName || null,
              avatarUrl: currentUser.profile?.avatarUrl || null,
              isAnonymous: false,
              handle: currentUser.handle,
            } : null,
          };

          setMessages((prev) => [...prev, responseMessage]);

          // Show reward message if applicable
          if (data.reward && data.reward > 0) {
            // Could add a toast notification here
            console.log(`+${data.reward} YAMI を獲得しました！`);
          } else if (data.rewardCapped) {
            console.log("本日の報酬上限に達しています");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
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
      <div className="flex-1 flex flex-col h-full p-4 space-y-4">
        {/* Skeleton loading for chat messages */}
        <div className="chat chat-start">
          <div className="chat-image avatar">
            <div className="w-8 h-8 rounded-full skeleton" />
          </div>
          <div className="chat-bubble bg-base-200/60 shadow-none">
            <div className="skeleton h-4 w-48 mb-2" />
            <div className="skeleton h-4 w-32" />
          </div>
        </div>
        <div className="chat chat-end">
          <div className="chat-bubble bg-primary/20 shadow-none">
            <div className="skeleton h-4 w-40" />
          </div>
        </div>
        <div className="chat chat-start">
          <div className="chat-image avatar">
            <div className="w-8 h-8 rounded-full skeleton" />
          </div>
          <div className="chat-bubble bg-base-200/60 shadow-none">
            <div className="skeleton h-4 w-56 mb-2" />
            <div className="skeleton h-4 w-44 mb-2" />
            <div className="skeleton h-4 w-36" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="max-w-6xl mx-auto">
          {/* Crisis Alert - shown as first message */}
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
            />
          ))}

          {isLoading && <ChatBubble role="assistant" content="" isLoading />}

          {error && (
            <div className="alert alert-error text-sm">
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 max-w-6xl mx-auto"
        >
          <div className="flex-1 relative">
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
              className="textarea bg-base-200/50 border-base-300/50 focus:border-primary/50 w-full resize-none min-h-[2.5rem] max-h-[7.5rem] py-2 pr-4 rounded-2xl"
              rows={1}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            className={`btn btn-primary btn-circle flex-shrink-0 ${
              isLoading || !inputValue.trim() ? "btn-disabled opacity-50" : ""
            }`}
            disabled={isLoading || !inputValue.trim()}
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            )}
          </button>
        </form>
        <p className="text-xs text-center text-base-content/30 mt-2">
          Shift + Enter で改行
        </p>
      </div>
    </div>
  );
}
