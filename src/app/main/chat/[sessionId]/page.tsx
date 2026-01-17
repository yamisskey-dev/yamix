"use client";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ChatBubble, CrisisAlert } from "@/components/ChatBubble";
import type { ChatMessage, ChatSessionWithMessages } from "@/types";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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

  // Fetch session data
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}`);
        if (!res.ok) {
          if (res.status === 404) {
            router.replace("/main");
            return;
          }
          throw new Error("Failed to fetch session");
        }

        const session: ChatSessionWithMessages = await res.json();
        setMessages(
          session.messages.map((m: ChatMessage) => ({
            id: m.id,
            role: m.role === "USER" ? "user" : "assistant",
            content: m.content,
            timestamp: new Date(m.createdAt),
          }))
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
    if (!inputValue.trim() || isLoading) return;

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
        throw new Error("メッセージの送信に失敗しました");
      }

      const data = await res.json();

      if (data.isCrisis) {
        setShowCrisisAlert(true);
      }

      const assistantMessage: LocalMessage = {
        id: data.assistantMessage.id,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
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
      {/* Crisis Alert */}
      {showCrisisAlert && (
        <div className="p-4">
          <CrisisAlert onClose={() => setShowCrisisAlert(false)} />
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
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

      {/* Input Area */}
      <div className="p-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 max-w-3xl mx-auto"
        >
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="相談してみましょう"
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
