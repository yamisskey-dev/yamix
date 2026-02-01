"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ChatSessionListItem } from "@/types";
import { SessionMenu } from "./SessionMenu";
import { ConfirmModal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { ConsultTypeIcon, getConsultTypeLabel } from "@/components/ConsultTypeIcon";
import { useBookmarks } from "@/contexts/BookmarkContext";
import { chatApi } from "@/lib/api-client";
import { clientLogger } from "@/lib/client-logger";
import { localSessionStore } from "@/lib/local-session-store";

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
  const { bookmarkedIds, toggle: toggleBookmark } = useBookmarks();
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
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

  const fetchSessions = useCallback(async (cursorId?: string | null) => {
    try {
      // Fetch server sessions
      const data = await chatApi.getSessions(cursorId);

      // Get local sessions (unsynced)
      const localSessions = await localSessionStore.getAllSessions();
      const unsyncedLocalSessions = localSessions
        .filter((s) => s.id.startsWith('local-') && !s.synced)
        .map((s) => ({
          id: s.id,
          title: s.messages[0]?.content.slice(0, 30) || "新しい相談",
          preview: s.messages[0]?.content.slice(0, 50) || null,
          consultType: s.consultType,
          isAnonymous: s.isAnonymous,
          targetCount: s.targetUserIds?.length || 0,
          isReceived: false,
          isCrisisPrivatized: false,
          updatedAt: new Date(s.updatedAt || s.createdAt),
        } as ChatSessionListItem));

      // Merge: local sessions first (most recent), then server sessions
      const mergedSessions = [...unsyncedLocalSessions, ...data.sessions];

      if (cursorId) {
        setSessions((prev) => [...prev, ...mergedSessions]);
      } else {
        setSessions(mergedSessions);
      }
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (error) {
      clientLogger.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();

    const handleNewSession = () => {
      fetchSessions();
    };

    const handleSessionDeleted = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId: string }>).detail;
      setSessions((prev) => prev.filter((s) => s.id !== detail.sessionId));
    };

    // リアクティブなローカルセッション更新
    const unsubscribe = localSessionStore.onChange((sessionId, session) => {
      if (!session) {
        // 削除された
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        // 作成/更新された
        setSessions((prev) => {
          const exists = prev.some((s) => s.id === sessionId);
          const sessionItem: ChatSessionListItem = {
            id: session.id,
            title: session.messages[0]?.content.slice(0, 30) || "新しい相談",
            preview: session.messages[0]?.content.slice(0, 50) || null,
            consultType: session.consultType,
            isAnonymous: session.isAnonymous,
            targetCount: session.targetUserIds?.length || 0,
            isReceived: false,
            isCrisisPrivatized: false,
            updatedAt: new Date(session.updatedAt || session.createdAt),
          };

          if (exists) {
            // 更新
            return prev.map((s) => (s.id === sessionId ? sessionItem : s));
          } else {
            // 新規追加（先頭に）
            return [sessionItem, ...prev];
          }
        });
      }
    });

    window.addEventListener("newChatSessionCreated", handleNewSession);
    window.addEventListener("chatSessionDeleted", handleSessionDeleted);

    return () => {
      unsubscribe();
      window.removeEventListener("newChatSessionCreated", handleNewSession);
      window.removeEventListener("chatSessionDeleted", handleSessionDeleted);
    };
  }, [fetchSessions]);

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
      // ローカルセッションかサーバーセッションかを判定
      if (deleteTargetId.startsWith('local-')) {
        // ローカルセッション削除
        await localSessionStore.delete(deleteTargetId);
      } else {
        // サーバーセッション削除
        await chatApi.deleteSession(deleteTargetId);
      }

      // UIから削除（リアクティブ更新でも削除されるが、即座に反映）
      setSessions((prev) => prev.filter((s) => s.id !== deleteTargetId));

      // 現在表示中のセッションを削除した場合はメインページへ
      if (currentSessionId === deleteTargetId) {
        router.push("/main");
      }
    } catch (error) {
      clientLogger.error("Error deleting session:", error);
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  const handleUnbookmark = async (sessionId: string) => {
    await toggleBookmark(sessionId);
  };

  // ブックマーク済みセッションと通常セッションを分離
  const bookmarkedSessions = filteredSessions.filter((s) => bookmarkedIds.has(s.id));
  const unbookmarkedSessions = filteredSessions.filter((s) => !bookmarkedIds.has(s.id));

  const groupedSessions = groupSessionsByDate(unbookmarkedSessions);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-2">
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
      {/* Consult type indicator */}
      <div className={`shrink-0 mt-0.5 ${currentSessionId === session.id ? "text-primary" : "text-base-content/40"}`} title={getConsultTypeLabel(session.consultType)}>
        <ConsultTypeIcon type={session.consultType} className="h-3.5 w-3.5" />
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className={`text-[13px] font-medium truncate block ${currentSessionId === session.id ? "text-primary" : ""}`}>
          {session.title || "新しい相談"}
        </span>
        {/* ローカルセッション（同期中）インジケーター */}
        {session.id.startsWith('local-') && (
          <span className="shrink-0 loading loading-spinner loading-xs opacity-50" title="サーバーと同期中" />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        <SessionMenu
          session={session}
          onDelete={() => openDeleteModal(session.id)}
          onUpdate={() => fetchSessions()}
          isBookmarked={isBookmarked}
          onUnbookmark={isBookmarked ? () => handleUnbookmark(session.id) : undefined}
          isOwner={!session.isReceived}
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
