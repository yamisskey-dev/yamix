"use client";

import { lazy, Suspense } from "react";
import Link from "next/link";
import { encodeHandle } from "@/lib/encode-handle";
import { ConsultTypeIcon, getConsultTypeLabel } from "@/components/ConsultTypeIcon";
import { CrisisStrikeIndicator } from "@/components/CrisisStrikeIndicator";
import type { SessionInfo } from "./chat-types";

const BookmarkButton = lazy(() =>
  import("@/components/BookmarkButton").then((mod) => ({ default: mod.BookmarkButton }))
);

interface ChatHeaderProps {
  sessionId: string;
  sessionInfo: SessionInfo | null;
  onDeleteClick: () => void;
}

/** チャット画面のヘッダー（タイトル・宛先・危機カウント・ブックマーク・削除） */
export function ChatHeader({ sessionId, sessionInfo, onDeleteClick }: ChatHeaderProps) {
  return (
    <div className="border-b border-base-300 px-4 py-2 flex items-center justify-between bg-base-100">
      {sessionInfo && sessionInfo.title ? (
        <>
          {/* Actual header content */}
          <div className="flex items-center gap-2 truncate flex-1">
            <div className="shrink-0 text-base-content/40" title={getConsultTypeLabel(sessionInfo.consultType)}>
              <ConsultTypeIcon type={sessionInfo.consultType} />
            </div>
            <h1 className="text-sm font-medium truncate">{sessionInfo.title}</h1>
            {sessionInfo.consultType === "DIRECTED" && sessionInfo.targets && sessionInfo.targets.length > 0 && (
              <div className="flex items-center gap-1 shrink-0 text-[11px] text-base-content/50">
                <span className="truncate max-w-[200px]">
                  {sessionInfo.targets.map((t, i) => (
                    <span key={t.userId}>
                      {i > 0 && ", "}
                      <Link href={`/main/user/${encodeHandle(t.handle)}`} className="hover:underline hover:text-accent" onClick={(e) => e.stopPropagation()}>
                        {t.displayName || `@${t.handle}`}
                      </Link>
                    </span>
                  ))}
                </span>
              </div>
            )}
            <CrisisStrikeIndicator
              crisisCount={sessionInfo.crisisCount || 0}
              consultType={sessionInfo.consultType}
              className="ml-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <Suspense fallback={<div className="w-8 h-8" />}>
              <BookmarkButton sessionId={sessionId} />
            </Suspense>
            {sessionInfo.isOwner && (
              <button
                className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                onClick={onDeleteClick}
                title="この相談を削除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Skeleton header content - prevents layout shift */}
          <div className="flex items-center gap-2 truncate flex-1">
            <div className="skeleton w-4 h-4 rounded bg-base-300" />
            <div className="skeleton h-4 w-48 rounded bg-base-300" />
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton w-8 h-8 rounded bg-base-300" />
          </div>
        </>
      )}
    </div>
  );
}
