"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChatBubble, CrisisAlert } from "@/components/ChatBubble";
import { LoadingSpinner } from "@/components/LoadingSpinner";

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
              className={`btn btn-xs gap-1 ${
                consultType === "PRIVATE"
                  ? "btn-ghost"
                  : "btn-primary btn-outline"
              }`}
              onClick={() => {
                if (consultType === "PRIVATE") {
                  setConsultType("PUBLIC");
                } else {
                  setConsultType("PRIVATE");
                  setIsAnonymous(false);
                }
              }}
              disabled={isLoading}
              aria-label={consultType === "PRIVATE" ? "プライベート相談" : "公開相談"}
            >
              {consultType === "PRIVATE" ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs">非公開</span>
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" />
                  </svg>
                  <span className="text-xs">公開</span>
                </>
              )}
            </button>

            {/* Public options */}
            {consultType === "PUBLIC" && (
              <>
                <div className="w-px h-4 bg-base-300 mx-1" />
                {/* Anonymous toggle */}
                <button
                  type="button"
                  className={`btn btn-xs gap-1 ${
                    isAnonymous
                      ? "btn-secondary btn-outline"
                      : "btn-ghost opacity-60"
                  }`}
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  disabled={isLoading}
                  aria-label="匿名で相談"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2a8 8 0 100 16 8 8 0 000-16zM6 8.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs">匿名</span>
                </button>
                {/* Allow anonymous responses toggle */}
                <button
                  type="button"
                  className={`btn btn-xs gap-1 ${
                    !allowAnonymousResponses
                      ? "btn-warning btn-outline"
                      : "btn-ghost opacity-60"
                  }`}
                  onClick={() => setAllowAnonymousResponses(!allowAnonymousResponses)}
                  disabled={isLoading}
                  aria-label={allowAnonymousResponses ? "匿名回答を許可中" : "匿名回答を拒否中"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                  <span className="text-xs">{allowAnonymousResponses ? "匿名回答OK" : "匿名NG"}</span>
                </button>
              </>
            )}
          </div>

          {/* Right side: Submit button */}
          <button
            onClick={handleSubmit}
            className="btn btn-primary btn-circle btn-sm"
            disabled={isLoading || !inputValue.trim()}
            aria-label="送信"
          >
            {isLoading ? (
              <LoadingSpinner size="xs" inline />
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

  // Initial state: centered on desktop, input at bottom on mobile
  if (isInitialState) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Desktop: centered layout like ChatGPT/Claude */}
        <div className="hidden xl:flex flex-1 flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <div className="flex flex-col items-center mb-6">
              <Image
                src="/yamii.svg"
                alt="Yamii"
                width={48}
                height={48}
                className="mb-3"
              />
              <p className="text-base-content/50 text-lg text-center">
                今日はどうしましたか？
              </p>
            </div>
            {inputForm}
          </div>
        </div>

        {/* Mobile: greeting at center, input at bottom for easier tapping */}
        <div className="xl:hidden flex-1 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <Image
              src="/yamii.svg"
              alt="Yamii"
              width={48}
              height={48}
              className="mb-3"
            />
            <p className="text-base-content/50 text-lg text-center">
              今日はどうしましたか？
            </p>
          </div>
          <div className="p-4 pt-0">
            <div className="max-w-2xl mx-auto">
              {inputForm}
            </div>
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
          {inputForm}
        </div>
      </div>
    </div>
  );
}
