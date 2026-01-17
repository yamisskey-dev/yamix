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
      <div className="flex items-center justify-center py-8">
        <span className="loading loading-spinner loading-sm" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/50 text-sm">
        まだ相談履歴がありません
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {groupedSessions.map((group) => (
        <div key={group.label}>
          <div className="px-3 py-2 text-xs font-semibold text-base-content/50">
            {group.label}
          </div>
          {group.sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSessionClick(session.id)}
              className={`w-full group flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-base-200 cursor-pointer ${
                currentSessionId === session.id ? "bg-base-200" : ""
              }`}
            >
              <span className="flex-1 truncate">
                {session.title || "新しい相談"}
              </span>
              <button
                onClick={(e) => handleDelete(e, session.id)}
                className="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle"
                title="削除"
              >
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
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
