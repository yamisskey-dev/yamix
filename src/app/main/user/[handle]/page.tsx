"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import Image from "next/image";
import { ConsultationCard } from "@/components/Timeline";
import type { TimelineConsultation, TimelineResponse, UserStats } from "@/types";

interface PageProps {
  params: Promise<{ handle: string }>;
}

interface UserProfile {
  id: string;
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
  const [items, setItems] = useState<TimelineConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  // Own profile detection
  const [currentUserHandle, setCurrentUserHandle] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const isOwnProfile = currentUserHandle === decodedHandle;

  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true);

      // 相談と回答の両方を並列で取得
      const [consultRes, responseRes] = await Promise.all([
        fetch(`/api/timeline/user/${encodeURIComponent(decodedHandle)}`),
        fetch(`/api/timeline/user/${encodeURIComponent(decodedHandle)}/responses`),
      ]);

      if (!consultRes.ok) {
        if (consultRes.status === 404) {
          setError("ユーザーが見つかりません");
          return;
        }
        throw new Error("Failed to fetch consultations");
      }

      const consultData: UserTimelineResponse = await consultRes.json();
      setUser(consultData.user);

      // Get userId from user object
      if (consultData.user?.id) {
        setUserId(consultData.user.id);
      }

      let allItems = [...consultData.consultations];

      // 回答も取得できた場合は統合
      if (responseRes.ok) {
        const responseData: UserTimelineResponse = await responseRes.json();
        allItems = [...allItems, ...responseData.consultations];
      }

      // 時系列でソート（新しい順）
      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setItems(allItems);
    } catch (err) {
      console.error("Error fetching user timeline:", err);
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
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

  // Check if user is blocked (for other profiles)
  useEffect(() => {
    if (isOwnProfile || !currentUserHandle || !user) return;

    const checkBlockStatus = async () => {
      try {
        const res = await fetch("/api/users/block");
        if (res.ok) {
          const data = await res.json();
          const blocked = data.blocks.some(
            (block: any) => block.blockedUser?.id === user.id
          );
          setIsBlocked(blocked);
        }
      } catch (err) {
        console.error("Failed to check block status:", err);
      }
    };
    checkBlockStatus();
  }, [isOwnProfile, currentUserHandle, user]);

  const handleBlockToggle = async () => {
    if (!userId && !decodedHandle) return;

    setIsBlockLoading(true);
    try {
      if (isBlocked) {
        // Unblock - we need userId for this
        if (!userId) {
          alert("ブロック解除に失敗しました");
          return;
        }
        const res = await fetch(`/api/users/block/${userId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setIsBlocked(false);
        } else {
          alert("ブロック解除に失敗しました");
        }
      } else {
        // Block - we need userId for this too
        // We need to get userId first from somewhere
        // Let's try to get it from the timeline API user object
        if (!userId) {
          alert("ブロックに失敗しました");
          return;
        }
        const res = await fetch("/api/users/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockedUserId: userId }),
        });
        if (res.ok) {
          setIsBlocked(true);
        } else {
          const data = await res.json();
          alert(data.error || "ブロックに失敗しました");
        }
      }
    } catch (err) {
      console.error("Block toggle error:", err);
      alert("操作に失敗しました");
    } finally {
      setIsBlockLoading(false);
    }
  };

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

  // Parse handle to get Misskey profile URL
  const getMisskeyProfileUrl = (handle: string) => {
    // Handle format: @account@hostname
    const parts = handle.split("@").filter(Boolean);
    if (parts.length === 2) {
      const [account, hostname] = parts;
      return `https://${hostname}/@${account}`;
    }
    return null;
  };

  const misskeyProfileUrl = getMisskeyProfileUrl(decodedHandle);

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-2xl mx-auto p-4">
        {/* Profile Header - Simple style */}
        <div className="card bg-base-100 shadow-xl overflow-hidden mb-6">
          {/* Profile Content */}
          <div className="px-6 py-6">
            {/* Avatar and Name - Horizontal Layout */}
            <div className="flex items-center gap-4 mb-4">
              {/* Avatar */}
              <div className="avatar">
                <div className="w-20 h-20 rounded-full">
                  {user?.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={displayName}
                      width={80}
                      height={80}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center w-full h-full text-2xl font-bold rounded-full">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Name and Handle */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold truncate">{displayName}</h1>
                {misskeyProfileUrl ? (
                  <a
                    href={misskeyProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-base-content/50 hover:text-primary hover:underline truncate block"
                  >
                    {decodedHandle}
                  </a>
                ) : (
                  <p className="text-sm text-base-content/50 truncate">{decodedHandle}</p>
                )}
              </div>

              {/* Block/Unblock button (only for other profiles) */}
              {!isOwnProfile && currentUserHandle && (
                <button
                  onClick={handleBlockToggle}
                  disabled={isBlockLoading || !userId}
                  className={`btn btn-sm ${isBlocked ? "btn-ghost" : "btn-error btn-outline"}`}
                >
                  {isBlockLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : isBlocked ? (
                    "ブロック解除"
                  ) : (
                    "ブロック"
                  )}
                </button>
              )}
            </div>

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
          </div>
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <img
              src="https://raw.githubusercontent.com/yamisskey-dev/yamisskey-assets/main/yui/yui-256x256.webp"
              alt="Yui"
              className="w-32 h-32 mb-6"
              draggable={false}
            />
            <h3 className="text-lg font-medium text-base-content/70 mb-2">
              アクティビティがありません
            </h3>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((consultation) => (
              <ConsultationCard
                key={consultation.id}
                consultation={consultation}
                currentUserHandle={currentUserHandle ?? undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
