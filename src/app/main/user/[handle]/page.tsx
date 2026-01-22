"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import Image from "next/image";
import { ConsultationCard } from "@/components/Timeline";
import type { TimelineConsultation, TimelineResponse, UserStats } from "@/types";

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

interface WalletData {
  balance: number;
  economy?: {
    equilibriumBalance: number;
    todayGrant?: { granted: boolean; amount: number };
    todayDecay?: { applied: boolean; decayAmount: number };
  };
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

  // Own profile detection
  const [currentUserHandle, setCurrentUserHandle] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const isOwnProfile = currentUserHandle === decodedHandle;

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

  // Fetch current user to detect own profile
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUserHandle(data.handle);
        }
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch wallet and stats if own profile
  useEffect(() => {
    if (!isOwnProfile) return;

    const fetchWalletAndStats = async () => {
      try {
        const [walletRes, statsRes] = await Promise.all([
          fetch("/api/wallets"),
          fetch("/api/stats"),
        ]);
        if (walletRes.ok) {
          setWallet(await walletRes.json());
        }
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      } catch (err) {
        console.error("Failed to fetch wallet/stats:", err);
      }
    };
    fetchWalletAndStats();
  }, [isOwnProfile]);

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
        {/* Profile Header - Misskey style */}
        <div className="card bg-base-100 shadow-xl overflow-hidden mb-6">
          {/* Banner */}
          <div className="h-24 bg-gradient-to-r from-primary/30 via-secondary/20 to-primary/30" />

          {/* Profile Content */}
          <div className="px-6 pb-6">
            {/* Avatar - overlapping banner */}
            <div className="-mt-12 mb-4">
              <div className="avatar">
                <div className="w-24 h-24 rounded-full ring-4 ring-base-100 bg-base-100">
                  {user?.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={displayName}
                      width={96}
                      height={96}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center w-full h-full text-3xl font-bold rounded-full">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Name */}
            <h1 className="text-xl font-bold mb-1">{displayName}</h1>
            <p className="text-sm text-base-content/50 mb-3">{decodedHandle}</p>

            {/* YAMI bar (own profile only) */}
            {isOwnProfile && wallet && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-medium text-base-content/60 w-8">YAMI</span>
                <div className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      wallet.balance >= (wallet.economy?.equilibriumBalance ?? 50)
                        ? "bg-success"
                        : wallet.balance >= (wallet.economy?.equilibriumBalance ?? 50) * 0.5
                          ? "bg-primary"
                          : wallet.balance >= (wallet.economy?.equilibriumBalance ?? 50) * 0.25
                            ? "bg-warning"
                            : "bg-error"
                    }`}
                    style={{ width: `${Math.min(100, (wallet.balance / (wallet.economy?.equilibriumBalance ?? 50)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-base-content/40 w-8 text-right">
                  {Math.round((wallet.balance / (wallet.economy?.equilibriumBalance ?? 50)) * 100)}%
                </span>
              </div>
            )}

            {/* Stats grid - Misskey style */}
            <div className="flex border-t border-base-content/10 -mx-6 mt-4">
              <button className="flex-1 py-3 hover:bg-base-content/5 transition-colors text-center">
                <div className="font-bold">{consultations.length}</div>
                <div className="text-xs text-base-content/50">公開相談</div>
              </button>
            </div>
          </div>
        </div>

        {/* Consultations */}
        {consultations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
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
