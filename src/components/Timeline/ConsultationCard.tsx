"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  // 回答モードかどうか
  const isResponseMode = consultation.isUserResponse && consultation.answer && consultation.responder;

  // 表示するユーザー情報（回答モードでは回答者、通常モードでは相談者）
  const displayUser = isResponseMode ? consultation.responder : consultation.user;
  const isAnonymous = isResponseMode ? false : (consultation.isAnonymous || !consultation.user);
  const displayName = isAnonymous
    ? "匿名さん"
    : (displayUser?.displayName || displayUser?.handle.split("@")[1] || "匿名");
  const replyCount = consultation.replies?.length || 0;

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    // Navigate to chat room
    router.push(`/main/chat/${consultation.sessionId}`);
  };


  return (
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
          ) : displayUser?.avatarUrl ? (
            <Image
              src={displayUser.avatarUrl}
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


      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header - Misskey style: name · @username · visibility · time */}
        <header className="flex items-center flex-wrap gap-x-1.5 mb-1">
          {isAnonymous ? (
            <span className="font-bold text-[0.95em] text-base-content/70 shrink-0">
              {displayName}
            </span>
          ) : displayUser ? (
            <>
              <Link
                href={`/main/user/${encodeURIComponent(displayUser.handle)}`}
                className="font-bold text-[0.95em] hover:underline truncate max-w-[180px]"
                onClick={(e) => e.stopPropagation()}
              >
                {displayName}
              </Link>
              <span className="text-[0.85em] text-base-content/50 truncate max-w-[180px]">
                {displayUser.handle}
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

        {/* Body */}
        {isResponseMode ? (
          <>
            {/* 回答モード: 質問を引用として表示 */}
            <div className="mb-2 pl-3 border-l-2 border-base-content/10">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  {consultation.user ? (
                    consultation.user.avatarUrl ? (
                      <Image
                        src={consultation.user.avatarUrl}
                        alt={consultation.user.displayName || "相談者"}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-base-300/60 flex items-center justify-center text-[0.6em]">
                        {(consultation.user.displayName || "?").charAt(0).toUpperCase()}
                      </div>
                    )
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-base-300 flex items-center justify-center">
                      <span className="text-xs">😎</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[0.75em] text-base-content/50">
                    {consultation.isAnonymous
                      ? "匿名さん"
                      : consultation.user?.displayName || consultation.user?.handle.split("@")[1] || "ユーザー"}
                    への回答
                  </span>
                  <p className="text-[0.85em] text-base-content/60 whitespace-pre-wrap break-words leading-[1.5] line-clamp-2 mt-0.5">
                    {consultation.question}
                  </p>
                </div>
              </div>
            </div>
            {/* 回答内容 */}
            <p className="text-[0.95em] whitespace-pre-wrap break-words leading-[1.6]">
              {consultation.answer}
            </p>
          </>
        ) : (
          /* 通常モード: 質問を表示 */
          <p className="text-[0.95em] whitespace-pre-wrap break-words leading-[1.6]">
            {consultation.question}
          </p>
        )}

        {/* Reply count metadata */}
        {replyCount > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-base-content/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>{replyCount}件の返信</span>
          </div>
        )}
      </div>
    </article>
  );
});
