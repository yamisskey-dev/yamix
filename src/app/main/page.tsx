"use client";

import { useState, useRef, useEffect, useMemo, useCallback, memo, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";

const LoadingSpinner = lazy(() => import("@/components/LoadingSpinner").then(mod => ({ default: mod.LoadingSpinner })));

// Memoized user search list item to prevent unnecessary re-renders
const UserSearchListItem = memo(function UserSearchListItem({
  user,
  onAdd
}: {
  user: { id: string; handle: string; displayName: string | null; avatarUrl: string | null };
  onAdd: (user: { handle: string; displayName: string | null; avatarUrl: string | null }) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="btn btn-ghost btn-xs w-full justify-start gap-2 transition-colors duration-150"
        onClick={() => onAdd(user)}
      >
        {user.avatarUrl && (
          <img src={user.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
        )}
        <span className="truncate">
          {user.displayName && <span className="font-medium">{user.displayName} </span>}
          <span className="opacity-60">@{user.handle}</span>
        </span>
      </button>
    </li>
  );
});

export default function NewChatPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [inputValue, setInputValue] = useState("");
  const submittingRef = useRef<boolean>(false);
  const [consultType, setConsultType] = useState<"PRIVATE" | "PUBLIC" | "DIRECTED">("PRIVATE");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowAnonymousResponses, setAllowAnonymousResponses] = useState(true);
  const [targetUsers, setTargetUsers] = useState<{ handle: string; displayName: string | null; avatarUrl: string | null }[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; handle: string; displayName: string | null; avatarUrl: string | null }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // User search with debounce
  useEffect(() => {
    if (!userSearchQuery || userSearchQuery.length < 1) {
      setUserSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(userSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out already selected users
          const selectedHandles = new Set(targetUsers.map((u) => u.handle));
          setUserSearchResults(data.users.filter((u: { handle: string }) => !selectedHandles.has(u.handle)));
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [userSearchQuery, targetUsers]);

  const addTargetUser = useCallback((user: { handle: string; displayName: string | null; avatarUrl: string | null }) => {
    setTargetUsers((prev) => [...prev, user]);
    setUserSearchQuery("");
    setUserSearchResults([]);
  }, []);

  const removeTargetUser = useCallback((handle: string) => {
    setTargetUsers((prev) => {
      const updated = prev.filter((u) => u.handle !== handle);
      if (updated.length === 0) {
        setConsultType("PUBLIC");
        setShowUserSearch(false);
      }
      return updated;
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || isLoading || submittingRef.current) {
      return;
    }

    submittingRef.current = true;

    const messageContent = inputValue.trim();
    setInputValue("");
    setIsLoading(true);
    setError(undefined);

    // Create new session (don't await to keep in user interaction context)
    fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consultType,
        isAnonymous: consultType !== "PRIVATE" ? isAnonymous : false,
        allowAnonymousResponses: consultType !== "PRIVATE" ? allowAnonymousResponses : true,
        ...(consultType === "DIRECTED" && {
          targetUserHandles: targetUsers.map((u) => u.handle),
        }),
      }),
    })
      .then(async (createRes) => {
        if (!createRes.ok) {
          const errorData = await createRes.json();
          throw new Error(errorData.error || "セッションの作成に失敗しました");
        }
        return createRes.json();
      })
      .then((session) => {
        // Store initial message in sessionStorage for the chat page to pick up
        sessionStorage.setItem(`pendingMessage-${session.id}`, messageContent);

        // Wait a tiny bit to ensure DB transaction is committed (race condition fix for mobile)
        setTimeout(() => {
          // Try native HTML navigation instead of JS navigation
          // Create a temporary anchor element and click it programmatically
          const anchor = document.createElement('a');
          anchor.href = `/main/chat/${session.id}`;
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }, 500); // 500ms delay to ensure DB commit (increased for testing)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
        setIsLoading(false);
        submittingRef.current = false;
      });
  }, [inputValue, isLoading, consultType, isAnonymous, allowAnonymousResponses, targetUsers, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }, [handleSubmit]);

  // Input form component (memoized to prevent unnecessary re-renders)
  const inputForm = useMemo(() => (
    <>
      <div className="bg-base-200/50 rounded-2xl border border-base-300/50">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="相談してみましょう"
          className="w-full resize-none min-h-[5rem] px-4 pt-4 pb-2 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0"
          rows={1}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />

        {/* Footer with options and submit button */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-base-300/30">
          {/* Left side: Options */}
          <div className="flex items-center gap-1">
            {/* Three independent mode buttons */}
            <button
              type="button"
              className={`btn btn-xs gap-1 ${consultType === "PRIVATE" ? "btn-ghost border-base-content/20" : "btn-ghost opacity-50"}`}
              onClick={() => {
                setConsultType("PRIVATE");
                setIsAnonymous(false);
                setTargetUsers([]);
                setShowUserSearch(false);
              }}
              disabled={isLoading}
              aria-label="非公開相談"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
              <span className="text-xs">非公開</span>
            </button>

            <button
              type="button"
              className={`btn btn-xs gap-1 ${consultType === "PUBLIC" ? "btn-primary btn-outline" : "btn-ghost opacity-50"}`}
              onClick={() => {
                setConsultType("PUBLIC");
                setTargetUsers([]);
                setShowUserSearch(false);
              }}
              disabled={isLoading}
              aria-label="公開相談"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" />
              </svg>
              <span className="text-xs">公開</span>
            </button>

            <button
              type="button"
              className={`btn btn-xs gap-1 ${consultType === "DIRECTED" ? "btn-accent btn-outline" : "btn-ghost opacity-50"}`}
              onClick={() => {
                if (consultType === "DIRECTED") {
                  setShowUserSearch(!showUserSearch);
                } else {
                  setConsultType("DIRECTED");
                  setShowUserSearch(true);
                }
              }}
              disabled={isLoading}
              aria-label="指名相談"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M3 4a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm2.5 1a.5.5 0 00-.5.5v1.077l4.146 2.907a1.5 1.5 0 001.708 0L15 6.577V5.5a.5.5 0 00-.5-.5h-9zM15 8.077l-3.854 2.7a2.5 2.5 0 01-2.848-.056L4.5 8.077V13.5a.5.5 0 00.5.5h9.5a.5.5 0 00.5-.5V8.077z" />
              </svg>
              <span className="text-xs">指名{consultType === "DIRECTED" && targetUsers.length > 0 ? ` (${targetUsers.length})` : ""}</span>
            </button>

            {/* Anonymous/response options for PUBLIC and DIRECTED */}
            {(consultType === "PUBLIC" || consultType === "DIRECTED") && (
              <>
                <div className="w-px h-4 bg-base-300 mx-1" />
                {/* Anonymous toggle */}
                <button
                  type="button"
                  className={`btn btn-xs gap-1 ${
                    isAnonymous
                      ? "btn-secondary btn-outline"
                      : "btn-ghost opacity-60"
                  }`}
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  disabled={isLoading}
                  aria-label="匿名で相談"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM6 8.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs">匿名</span>
                </button>
                {/* Allow anonymous responses toggle */}
                <button
                  type="button"
                  className={`btn btn-xs gap-1 ${
                    !allowAnonymousResponses
                      ? "btn-warning btn-outline"
                      : "btn-ghost opacity-60"
                  }`}
                  onClick={() => setAllowAnonymousResponses(!allowAnonymousResponses)}
                  disabled={isLoading}
                  aria-label={allowAnonymousResponses ? "匿名回答を許可中" : "匿名回答を拒否中"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                  <span className="text-xs">{allowAnonymousResponses ? "匿名回答OK" : "匿名NG"}</span>
                </button>
              </>
            )}
          </div>

          {/* Right side: Submit button */}
          <button
            onClick={handleSubmit}
            className="btn btn-primary btn-circle btn-sm"
            disabled={isLoading || !inputValue.trim() || (consultType === "DIRECTED" && targetUsers.length === 0)}
            aria-label="送信"
          >
            {isLoading ? (
              <Suspense fallback={<span className="loading loading-spinner loading-xs" />}>
                <LoadingSpinner size="xs" inline />
              </Suspense>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {/* User search for DIRECTED mode */}
      {consultType === "DIRECTED" && showUserSearch && (
        <div className="mt-2 bg-base-200/50 rounded-xl border border-base-300/50 p-3">
          {/* Selected users chips */}
          {targetUsers.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {targetUsers.map((user) => (
                <span
                  key={user.handle}
                  className="badge badge-accent badge-sm gap-1"
                >
                  {user.displayName || user.handle}
                  <button
                    type="button"
                    onClick={() => removeTargetUser(user.handle)}
                    className="hover:text-error"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <input
            type="text"
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            placeholder="ユーザーを検索..."
            className="input input-sm input-bordered w-full"
          />

          {/* Search results */}
          {isSearching && (
            <div className="text-xs text-base-content/50 mt-1 px-1">検索中...</div>
          )}
          {userSearchResults.length > 0 && (
            <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto">
              {userSearchResults.map((user) => (
                <UserSearchListItem key={user.id} user={user} onAdd={addTargetUser} />
              ))}
            </ul>
          )}
        </div>
      )}
      {consultType === "DIRECTED" && targetUsers.length === 0 && (
        <p className="text-xs text-center text-warning mt-2">
          指名先を1人以上選択してください
        </p>
      )}
      <p className="text-xs text-center text-base-content/40 mt-2">
        Shift + Enter で改行
      </p>
    </>
  ), [
    inputValue,
    isLoading,
    consultType,
    isAnonymous,
    allowAnonymousResponses,
    targetUsers,
    showUserSearch,
    userSearchQuery,
    userSearchResults,
    isSearching,
    handleSubmit,
    handleKeyDown,
    addTargetUser,
    removeTargetUser
  ]);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Desktop: centered layout like ChatGPT/Claude */}
      <div className="hidden xl:flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <p className="text-base-content/50 text-lg text-center mb-6">
            今日はどうしましたか？
          </p>
          {inputForm}
          {error && (
            <div className="alert alert-error text-sm mt-4" role="alert" aria-live="polite">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: greeting at center, input at bottom for easier tapping */}
      <div className="xl:hidden flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-base-content/50 text-lg text-center">
            今日はどうしましたか？
          </p>
        </div>
        <div className="p-4 pt-0">
          <div className="max-w-2xl mx-auto">
            {inputForm}
            {error && (
              <div className="alert alert-error text-sm mt-4" role="alert" aria-live="polite">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
