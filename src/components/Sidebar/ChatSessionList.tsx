"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ChatSessionListItem, ChatSessionsResponse } from "@/types";
import { SessionMenu } from "./SessionMenu";
import { ConfirmModal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";

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
  searchQuery?: string;
}

export function ChatSessionList({ onSessionSelect, searchQuery = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [bookmarkedSessionIds, setBookmarkedSessionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteModalRef = useRef<HTMLDialogElement>(null);

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

  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch("/api/bookmarks?limit=100");
      if (res.ok) {
        const data = await res.json();
        const ids = new Set<string>(data.bookmarks.map((b: { sessionId: string }) => b.sessionId));
        setBookmarkedSessionIds(ids);
      }
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
    }
  }, []);

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
    fetchBookmarks();

    // Listen for new session created event
    const handleNewSession = () => {
      fetchSessions();
    };

    // Listen for session deleted event (from chat page header)
    const handleSessionDeleted = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId: string }>).detail;
      setSessions((prev) => prev.filter((s) => s.id !== detail.sessionId));
    };

    window.addEventListener("newChatSessionCreated", handleNewSession);
    window.addEventListener("chatSessionDeleted", handleSessionDeleted);

    return () => {
      window.removeEventListener("newChatSessionCreated", handleNewSession);
      window.removeEventListener("chatSessionDeleted", handleSessionDeleted);
    };
  }, [fetchSessions, fetchBookmarks]);

  const handleSessionClick = (sessionId: string) => {
    router.push(`/main/chat/${sessionId}`);
    onSessionSelect?.();
  };

  const openDeleteModal = (sessionId: string) => {
    setDeleteTargetId(sessionId);
    deleteModalRef.current?.showModal();
  };

  const deleteSession = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/chat/sessions/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete session");

      setSessions((prev) => prev.filter((s) => s.id !== deleteTargetId));

      // If we deleted the current session, navigate to new chat
      if (currentSessionId === deleteTargetId) {
        router.push("/main");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  const removeBookmark = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/bookmarks?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove bookmark");

      setBookmarkedSessionIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    } catch (error) {
      console.error("Error removing bookmark:", error);
    }
  };


  // ブックマーク済みセッションと通常セッションを分離
  const bookmarkedSessions = filteredSessions.filter((s) => bookmarkedSessionIds.has(s.id));
  const unbookmarkedSessions = filteredSessions.filter((s) => !bookmarkedSessionIds.has(s.id));

  const groupedSessions = groupSessionsByDate(unbookmarkedSessions);

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
      <EmptyState
        message="まだ相談履歴がありません"
        description="新しい相談を始めてみましょう"
        showImage
      />
    );
  }

  // Session item renderer
  const renderSessionItem = (session: ChatSessionListItem, isBookmarked: boolean) => (
    <div
      key={session.id}
      onClick={() => handleSessionClick(session.id)}
      className={`w-full group flex items-start gap-2 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
        currentSessionId === session.id
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-base-200/70 border border-transparent"
      }`}
    >
      {/* Title and preview */}
      <div className="flex-1 min-w-0">
        <span className={`text-[13px] font-medium truncate block ${currentSessionId === session.id ? "text-primary" : ""}`}>
          {session.title || session.preview || "新しい相談"}
        </span>
        {session.title && session.preview && (
          <span className="text-[11px] text-base-content/50 truncate block mt-0.5">
            {session.preview}...
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Consult type indicator */}
        {session.consultType === "PRIVATE" ? (
          <div className={`${currentSessionId === session.id ? "text-primary" : "text-base-content/40"}`} title="プライベート相談">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        ) : session.consultType === "DIRECTED" ? (
          <div className={`${currentSessionId === session.id ? "text-primary" : "text-base-content/40"}`} title="指名相談">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M3 4a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm2.5 1a.5.5 0 00-.5.5v1.077l4.146 2.907a1.5 1.5 0 001.708 0L15 6.577V5.5a.5.5 0 00-.5-.5h-9zM15 8.077l-3.854 2.7a2.5 2.5 0 01-2.848-.056L4.5 8.077V13.5a.5.5 0 00.5.5h9.5a.5.5 0 00.5-.5V8.077z" />
            </svg>
          </div>
        ) : (
          <div className={`${currentSessionId === session.id ? "text-primary" : "text-base-content/40"}`} title="公開相談">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" />
            </svg>
          </div>
        )}

        {/* Session menu */}
        <SessionMenu
          session={session}
          onDelete={() => openDeleteModal(session.id)}
          onUpdate={() => {
            fetchSessions();
            fetchBookmarks();
          }}
          isBookmarked={isBookmarked}
          onUnbookmark={isBookmarked ? () => removeBookmark(session.id) : undefined}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* No search results */}
      {searchQuery && filteredSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-base-content/40 text-sm">「{searchQuery}」に一致する相談がありません</p>
        </div>
      )}

      {/* Bookmarked sessions */}
      {bookmarkedSessions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="text-[11px] font-medium text-base-content/40 uppercase tracking-wider">
              ブックマーク
            </span>
            <div className="flex-1 h-px bg-base-content/10" />
          </div>
          {bookmarkedSessions.map((session) => renderSessionItem(session, true))}
        </div>
      )}

      {/* Regular sessions grouped by date */}
      {groupedSessions.map((group, index) => (
        <div key={group.label}>
          {/* Date group header with subtle divider */}
          <div className={`flex items-center gap-2 px-3 py-1.5 ${index > 0 || bookmarkedSessions.length > 0 ? "mt-1.5" : ""}`}>
            <span className="text-[11px] font-medium text-base-content/40 uppercase tracking-wider">
              {group.label}
            </span>
            <div className="flex-1 h-px bg-base-content/10" />
          </div>
          {group.sessions.map((session) => renderSessionItem(session, false))}
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

      {/* Delete confirmation modal */}
      <ConfirmModal
        ref={deleteModalRef}
        title="相談を削除"
        body="この相談を削除してもよろしいですか？この操作は取り消せません。"
        confirmText={isDeleting ? "削除中..." : "削除"}
        cancelText="キャンセル"
        onConfirm={deleteSession}
        confirmButtonClass="btn-error"
      />
    </div>
  );
}
