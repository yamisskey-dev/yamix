"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ConsultationCard } from "./ConsultationCard";
import type { TimelineConsultation, TimelineResponse } from "@/types";

export function ExploreFeed() {
  const [currentUserHandle, setCurrentUserHandle] = useState<string>();
  const [consultations, setConsultations] = useState<TimelineConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchExplore = useCallback(async (cursorId?: string | null) => {
    try {
      if (cursorId) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const url = new URL("/api/explore", window.location.origin);
      url.searchParams.set("limit", "10");
      if (cursorId) {
        url.searchParams.set("cursor", cursorId);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch explore");

      const data: TimelineResponse = await res.json();

      if (cursorId) {
        setConsultations((prev) => [...prev, ...data.consultations]);
      } else {
        setConsultations(data.consultations);
      }
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (err) {
      console.error("Error fetching explore:", err);
      setError("探すの読み込みに失敗しました");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchExplore();
    // Get current user handle from localStorage
    const handle = localStorage.getItem("yamix_handle");
    if (handle) {
      setCurrentUserHandle(handle);
    }
  }, [fetchExplore]);

  // Infinite scroll with IntersectionObserver
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
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        {/* Yui mascot image */}
        <img
          src="https://raw.githubusercontent.com/yamisskey-dev/yamisskey-assets/main/yui/yui-256x256.webp"
          alt="Yui"
          className="w-32 h-32 mb-6"
          draggable={false}
        />
        <h3 className="text-lg font-medium text-base-content/70 mb-2">
          公開相談がありません
        </h3>
      </div>
    );
  }

  return (
    <div className="bg-base-100/50 backdrop-blur-sm rounded-xl border border-base-content/10 overflow-hidden">
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
          <span className="loading loading-spinner loading-md" />
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
