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
  const [allowAnonymousResponses, setAllowAnonymousResponses] = useState(true);
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
          allowAnonymousResponses: consultType === "PUBLIC" ? allowAnonymousResponses : true,
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

  const isInitialState = messages.length === 0 && !isLoading && !showCrisisAlert;

  // Input form component (reused in both layouts)
  const inputForm = (
    <>
      <div className="bg-base-200/50 rounded-2xl border border-base-300/50 focus-within:border-primary/50 transition-colors">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="相談してみましょう"
          className="w-full resize-none min-h-[5rem] px-4 pt-4 pb-2 bg-transparent border-0 focus:outline-none"
          rows={1}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />

        {/* Footer with options and submit button */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-base-300/30">
          {/* Left side: Options */}
          <div className="flex items-center gap-1">
            {/* Consult Type Toggle - Single button that switches between modes */}
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => {
                if (consultType === "PRIVATE") {
                  setConsultType("PUBLIC");
                } else {
                  setConsultType("PRIVATE");
                  setIsAnonymous(false);
                }
              }}
              disabled={isLoading}
              title={consultType === "PRIVATE" ? "プライベート相談（AI専用）- クリックで公開に切替" : "公開相談（誰でも回答可能）- クリックで非公開に切替"}
            >
              <span className="text-base">{consultType === "PRIVATE" ? "🔒" : "🌍"}</span>
            </button>

            {/* Public options */}
            {consultType === "PUBLIC" && (
              <>
                <div className="w-px h-4 bg-base-300 mx-1" />
                <button
                  type="button"
                  className={`btn btn-xs btn-ghost ${
                    isAnonymous ? "opacity-100" : "opacity-50"
                  }`}
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  disabled={isLoading}
                  title="匿名で相談"
                >
                  <span className="text-base">😎</span>
                </button>
                <button
                  type="button"
                  className={`btn btn-xs btn-ghost ${
                    !allowAnonymousResponses ? "opacity-100 text-error" : "opacity-50"
                  }`}
                  onClick={() => setAllowAnonymousResponses(!allowAnonymousResponses)}
                  disabled={isLoading}
                  title={allowAnonymousResponses ? "匿名回答を許可" : "匿名回答を拒否"}
                >
                  <span className="text-base">{allowAnonymousResponses ? "🙂" : "🚫"}</span>
                </button>
              </>
            )}
          </div>

          {/* Right side: Submit button */}
          <button
            onClick={handleSubmit}
            className={`btn btn-primary btn-circle btn-sm ${
              isLoading || !inputValue.trim() ? "btn-disabled opacity-50" : ""
            }`}
            disabled={isLoading || !inputValue.trim()}
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <p className="text-xs text-center text-base-content/40 mt-2">
        Shift + Enter で改行
      </p>
    </>
  );

  // Initial state: centered layout like ChatGPT/Claude
  if (isInitialState) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <p className="text-base-content/50 text-lg text-center mb-6">
              今日はどうしましたか？
            </p>
            {inputForm}
          </div>
        </div>
      </div>
    );
  }

  // Chat mode: standard layout with messages at top, input at bottom
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
          {inputForm}
        </div>
      </div>
    </div>
  );
}
