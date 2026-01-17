"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import Image from "next/image";
import { ConsultationCard } from "@/components/Timeline";
import type { TimelineConsultation, TimelineResponse } from "@/types";

interface PageProps {
  params: Promise<{ handle: string }>;
}

interface UserProfile {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface UserTimelineResponse extends TimelineResponse {
  user: UserProfile;
}

export default function UserProfilePage({ params }: PageProps) {
  const { handle } = use(params);
  const decodedHandle = decodeURIComponent(handle);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [consultations, setConsultations] = useState<TimelineConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchTimeline = useCallback(async (cursorId?: string | null) => {
    try {
      if (cursorId) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const url = new URL(
        `/api/timeline/user/${encodeURIComponent(decodedHandle)}`,
        window.location.origin
      );
      url.searchParams.set("limit", "10");
      if (cursorId) {
        url.searchParams.set("cursor", cursorId);
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        if (res.status === 404) {
          setError("ユーザーが見つかりません");
          return;
        }
        throw new Error("Failed to fetch timeline");
      }

      const data: UserTimelineResponse = await res.json();

      setUser(data.user);
      if (cursorId) {
        setConsultations((prev) => [...prev, ...data.consultations]);
      } else {
        setConsultations(data.consultations);
      }
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (err) {
      console.error("Error fetching user timeline:", err);
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [decodedHandle]);

  // Initial fetch
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

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
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-6xl mb-4">😢</div>
        <p className="text-base-content/60">{error}</p>
      </div>
    );
  }

  const displayName = user?.displayName || decodedHandle.split("@")[1] || decodedHandle;

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-2xl mx-auto p-4">
        {/* Profile Header */}
        <div className="card bg-base-100/50 backdrop-blur-sm shadow-lg border border-base-300/50 mb-6">
          <div className="card-body items-center text-center">
            <div className="avatar mb-4">
              <div className="w-24 h-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                {user?.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={displayName}
                    width={96}
                    height={96}
                    className="rounded-full"
                  />
                ) : (
                  <div className="bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center w-full h-full text-4xl font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-xl font-bold">{displayName}</h1>
            <p className="text-sm text-base-content/60">{decodedHandle}</p>
            <div className="stat p-2">
              <div className="stat-value text-lg">{consultations.length}</div>
              <div className="stat-desc">公開相談</div>
            </div>
          </div>
        </div>

        {/* Consultations */}
        {consultations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-base-content/50">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-sm">公開相談がありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {consultations.map((consultation) => (
              <ConsultationCard key={consultation.id} consultation={consultation} />
            ))}

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
        )}
      </div>
    </div>
  );
}
