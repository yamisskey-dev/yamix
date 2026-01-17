"use client";

import { useState, useRef, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { ChatBubble, CrisisAlert } from "@/components/ChatBubble";
import type {
  ConversationMessage,
  YamiiCounselingResponse,
} from "@/types";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface FormValue {
  message: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [error, setError] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { register, handleSubmit, reset, watch } = useForm<FormValue>({
    defaultValues: { message: "" },
  });

  const messageValue = watch("message");

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [messageValue]);

  const onSubmit: SubmitHandler<FormValue> = async (data) => {
    if (!data.message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: data.message.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    reset();
    setIsLoading(true);
    setError(undefined);

    // Build conversation history (max 10 messages)
    const conversationHistory: ConversationMessage[] = messages
      .slice(-10)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    try {
      const res = await fetch("/api/yamii/counseling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
          conversationHistory,
        }),
      });

      if (!res.ok) {
        throw new Error("相談の送信に失敗しました");
      }

      const response: YamiiCounselingResponse = await res.json();

      // Update session ID
      if (response.session_id) {
        setSessionId(response.session_id);
      }

      // Show crisis alert if needed
      if (response.is_crisis) {
        setShowCrisisAlert(true);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.response,
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
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] window:h-[calc(100vh-4rem)] pb-16 window:pb-0">
      {/* Crisis Alert */}
      {showCrisisAlert && (
        <div className="p-4">
          <CrisisAlert onClose={() => setShowCrisisAlert(false)} />
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-base-content/50">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-xl font-bold mb-2">Yamii へようこそ</h2>
            <p className="text-sm max-w-xs">
              何でも相談してください。
              <br />
              あなたの話を聴きます。
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
      <div className="border-t border-base-300 bg-base-100 p-4">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex items-end gap-2 max-w-3xl mx-auto"
        >
          <div className="flex-1 relative">
            <textarea
              {...register("message")}
              ref={(e) => {
                register("message").ref(e);
                (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = e;
              }}
              placeholder="メッセージを入力..."
              className="textarea textarea-bordered w-full resize-none min-h-[2.5rem] max-h-[7.5rem] py-2 pr-12"
              rows={1}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            className={`btn btn-primary btn-circle ${
              isLoading || !messageValue.trim() ? "btn-disabled" : ""
            }`}
            disabled={isLoading || !messageValue.trim()}
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
        <p className="text-xs text-center text-base-content/40 mt-2">
          Shift + Enter で改行
        </p>
      </div>
    </div>
  );
}
