"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect, memo, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import type { TimelineConsultation } from "@/types";

interface Props {
  consultation: TimelineConsultation;
  currentUserHandle?: string; // 現在のユーザーハンドル（自分の相談には回答不可）
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;

  return date.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

export const ConsultationCard = memo(function ConsultationCard({ consultation, currentUserHandle }: Props) {
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [localReplies, setLocalReplies] = useState(consultation.replies);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAnonymous = consultation.isAnonymous || !consultation.user;
  const displayName = isAnonymous ? "匿名さん" : (consultation.user?.displayName || consultation.user?.handle.split("@")[1] || "匿名");
  const isOwnConsultation = consultation.user && currentUserHandle === consultation.user.handle;
  const replyCount = localReplies?.length || 0;

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    // Toggle replies instead of navigating
    if (replyCount > 0) {
      setShowReplies(!showReplies);
    }
  };

  const handleResponseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowResponseModal(true);
    setSubmitError(undefined);
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(undefined);

    try {
      const res = await fetch(`/api/chat/sessions/${consultation.sessionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: responseText.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "回答の送信に失敗しました");
      }

      const data = await res.json();

      // Add the new reply to local state
      const newReply = {
        id: data.message.id,
        content: data.message.content,
        createdAt: new Date(data.message.createdAt),
        responder: {
          id: data.message.responderId,
          handle: currentUserHandle || "",
          displayName: localStorage.getItem("yamix_displayName") || null,
          avatarUrl: localStorage.getItem("yamix_avatarUrl") || null,
        },
      };
      setLocalReplies((prev) => [...(prev || []), newReply]);

      // Success - close modal, reset, and show replies
      setShowResponseModal(false);
      setResponseText("");
      setShowReplies(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && showResponseModal) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [responseText, showResponseModal]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (showResponseModal && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showResponseModal]);

  // For portal mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
    <article
      onClick={handleClick}
      className="note-article group flex py-6 px-8 sm:py-7 sm:px-8 border-b border-base-content/10 hover:bg-base-content/[0.02] transition-colors cursor-pointer relative"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mr-3.5 sm:mr-4">
        <div className="w-[46px] h-[46px] sm:w-[50px] sm:h-[50px] rounded-full overflow-hidden">
          {isAnonymous ? (
            <div className="bg-base-300 flex items-center justify-center w-full h-full text-2xl">
              😎
            </div>
          ) : consultation.user?.avatarUrl ? (
            <Image
              src={consultation.user.avatarUrl}
              alt={displayName}
              width={50}
              height={50}
              className="rounded-full object-cover w-full h-full"
            />
          ) : (
            <div className="bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center w-full h-full text-lg font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Reply button - show on hover, aligned with body text */}
      {!isOwnConsultation && (
        <button
          onClick={handleResponseClick}
          className="absolute right-4 bottom-6 sm:bottom-7 text-base-content/40 hover:text-primary transition-all p-2 rounded-full hover:bg-primary/10 opacity-0 group-hover:opacity-100 active:opacity-100"
          title="回答する"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header - Misskey style: name · @username · visibility · time */}
        <header className="flex items-center flex-wrap gap-x-1.5 mb-1">
          {isAnonymous ? (
            <span className="font-bold text-[0.95em] text-base-content/70 shrink-0">
              {displayName}
            </span>
          ) : consultation.user ? (
            <>
              <Link
                href={`/main/user/${encodeURIComponent(consultation.user.handle)}`}
                className="font-bold text-[0.95em] hover:underline truncate max-w-[180px]"
                onClick={(e) => e.stopPropagation()}
              >
                {displayName}
              </Link>
              <span className="text-[0.85em] text-base-content/50 truncate max-w-[180px]">
                {consultation.user?.handle}
              </span>
            </>
          ) : null}
          {/* Right side: visibility icon and time */}
          <div className="flex items-center gap-x-1.5 ml-auto shrink-0">
            {/* Consult type indicator - only show for PRIVATE */}
            {consultation.consultType === "PRIVATE" && (
              <span className="text-base-content/40" title="プライベート相談">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 inline-block"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </span>
            )}
            <span className="text-[0.85em] text-base-content/50">
              {formatDate(new Date(consultation.createdAt))}
            </span>
          </div>
        </header>

        {/* Body - Question */}
        <p className="text-[0.95em] whitespace-pre-wrap break-words leading-[1.6]">
          {consultation.question}
        </p>

        {/* First AI answer - always visible */}
        {consultation.answer && (
          <div className="mt-2 pl-3 border-l-2 border-primary/30">
            <p className="text-[0.9em] text-base-content/80 whitespace-pre-wrap break-words leading-[1.5] line-clamp-3">
              {consultation.answer}
            </p>
          </div>
        )}

        {/* More replies indicator */}
        {replyCount > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowReplies(!showReplies);
            }}
            className="mt-2 text-sm text-primary/80 hover:text-primary transition-colors"
          >
            {showReplies ? "閉じる" : `他${replyCount - 1}件の回答を見る`}
          </button>
        )}

        {/* Additional replies (hidden by default) */}
        {showReplies && localReplies && localReplies.length > 1 && (
          <div className="mt-2 space-y-2 pl-3 border-l-2 border-base-content/10">
            {localReplies.slice(1).map((reply) => {
              const isAI = !reply.responder;
              const responderName = isAI
                ? "AI"
                : reply.responder?.displayName || reply.responder?.handle || "匿名";

              return (
                <div key={reply.id}>
                  <span className={`text-xs font-medium ${isAI ? "text-base-content/50" : "text-secondary"}`}>
                    {responderName}
                  </span>
                  <p className="text-[0.9em] text-base-content/80 whitespace-pre-wrap break-words leading-[1.5]">
                    {reply.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>

    {/* Response Modal - Portal to body for proper overlay */}
    {mounted && showResponseModal && createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowResponseModal(false);
          }
        }}
      >
        <div className="bg-base-100 rounded-2xl w-full max-w-lg animate-scale-in overflow-hidden shadow-2xl">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-base-content/10">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setShowResponseModal(false)}
              disabled={isSubmitting}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
            <span className="text-sm font-medium text-base-content/70">回答する</span>
            <div className="w-8" />
          </header>

          {/* Original question preview */}
          <div className="px-4 py-3 bg-base-200/50">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden">
                  {isAnonymous ? (
                    <div className="bg-base-300 flex items-center justify-center w-full h-full text-sm">
                      😎
                    </div>
                  ) : consultation.user?.avatarUrl ? (
                    <Image
                      src={consultation.user.avatarUrl}
                      alt={displayName}
                      width={32}
                      height={32}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center w-full h-full text-xs font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-base-content/60 font-medium">{displayName}</span>
                <p className="text-sm text-base-content/80 mt-0.5 line-clamp-2">
                  {consultation.question}
                </p>
              </div>
            </div>
          </div>

          {/* Input area */}
          <div className="p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 bg-base-200/60 rounded-2xl px-4 py-3">
                <textarea
                  ref={textareaRef}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="回答を入力..."
                  className="w-full bg-transparent border-none outline-none resize-none text-base leading-relaxed placeholder:text-base-content/40 min-h-[60px] max-h-[200px]"
                  disabled={isSubmitting}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmitResponse();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleSubmitResponse}
                disabled={isSubmitting || !responseText.trim()}
                className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                  responseText.trim()
                    ? "bg-primary text-primary-content hover:bg-primary/90"
                    : "bg-base-300 text-base-content/30 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                )}
              </button>
            </div>

            {submitError && (
              <div className="alert alert-error text-sm mt-3 py-2">
                <span>{submitError}</span>
              </div>
            )}

            <p className="text-xs text-base-content/40 mt-2 text-center">
              Ctrl + Enter で送信
            </p>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
});
