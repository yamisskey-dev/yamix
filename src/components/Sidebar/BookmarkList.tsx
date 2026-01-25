"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LoadingSpinner } from "@/components/LoadingSpinner";

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
        <LoadingSpinner size="sm" />
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
    <div className="space-y-0.5">
      {bookmarks.map((bookmark) => (
        <Link
          key={bookmark.id}
          href={`/main/chat/${bookmark.sessionId}`}
          onClick={onSessionClick}
          className="block px-3 py-1.5 hover:bg-base-200 transition-colors rounded-md"
        >
          <p className="text-xs truncate">
            {bookmark.session.title || "無題の相談"}
          </p>
        </Link>
      ))}
    </div>
  );
}
