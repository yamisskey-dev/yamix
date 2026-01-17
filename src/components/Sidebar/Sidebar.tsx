"use client";

import { useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChatSessionList } from "./ChatSessionList";
import { ConfirmModal } from "@/components/Modal";
import type { UserProfile } from "@/types";

interface Props {
  user?: UserProfile | null;
  onClose?: () => void;
}

export function Sidebar({ user, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutModalRef = useRef<HTMLDialogElement>(null);

  const handleNewChat = async () => {
    // Just navigate to /main for new chat
    router.push("/main");
    onClose?.();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.removeItem("yamix_handle");
      localStorage.removeItem("yamix_displayName");
      localStorage.removeItem("yamix_avatarUrl");
      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  const isTimelineActive = pathname === "/main/timeline";
  const isSettingsActive = pathname === "/main/settings";

  return (
    <div className="h-full flex flex-col bg-base-100">
      {/* Header with Logo */}
      <div className="p-3 border-b border-base-300">
        <Link href="/main" className="text-xl font-bold">
          Yamix
        </Link>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="btn btn-primary btn-block gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          新規相談
        </button>
      </div>

      {/* Chat Session List */}
      <div className="flex-1 overflow-y-auto px-2">
        <ChatSessionList onSessionSelect={onClose} />
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-base-300 p-2 space-y-1">
        <button
          onClick={() => {
            router.push("/main/timeline");
            onClose?.();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-base-200 ${
            isTimelineActive ? "bg-base-200 text-primary" : ""
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          タイムライン
        </button>

        <button
          onClick={() => {
            router.push("/main/settings");
            onClose?.();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-base-200 ${
            isSettingsActive ? "bg-base-200 text-primary" : ""
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          設定
        </button>
      </div>

      {/* User Profile & Logout */}
      {user && (
        <div className="border-t border-base-300 p-3">
          <div className="flex items-center gap-3">
            <div className="avatar">
              <div className="w-10 h-10 rounded-full">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.displayName || user.account}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="bg-primary text-primary-content flex items-center justify-center w-full h-full text-lg font-bold rounded-full">
                    {(user.displayName || user.account).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {user.displayName || user.account}
              </div>
              <div className="text-xs text-base-content/50 truncate">
                {user.handle}
              </div>
            </div>
            <button
              onClick={() => logoutModalRef.current?.showModal()}
              className="btn btn-ghost btn-sm btn-circle"
              title="ログアウト"
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        ref={logoutModalRef}
        title="ログアウト"
        body="ログアウトしますか？"
        confirmText="ログアウト"
        cancelText="キャンセル"
        onConfirm={handleLogout}
      />
    </div>
  );
}
