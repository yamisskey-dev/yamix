"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const isAnonymous = !consultation.user.displayName && !consultation.user.avatarUrl;
  const displayName = isAnonymous ? "匿名" : (consultation.user.displayName || consultation.user.handle.split("@")[1] || "匿名");

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the user link
    if ((e.target as HTMLElement).closest('a')) {
      return;
    }
    router.push(`/main/chat/${consultation.sessionId}`);
  };

  return (
    <article
      onClick={handleClick}
      className="note-article flex py-6 px-8 sm:py-7 sm:px-8 border-b border-base-content/10 hover:bg-base-content/[0.02] transition-colors cursor-pointer"
    >
      {/* Avatar - Misskey: 58px default, 50px on smaller, 46px on mobile */}
      <div className="flex-shrink-0 mr-3.5 sm:mr-4">
        <div className="w-[46px] h-[46px] sm:w-[50px] sm:h-[50px] rounded-full overflow-hidden">
          {isAnonymous ? (
            <div className="bg-base-300 flex items-center justify-center w-full h-full text-2xl">
              😎
            </div>
          ) : consultation.user.avatarUrl ? (
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header - Misskey style: name · @username · time */}
        <header className="flex items-center flex-wrap gap-x-1.5 mb-1">
          {isAnonymous ? (
            <span className="font-bold text-[0.95em] text-base-content/70 shrink-0">
              {displayName}
            </span>
          ) : (
            <>
              <Link
                href={`/main/user/${encodeURIComponent(consultation.user.handle)}`}
                className="font-bold text-[0.95em] hover:underline truncate max-w-[180px]"
                onClick={(e) => e.stopPropagation()}
              >
                {displayName}
              </Link>
              <span className="text-[0.85em] text-base-content/50 truncate max-w-[120px]">
                @{consultation.user.handle.split("@")[0]}
              </span>
            </>
          )}
          <span className="text-[0.85em] text-base-content/50 ml-auto shrink-0">
            {formatDate(new Date(consultation.createdAt))}
          </span>
        </header>

        {/* Body - Question */}
        <div>
          <p className="text-[0.95em] whitespace-pre-wrap break-words leading-[1.6]">
            {consultation.question}
          </p>
        </div>
      </div>
    </article>
  );
}
