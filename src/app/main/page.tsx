"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatBubble, CrisisAlert } from "@/components/ChatBubble";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function NewChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [error, setError] = useState<string>();
  const [inputValue, setInputValue] = useState("");
  const [consultType, setConsultType] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      // Create new session with consultType and isAnonymous
      const createRes = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultType,
          isAnonymous: consultType === "PUBLIC" ? isAnonymous : false,
        }),
      });

      if (!createRes.ok) {
        throw new Error("セッションの作成に失敗しました");
      }

      const session = await createRes.json();

      // Notify sidebar about new session
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("newChatSessionCreated"));
      }

      // Send message
      const msgRes = await fetch(`/api/chat/sessions/${session.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!msgRes.ok) {
        throw new Error("メッセージの送信に失敗しました");
      }

      const data = await msgRes.json();

      if (data.isCrisis && typeof window !== "undefined") {
        const disabled = localStorage.getItem("yamix_crisis_alert_disabled");
        if (!disabled) {
          setShowCrisisAlert(true);
        }
      }

      // Navigate to the session page (this preserves the conversation)
      router.push(`/main/chat/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

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
        <div className="max-w-6xl mx-auto">
          {/* Consult Type Selection - シンプル版 */}
          <div className="mb-2 flex items-center justify-between text-xs text-base-content/60">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer hover:text-base-content/80 transition-colors">
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={consultType === "PUBLIC"}
                  onChange={(e) => {
                    setConsultType(e.target.checked ? "PUBLIC" : "PRIVATE");
                    if (!e.target.checked) setIsAnonymous(false);
                  }}
                  disabled={isLoading}
                />
                <span>
                  {consultType === "PRIVATE" ? (
                    <>プライベート相談（AI専用・1 YAMI）</>
                  ) : (
                    <>公開相談（誰でも回答可能・3 YAMI）</>
                  )}
                </span>
              </label>

              {consultType === "PUBLIC" && (
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-base-content/80 transition-colors">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span>匿名</span>
                </label>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2"
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
    </div>
  );
}
