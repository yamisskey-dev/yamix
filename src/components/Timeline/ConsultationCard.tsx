"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TimelineConsultation } from "@/types";

interface Props {
  consultation: TimelineConsultation;
  currentUserHandle?: string;
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

export function ConsultationCard({ consultation, currentUserHandle }: Props) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseContent, setResponseContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const displayName = consultation.user.displayName || consultation.user.handle.split("@")[1] || "匿名";

  // Check if this is the user's own consultation (they shouldn't respond to their own)
  const isOwnConsultation = currentUserHandle && consultation.user.handle === currentUserHandle;

  const handleSubmitResponse = async () => {
    if (!responseContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(undefined);

    try {
      const res = await fetch(`/api/chat/sessions/${consultation.sessionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: responseContent.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "回答の送信に失敗しました");
      }

      setSubmitted(true);
      setShowResponseForm(false);
      setResponseContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card bg-base-100/50 backdrop-blur-sm shadow-lg border border-base-300/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
      <div className="card-body p-4 sm:p-6">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="avatar">
            <div className="w-10 h-10 rounded-full ring ring-primary/20 ring-offset-base-100 ring-offset-1">
              {consultation.user.avatarUrl ? (
                <Image
                  src={consultation.user.avatarUrl}
                  alt={displayName}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center w-full h-full text-lg font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/main/user/${encodeURIComponent(consultation.user.handle)}`}
              className="font-semibold text-sm hover:text-primary transition-colors truncate block"
            >
              {displayName}
            </Link>
            <span className="text-xs text-base-content/50">
              {formatDate(new Date(consultation.createdAt))}
            </span>
          </div>
        </div>

        {/* Question */}
        <div className="mb-4">
          <div className="text-xs text-base-content/50 mb-1 flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            相談
          </div>
          <p className="text-sm whitespace-pre-wrap line-clamp-3">
            {consultation.question}
          </p>
        </div>

        {/* Answer */}
        <div className="bg-base-200/50 rounded-lg p-3">
          <div className="text-xs text-base-content/50 mb-1 flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Yamii の回答
          </div>
          <p className="text-sm whitespace-pre-wrap line-clamp-4 text-base-content/80">
            {consultation.answer}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-between">
          {/* Response Button */}
          {!isOwnConsultation && !submitted && (
            <button
              onClick={() => setShowResponseForm(!showResponseForm)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
                transition-colors duration-150
                ${showResponseForm
                  ? "bg-primary/20 text-primary"
                  : "bg-base-200 text-base-content/60 hover:bg-primary/10 hover:text-primary"
                }
              `}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              <span>回答する</span>
            </button>
          )}

          {submitted && (
            <span className="text-sm text-success flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              回答を送信しました
            </span>
          )}

          {isOwnConsultation && (
            <span className="text-xs text-base-content/40">自分の相談</span>
          )}

          <Link
            href={`/main/chat/${consultation.sessionId}`}
            className="link link-primary text-xs"
          >
            全文を見る →
          </Link>
        </div>

        {/* Response Form */}
        {showResponseForm && (
          <div className="mt-4 pt-4 border-t border-base-300/50 animate-fade-in">
            <div className="text-xs text-base-content/50 mb-2">
              あなたの回答
            </div>
            <textarea
              value={responseContent}
              onChange={(e) => setResponseContent(e.target.value)}
              placeholder="相談者への回答を入力してください..."
              className="textarea textarea-bordered w-full min-h-[100px] text-sm resize-none bg-base-200/50"
              disabled={isSubmitting}
            />
            {error && (
              <div className="text-error text-xs mt-1">{error}</div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setShowResponseForm(false);
                  setResponseContent("");
                  setError(undefined);
                }}
                className="btn btn-ghost btn-sm"
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmitResponse}
                className={`btn btn-primary btn-sm ${
                  isSubmitting || !responseContent.trim() ? "btn-disabled" : ""
                }`}
                disabled={isSubmitting || !responseContent.trim()}
              >
                {isSubmitting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "送信"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
