"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatSessionListItem } from "@/types";
import { useToast } from "@/components/Toast";

interface SessionLike {
  id: string;
  title: string | null;
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
  isCrisisPrivatized?: boolean;
}

interface Props {
  session: SessionLike;
  onDelete: () => void;
  onUpdate: () => void;
  isBookmarked?: boolean; // ブックマーク済みの場合はtrue
  onUnbookmark?: () => void; // ブックマーク解除ハンドラー
  isOwner?: boolean; // セッションのオーナーかどうか
}

export function SessionMenu({ session, onDelete, onUpdate, isBookmarked, onUnbookmark, isOwner = true }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title || "");
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleShare = async () => {
    setLoading(true);
    try {
      // セッションの共有URLをクリップボードにコピー
      const shareUrl = `${window.location.origin}/main/chat/${session.id}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("共有URLをコピーしました");
    } catch (error) {
      console.error("Failed to copy share URL:", error);
      toast.error("URLのコピーに失敗しました");
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const handleMakePublic = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultType: "PUBLIC" }),
      });

      if (!res.ok) throw new Error("Failed to make public");

      toast.success("公開相談に変更しました");
      onUpdate();
    } catch (error) {
      console.error("Failed to make public:", error);
      toast.error("公開に失敗しました");
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const handleRename = async () => {
    if (!newTitle.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/chat/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (!res.ok) throw new Error("Failed to rename");

      onUpdate();
      setIsRenaming(false);
    } catch (error) {
      console.error("Failed to rename:", error);
      toast.error("名前の変更に失敗しました");
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const handleBookmarkToggle = async () => {
    setLoading(true);
    try {
      if (isBookmarked && onUnbookmark) {
        // ブックマークから削除
        onUnbookmark();
        setIsOpen(false);
      } else {
        // ブックマークに追加
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id }),
        });

        if (!res.ok) throw new Error("Failed to bookmark");

        toast.success("ブックマークに追加しました");
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
      toast.error("ブックマーク操作に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    setIsOpen(false);
    onDelete();
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu trigger button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 btn btn-ghost btn-xs btn-circle"
        title="メニュー"
        aria-label="相談のメニューを開く"
        aria-haspopup="true"
        aria-expanded={isOpen}
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
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-48 bg-base-100 rounded-lg shadow-xl border border-base-300 z-50 py-1 animate-dropdown-in"
          onClick={(e) => e.stopPropagation()}
        >
          {isRenaming ? (
            <div className="p-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                className="input input-sm w-full mb-2"
                placeholder="新しい名前"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRename}
                  className="btn btn-primary btn-xs flex-1"
                  disabled={loading || !newTitle.trim()}
                >
                  保存
                </button>
                <button
                  onClick={() => setIsRenaming(false)}
                  className="btn btn-ghost btn-xs flex-1"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                }
                label="共有する"
                onClick={handleShare}
                disabled={loading}
              />

              {isOwner && session.consultType === "PRIVATE" && !session.isCrisisPrivatized && (
                <MenuItem
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" />
                    </svg>
                  }
                  label="公開する"
                  onClick={handleMakePublic}
                  disabled={loading}
                />
              )}

              {isOwner && (
                <MenuItem
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  }
                  label="名前を変更"
                  onClick={() => setIsRenaming(true)}
                  disabled={loading}
                />
              )}

              <MenuItem
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                }
                label={isBookmarked ? "ブックマーク解除" : "ブックマークする"}
                onClick={handleBookmarkToggle}
                disabled={loading}
              />

              {isOwner && (
                <>
                  <div className="divider my-1" />

                  <MenuItem
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    }
                    label="削除する"
                    onClick={handleDeleteClick}
                    disabled={loading}
                    danger
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-base-200 transition-colors ${
        danger ? "text-error" : ""
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
