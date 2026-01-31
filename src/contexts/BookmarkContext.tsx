"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { bookmarkApi } from "@/lib/api-client";
import { clientLogger } from "@/lib/client-logger";

interface BookmarkContextType {
  /** Set of bookmarked session IDs */
  bookmarkedIds: Set<string>;
  /** Toggle bookmark for a session, returns new bookmarked state */
  toggle: (sessionId: string) => Promise<boolean>;
  /** Revision counter - increments on every change to trigger re-renders in listeners */
  revision: number;
}

const BookmarkContext = createContext<BookmarkContextType>({
  bookmarkedIds: new Set(),
  toggle: async () => false,
  revision: 0,
});

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [revision, setRevision] = useState(0);

  // Fetch all bookmarked session IDs on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await bookmarkApi.getBookmarks();
        const ids = new Set<string>(
          (data.bookmarks || []).map((b) => b.sessionId)
        );
        setBookmarkedIds(ids);
      } catch (error) {
        clientLogger.error("Failed to fetch bookmarks:", error);
      }
    })();
  }, []);

  const toggle = useCallback(async (sessionId: string): Promise<boolean> => {
    const isCurrentlyBookmarked = bookmarkedIds.has(sessionId);

    try {
      if (isCurrentlyBookmarked) {
        await bookmarkApi.removeBookmark(sessionId);
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
        setRevision((r) => r + 1);
        return false;
      } else {
        await bookmarkApi.addBookmark(sessionId);
        setBookmarkedIds((prev) => new Set(prev).add(sessionId));
        setRevision((r) => r + 1);
        return true;
      }
    } catch (error) {
      clientLogger.error("Bookmark toggle error:", error);
    }

    return isCurrentlyBookmarked;
  }, [bookmarkedIds]);

  return (
    <BookmarkContext.Provider value={{ bookmarkedIds, toggle, revision }}>
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmarks() {
  return useContext(BookmarkContext);
}
