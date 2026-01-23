"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BookmarkItem {
  id: string;
  sessionId: string;
  createdAt: string;
  session: {
    id: string;
    title: string | null;
    consultType: "PRIVATE" | "PUBLIC";
    isAnonymous: boolean;
    preview: string | null;
    updatedAt: string;
    user: {
      id: string;
      handle: string;
      displayName: string | null;
      avatarUrl: string | null;
    };
  };
}

interface Props {
  onSessionClick?: () => void;
}

export function BookmarkList({ onSessionClick }: Props) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks?limit=10");
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks);
      }
    } catch (error) {
      console.error("Failed to fetch bookmarks:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <span className="loading loading-spinner loading-sm"></span>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="text-center p-4 text-base-content/50 text-xs">
        ブックマークはありません
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {bookmarks.map((bookmark) => (
        <Link
          key={bookmark.id}
          href={`/main/chat/${bookmark.sessionId}`}
          onClick={onSessionClick}
          className="block px-4 py-2 hover:bg-base-200 transition-colors rounded-lg"
        >
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">🔖</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {bookmark.session.title || "無題の相談"}
              </p>
              {bookmark.session.preview && (
                <p className="text-xs text-base-content/60 truncate mt-0.5">
                  {bookmark.session.preview}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
