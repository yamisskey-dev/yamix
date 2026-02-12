"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { useRouter } from "next/navigation";
import type { TimelineConsultation } from "@/types";
import { parseMentions } from "@/lib/mention-parser";
import { encodeHandle } from "@/lib/encode-handle";
import { ConsultTypeIcon } from "@/components/ConsultTypeIcon";
import { formatRelativeDate } from "@/lib/format-date";

interface Props {
  consultation: TimelineConsultation;
  currentUserHandle?: string;
}

export const ConsultationCard = memo(function ConsultationCard({ consultation }: Props) {
  const router = useRouter();

  // 回答モードかどうか（responderがnullの場合はAI回答）
  const isResponseMode = consultation.isUserResponse && consultation.answer;

  // 表示するユーザー情報（回答モードでは回答者またはAI、通常モードでは相談者）
  const displayUser = isResponseMode ? consultation.responder : consultation.user;
  const isAnonymous = isResponseMode ? false : (consultation.isAnonymous || !consultation.user);

  // AI応答の場合は「やみぃ@yamii」を表示
  const isAIResponse = isResponseMode && !consultation.responder;
  const displayName = isAIResponse
    ? "やみぃ"
    : isAnonymous
    ? "匿名さん"
    : (displayUser?.displayName || displayUser?.handle?.split("@")[1] || "匿名");

  const displayHandle = isAIResponse ? "@yamii" : displayUser?.handle;
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
      className="note-article group flex py-6 px-8 bg-base-200/60 border-b border-base-content/10 hover:bg-base-200/80 transition-all duration-200 ease-smooth cursor-pointer relative"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mr-3.5">
        <div className="w-[46px] h-[46px] rounded-full overflow-hidden shadow-soft">
          {isAIResponse ? (
            <div className="bg-base-200 flex items-center justify-center w-full h-full overflow-hidden">
              <Image
                src="/yamii.svg"
                alt="Yamii"
                width={44}
                height={44}
                className="w-full h-full object-cover"
              />
            </div>
          ) : isAnonymous ? (
            <div className="bg-base-300 flex items-center justify-center w-full h-full text-xl">
              😎
            </div>
          ) : displayUser?.avatarUrl ? (
            <Image
              src={displayUser.avatarUrl}
              alt={displayName}
              width={44}
              height={44}
              className="rounded-full object-cover w-full h-full"
            />
          ) : (
            <div className="bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center w-full h-full text-base font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>


      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header - Misskey style: name · @username · visibility · time */}
        <header className="flex items-center flex-wrap gap-x-1.5 mb-0.5">
          {isAIResponse ? (
            <>
              <span className="font-bold text-[13px] shrink-0">
                {displayName}
              </span>
              <span className="text-[12px] text-base-content/50">
                {displayHandle}
              </span>
            </>
          ) : isAnonymous ? (
            <span className="font-bold text-[13px] text-base-content/70 shrink-0">
              {displayName}
            </span>
          ) : displayUser ? (
            <>
              <Link
                href={`/main/user/${encodeHandle(displayUser.handle)}`}
                className="font-bold text-[13px] hover:text-primary truncate max-w-[180px] transition-colors duration-200 link-hover-underline"
                onClick={(e) => e.stopPropagation()}
              >
                {displayName}
              </Link>
              <span className="text-[12px] text-base-content/50 truncate max-w-[180px]">
                {displayUser.handle}
              </span>
            </>
          ) : null}
          {/* Right side: visibility icon and time */}
          <div className="flex items-center gap-x-1.5 ml-auto shrink-0">
            {/* Consult type indicator - only show for non-PUBLIC */}
            {consultation.consultType !== "PUBLIC" && (
              <span className="text-base-content/40">
                <ConsultTypeIcon type={consultation.consultType} className="h-3 w-3 inline-block" />
              </span>
            )}
            <span className="text-[12px] text-base-content/50">
              {formatRelativeDate(new Date(consultation.createdAt))}
            </span>
          </div>
        </header>

        {/* Body */}
        {isResponseMode ? (
          <>
            {/* 回答モード: 質問を引用として表示 */}
            <div className="mb-1.5 pl-2.5 border-l-2 border-base-content/10">
              <div className="flex items-start gap-1.5">
                <div className="flex-shrink-0 mt-0.5">
                  {consultation.user ? (
                    consultation.user.avatarUrl ? (
                      <Image
                        src={consultation.user.avatarUrl}
                        alt={consultation.user.displayName || "相談者"}
                        width={18}
                        height={18}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full bg-base-300/60 flex items-center justify-center text-[9px]">
                        {(consultation.user.displayName || "?").charAt(0).toUpperCase()}
                      </div>
                    )
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full bg-base-300 flex items-center justify-center">
                      <span className="text-[10px]">😎</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-base-content/50">
                    {consultation.isAnonymous
                      ? "匿名さん"
                      : consultation.user?.displayName || consultation.user?.handle.split("@")[1] || "ユーザー"}
                    への回答
                  </span>
                  <p className="text-[12px] text-base-content/60 whitespace-pre-wrap break-words leading-[1.5] line-clamp-2 mt-0.5">
                    {parseMentions(consultation.question)}
                  </p>
                </div>
              </div>
            </div>
            {/* 回答内容 */}
            <p className="text-[13px] whitespace-pre-wrap break-words leading-[1.6]">
              {consultation.answer ? parseMentions(consultation.answer) : ""}
            </p>
          </>
        ) : (
          /* 通常モード: 質問を表示 */
          <p className="text-[13px] whitespace-pre-wrap break-words leading-[1.6]">
            {parseMentions(consultation.question)}
          </p>
        )}

        {/* Reply count metadata */}
        {replyCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-base-content/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
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
