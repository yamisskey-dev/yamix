"use client";

import Image from "next/image";
import Link from "next/link";
import type { TimelineConsultation } from "@/types";

interface Props {
  consultation: TimelineConsultation;
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

export function ConsultationCard({ consultation }: Props) {
  const displayName = consultation.user.displayName || consultation.user.handle.split("@")[1] || "匿名";

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

        {/* View Full */}
        <div className="mt-3 text-right">
          <Link
            href={`/main/chat/${consultation.sessionId}`}
            className="link link-primary text-xs"
          >
            全文を見る →
          </Link>
        </div>
      </div>
    </div>
  );
}
