"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ChatSessionListItem, ChatSessionsResponse } from "@/types";

// Group sessions by date
function groupSessionsByDate(sessions: ChatSessionListItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groups: { label: string; sessions: ChatSessionListItem[] }[] = [
    { label: "今日", sessions: [] },
    { label: "昨日", sessions: [] },
    { label: "過去7日", sessions: [] },
    { label: "それ以前", sessions: [] },
  ];

  sessions.forEach((session) => {
    const sessionDate = new Date(session.updatedAt);
    sessionDate.setHours(0, 0, 0, 0);

    if (sessionDate >= today) {
      groups[0].sessions.push(session);
    } else if (sessionDate >= yesterday) {
      groups[1].sessions.push(session);
    } else if (sessionDate >= lastWeek) {
      groups[2].sessions.push(session);
    } else {
      groups[3].sessions.push(session);
    }
  });

  return groups.filter((g) => g.sessions.length > 0);
}

interface Props {
  onSessionSelect?: () => void;
}

export function ChatSessionList({ onSessionSelect }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [updatingPublic, setUpdatingPublic] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const currentSessionId = pathname?.match(/\/main\/chat\/([^/]+)/)?.[1];

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (session) =>
        session.title?.toLowerCase().includes(query) ||
        session.preview?.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  const fetchSessions = useCallback(async (cursorId?: string | null) => {
    try {
      const url = new URL("/api/chat/sessions", window.location.origin);
      url.searchParams.set("limit", "20");
      if (cursorId) {
        url.searchParams.set("cursor", cursorId);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch sessions");

      const data: ChatSessionsResponse = await res.json();

      if (cursorId) {
        setSessions((prev) => [...prev, ...data.sessions]);
      } else {
        setSessions(data.sessions);
      }
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSessionClick = (sessionId: string) => {
    router.push(`/main/chat/${sessionId}`);
    onSessionSelect?.();
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm("この相談を削除しますか？")) return;

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete session");

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // If we deleted the current session, navigate to new chat
      if (currentSessionId === sessionId) {
        router.push("/main");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleTogglePublic = async (e: React.MouseEvent, session: ChatSessionListItem) => {
    e.stopPropagation();
    if (updatingPublic === session.id) return;

    setUpdatingPublic(session.id);
    try {
      const res = await fetch(`/api/chat/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !session.isPublic }),
      });
      if (!res.ok) throw new Error("Failed to update public status");

      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id ? { ...s, isPublic: !s.isPublic } : s
        )
      );
    } catch (error) {
      console.error("Error updating public status:", error);
    } finally {
      setUpdatingPublic(null);
    }
  };

  const groupedSessions = groupSessionsByDate(filteredSessions);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {/* Skeleton loading for session list */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-xl">
            <div className="skeleton w-4 h-4 rounded-full shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="skeleton h-4 w-3/4 mb-1.5" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-base-200/50 flex items-center justify-center mb-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-base-content/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <p className="text-base-content/40 text-sm">まだ相談履歴がありません</p>
        <p className="text-base-content/30 text-xs mt-1">新しい相談を始めてみましょう</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="px-2 pb-2">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="検索..."
            className="input input-sm w-full pl-9 pr-8 bg-base-200/50 border-none focus:bg-base-200 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* No search results */}
      {searchQuery && filteredSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-base-content/40 text-sm">「{searchQuery}」に一致する相談がありません</p>
        </div>
      )}
      {groupedSessions.map((group, index) => (
        <div key={group.label}>
          {/* Date group header with subtle divider */}
          <div className={`flex items-center gap-2 px-3 py-2 ${index > 0 ? "mt-2" : ""}`}>
            <span className="text-xs font-medium text-base-content/40 uppercase tracking-wider">
              {group.label}
            </span>
            <div className="flex-1 h-px bg-base-content/10" />
          </div>
          {group.sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSessionClick(session.id)}
              className={`w-full group flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                currentSessionId === session.id
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-base-200/70 border border-transparent"
              }`}
            >
              {/* Chat icon */}
              <div className={`mt-0.5 ${currentSessionId === session.id ? "text-primary" : "text-base-content/40"}`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>

              {/* Title and preview */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium truncate block ${currentSessionId === session.id ? "text-primary" : ""}`}>
                  {session.title || "新しい相談"}
                </span>
                {session.preview && (
                  <span className="text-xs text-base-content/50 truncate block mt-0.5">
                    {session.preview}...
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 shrink-0">
                {/* Public toggle button */}
                <button
                  onClick={(e) => handleTogglePublic(e, session)}
                  className={`btn btn-ghost btn-xs btn-circle ${
                    session.isPublic
                      ? "text-primary"
                      : "opacity-0 group-hover:opacity-100 text-base-content/50"
                  }`}
                  title={session.isPublic ? "公開中（クリックで非公開に）" : "非公開（クリックで公開に）"}
                  disabled={updatingPublic === session.id}
                >
                  {updatingPublic === session.id ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : session.isPublic ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </button>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle"
                  title="削除"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {hasMore && (
        <button
          onClick={() => fetchSessions(cursor)}
          className="btn btn-ghost btn-sm mt-2"
        >
          もっと見る
        </button>
      )}
    </div>
  );
}
