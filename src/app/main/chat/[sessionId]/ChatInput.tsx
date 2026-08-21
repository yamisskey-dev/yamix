"use client";

import { lazy, Suspense, useEffect, useRef } from "react";
import type { SessionInfo } from "./chat-types";

const LoadingSpinner = lazy(() =>
  import("@/components/LoadingSpinner").then((mod) => ({ default: mod.LoadingSpinner }))
);

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  sessionInfo: SessionInfo | null;
  isAnonymousResponse: boolean;
  onToggleAnonymous: () => void;
  /** ローカルセッション同期中は送信不可 */
  syncPending: boolean;
}

/** チャット入力欄（自動リサイズ・匿名トグル・送信ボタン） */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  sessionInfo,
  isAnonymousResponse,
  onToggleAnonymous,
  syncPending,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-base-200/50 rounded-2xl border border-base-300/50">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              sessionInfo?.isOwner
                ? sessionInfo.consultType === "PRIVATE"
                  ? "相談してみましょう"
                  : "メッセージを入力..."
                : "回答を入力..."
            }
            className="w-full resize-none min-h-[5rem] px-4 pt-4 pb-2 bg-transparent border-0 outline-hidden focus:outline-hidden focus:ring-0 focus:border-0"
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
                  onClick={onToggleAnonymous}
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
              onClick={onSubmit}
              className="btn btn-primary btn-circle btn-sm"
              disabled={isLoading || !value.trim() || syncPending}
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
  );
}
