"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { BookmarkButton } from "@/components/BookmarkButton";
import type { TimelineConsultation } from "@/types";
import { exploreApi } from "@/lib/api-client";
import { clientLogger } from "@/lib/client-logger";

/** Phone-screen chat preview card */
function PhoneChatCard({ consultation }: { consultation: TimelineConsultation }) {
  const router = useRouter();
  const replyCount = consultation.replies?.length || 0;
  const isAnonymous = consultation.isAnonymous || !consultation.user;

  const displayName = isAnonymous
    ? "匿名さん"
    : consultation.user?.displayName || consultation.user?.handle?.split("@")[1] || "匿名";

  // Room title: prefer DB title (AI-generated summary), fallback to first line of question
  const titleText = consultation.title || consultation.question.split("\n")[0].slice(0, 40) || "無題のルーム";

  const questionText = consultation.question.length > 200
    ? consultation.question.slice(0, 200) + "…"
    : consultation.question;

  const answerText = consultation.answer
    ? consultation.answer.length > 300
      ? consultation.answer.slice(0, 300) + "…"
      : consultation.answer
    : null;

  // Unique human participants from replies
  const participants = (consultation.replies || [])
    .filter((r) => r.responder)
    .reduce<Array<{ id: string; handle: string; displayName: string | null; avatarUrl: string | null }>>((acc, r) => {
      if (r.responder && !acc.some((p) => p.id === r.responder!.id)) {
        acc.push(r.responder);
      }
      return acc;
    }, []);

  return (
    <article
      onClick={() => router.push(`/main/chat/${consultation.sessionId}`)}
      className="w-[calc(100vw-2rem)] sm:w-auto sm:aspect-[9/19] h-full flex-shrink-0 snap-center cursor-pointer group"
    >
      <div className="bg-base-300/80 rounded-[20px] border border-base-content/10 overflow-hidden shadow-lg group-hover:shadow-xl group-hover:border-base-content/15 transition-all duration-200 h-full flex flex-col">
        {/* Status bar */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-base-300/60 flex-shrink-0">
          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
            {isAnonymous ? (
              <div className="bg-base-content/10 flex items-center justify-center w-full h-full text-[10px]">
                😎
              </div>
            ) : consultation.user?.avatarUrl ? (
              <Image
                src={consultation.user.avatarUrl}
                alt={displayName}
                width={20}
                height={20}
                className="rounded-full object-cover w-full h-full"
              />
            ) : (
              <div className="bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center w-full h-full text-[9px] font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="text-[11px] text-base-content/50 flex-shrink-0">
              {displayName}
            </span>
            <span className="text-[10px] text-base-content/30 flex-shrink-0">·</span>
            <span className="text-[11px] font-semibold text-base-content/80 truncate">
              {titleText}
            </span>
          </div>
        </div>

        {/* Chat area - fills remaining height, uses same DaisyUI chat classes as actual chat */}
        <div className="flex-1 px-2 py-2 flex flex-col bg-base-200/40 overflow-hidden relative min-h-0">
          {/* User message (right) - same as ChatBubble chat-user */}
          <div className="chat chat-end">
            <div className="chat-bubble chat-user shadow-sm text-[12px] leading-relaxed break-words max-w-[85%]">
              {questionText}
            </div>
          </div>

          {/* Response (left) - same as ChatBubble chat-assistant */}
          {answerText && (
            <div className="chat chat-start">
              <div className="chat-image avatar">
                <div className="w-5 rounded-full overflow-hidden">
                  {consultation.replies?.[0]?.responder?.avatarUrl ? (
                    <Image
                      src={consultation.replies[0].responder.avatarUrl}
                      alt=""
                      width={20}
                      height={20}
                      className="rounded-full object-cover w-full h-full"
                    />
                  ) : (
                    <div className="bg-base-content/10 flex items-center justify-center w-full h-full">
                      <span className="text-[8px]">🤖</span>
                    </div>
                  )}
                </div>
              </div>
              <div className={`chat-bubble ${consultation.replies?.[0]?.responder ? "chat-human-response" : "chat-assistant"} shadow-sm text-[12px] leading-relaxed break-words max-w-[80%]`}>
                {answerText}
              </div>
            </div>
          )}

          {/* Fade-out at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-base-200/90 to-transparent pointer-events-none" />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-base-300/60 border-t border-base-content/5 flex-shrink-0">
          {/* Participants */}
          <div className="flex items-center gap-2 min-w-0">
            {participants.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {participants.slice(0, 4).map((p, i) => (
                  <div
                    key={p.id || i}
                    className="w-5 h-5 rounded-full overflow-hidden border-2 border-base-300/60 flex-shrink-0"
                    title={p.displayName || p.handle}
                  >
                    {p.avatarUrl ? (
                      <Image src={p.avatarUrl} alt="" width={20} height={20} className="rounded-full object-cover w-full h-full" />
                    ) : (
                      <div className="bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center w-full h-full text-[8px] font-bold">
                        {(p.displayName || p.handle || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {participants.length > 4 && (
                  <div className="w-5 h-5 rounded-full bg-base-content/10 border-2 border-base-300/60 flex items-center justify-center text-[8px] text-base-content/50 flex-shrink-0">
                    +{participants.length - 4}
                  </div>
                )}
              </div>
            )}
            <span className="text-[10px] text-base-content/40 truncate">
              {replyCount}件の返信
            </span>
          </div>

          {/* Bookmark */}
          <div onClick={(e) => e.stopPropagation()}>
            <BookmarkButton sessionId={consultation.sessionId} className="!btn-xs !p-0 !min-h-0 !h-6 !w-6" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ExploreFeed() {
  const [consultations, setConsultations] = useState<TimelineConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchExplore = useCallback(async (cursorId?: string | null) => {
    try {
      if (cursorId) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const data = await exploreApi.getExplore(cursorId);

      if (cursorId) {
        setConsultations((prev) => [...prev, ...data.consultations]);
      } else {
        setConsultations(data.consultations);
      }
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (err) {
      clientLogger.error("Error fetching explore:", err);
      setError("探すの読み込みに失敗しました");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchExplore();
  }, [fetchExplore]);

  // Horizontal scroll: load more when near end
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (hasMore && !loadingMore && el.scrollLeft > maxScroll - 400) {
        fetchExplore(cursor);
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingMore, cursor, fetchExplore]);

  // IntersectionObserver fallback
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchExplore(cursor);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, cursor, fetchExplore]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="alert alert-error max-w-md">
          <span>{error}</span>
        </div>
        <button onClick={() => fetchExplore()} className="btn btn-primary mt-4">
          再読み込み
        </button>
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <img
          src="https://raw.githubusercontent.com/yamisskey-dev/yamisskey-assets/main/yui/yui-256x256.webp"
          alt="Yui"
          className="w-32 h-32 mb-6"
          draggable={false}
        />
        <h3 className="text-lg font-medium text-base-content/70 mb-2">
          ルームがありません
        </h3>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-4 sm:gap-6 h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory py-4 px-4 sm:px-8"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {consultations.map((consultation) => (
        <PhoneChatCard key={consultation.id} consultation={consultation} />
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="w-4 flex-shrink-0 flex items-center">
        {loadingMore && <LoadingSpinner size="md" />}
      </div>
    </div>
  );
}
