"use client";

import { useEffect, useState, useCallback } from "react";
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

  const currentSessionId = pathname?.match(/\/main\/chat\/([^/]+)/)?.[1];

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

  const groupedSessions = groupSessionsByDate(sessions);

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

              {/* Delete button */}
              <button
                onClick={(e) => handleDelete(e, session.id)}
                className="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle shrink-0"
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
