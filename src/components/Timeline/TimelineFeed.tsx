"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ConsultationCard } from "./ConsultationCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { TimelineConsultation } from "@/types";
import { timelineApi } from "@/lib/api-client";
import { clientLogger } from "@/lib/client-logger";

export function TimelineFeed() {
  const [currentUserHandle, setCurrentUserHandle] = useState<string>();
  const [consultations, setConsultations] = useState<TimelineConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [hasNew, setHasNew] = useState(false);
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const latestIdRef = useRef<string | null>(null);

  const fetchTimeline = useCallback(async (cursorId?: string | null) => {
    try {
      if (cursorId) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const data = await timelineApi.getTimeline(cursorId);

      if (cursorId) {
        setConsultations((prev) => [...prev, ...data.consultations]);
      } else {
        setConsultations(data.consultations);
        if (data.consultations.length > 0) {
          latestIdRef.current = data.consultations[0].id;
        }
      }
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
      setHasNew(false);
    } catch (err) {
      clientLogger.error("Error fetching timeline:", err);
      setError("タイムラインの読み込みに失敗しました");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTimeline();
    const handle = localStorage.getItem("yamix_handle");
    if (handle) {
      setCurrentUserHandle(handle);
    }
  }, [fetchTimeline]);

  // Check for new posts periodically
  useEffect(() => {
    const checkNew = async () => {
      try {
        const data = await timelineApi.getTimeline(null, 1);
        if (data.consultations.length > 0 && latestIdRef.current && data.consultations[0].id !== latestIdRef.current) {
          setHasNew(true);
        }
      } catch {
        // ignore
      }
    };
    const interval = setInterval(checkNew, 30000);
    return () => clearInterval(interval);
  }, []);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchTimeline(cursor);
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
  }, [hasMore, loadingMore, cursor, fetchTimeline]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="alert alert-error max-w-md">
          <span>{error}</span>
        </div>
        <button onClick={() => fetchTimeline()} className="btn btn-primary mt-4">
          再読み込み
        </button>
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <img
          src="https://raw.githubusercontent.com/yamisskey-dev/yamisskey-assets/main/yui/yui-256x256.webp"
          alt="Yui"
          className="w-32 h-32 mb-6"
          draggable={false}
        />
        <h3 className="text-lg font-medium text-base-content/70 mb-2">
          相談がありません
        </h3>
      </div>
    );
  }

  return (
    <div className="bg-base-100/50 backdrop-blur-sm rounded-xl border border-base-content/10 overflow-hidden">
      {/* New posts indicator */}
      {hasNew && (
        <button
          onClick={() => fetchTimeline()}
          className="w-full py-2 text-sm text-primary bg-primary/10 hover:bg-primary/15 border-b border-primary/20 transition-colors"
        >
          新しい相談があります
        </button>
      )}

      {consultations.map((consultation) => (
        <ConsultationCard
          key={consultation.id}
          consultation={consultation}
          currentUserHandle={currentUserHandle}
        />
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {loadingMore && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="md" />
        </div>
      )}

      {!hasMore && consultations.length > 0 && (
        <div className="text-center py-4 text-base-content/50 text-sm">
          すべての相談を読み込みました
        </div>
      )}
    </div>
  );
}
