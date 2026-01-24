"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChatSessionList } from "./ChatSessionList";
import { NotificationBell } from "@/components/NotificationBell";
import type { UserProfile } from "@/types";
import { encodeHandle } from "@/lib/encode-handle";

interface Props {
  user?: UserProfile | null;
  onClose?: () => void;
}

// Misskey-style navigation item component
function NavItem({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="px-4 mb-2">
      <button
        onClick={onClick}
        className={`
          group relative w-full h-11 rounded-full px-4
          flex items-center gap-3
          transition-colors duration-150
          ${isActive ? "bg-primary/10 text-primary" : "text-base-content/70 hover:bg-primary/10 hover:text-primary"}
        `}
      >
        <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </button>
    </div>
  );
}

export function Sidebar({ user, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  const handleNewChat = async () => {
    router.push("/main");
    onClose?.();
  };

  const isTimelineActive = pathname === "/main/timeline";

  return (
    <div className="h-full flex flex-col bg-base-100">
      {/* Header - Instance icon + Notification */}
      <div className="sticky top-0 z-10 pt-4 pb-4 flex items-center justify-center gap-24 px-2">
        <Link
          href="/main/about"
          onClick={onClose}
          className="flex items-center justify-center hover:opacity-80 transition-opacity"
        >
          <img
            src="/app-icon.png"
            alt="やみっくす"
            width={36}
            height={36}
            className="rounded-lg"
          />
        </Link>
        <NotificationBell />
      </div>

      {/* Navigation Items - Fixed */}
      <nav className="flex-shrink-0">
        <NavItem
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
          }
          label="タイムライン"
          isActive={isTimelineActive}
          onClick={() => {
            router.push("/main/timeline");
            onClose?.();
          }}
        />

        <NavItem
          icon={
            <span className="text-lg font-bold">#</span>
          }
          label="見つける"
          isActive={pathname === "/main/explore"}
          onClick={() => {
            router.push("/main/explore");
            onClose?.();
          }}
        />

        <NavItem
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
          label="設定"
          isActive={pathname === "/main/settings"}
          onClick={() => {
            router.push("/main/settings");
            onClose?.();
          }}
        />
      </nav>

      {/* Divider */}
      <div className="mx-5 my-3 border-t border-base-content/10 flex-shrink-0" />

      {/* Search input - Fixed */}
      <div className="px-5 pb-2 flex-shrink-0">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="検索..."
            className="input input-sm w-full pl-9 pr-8 bg-base-200/50 border-none focus:bg-base-200 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
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
          )}
        </div>
      </div>

      {/* Chat Session List - Scrollable (includes bookmarks) */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3">
        <ChatSessionList onSessionSelect={onClose} searchQuery={searchQuery} />
      </div>

      {/* Bottom Section */}
      <div className="mt-auto pt-3 pb-3 bg-base-100 border-t border-base-content/10">
        {/* Post Button */}
        <div className="px-4 mb-3">
          <button
            onClick={handleNewChat}
            className="
              w-full h-11 rounded-full px-4
              bg-gradient-to-r from-primary to-secondary
              text-primary-content text-sm font-medium
              flex items-center gap-3
              hover:brightness-110
              transition-all duration-150
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>新しい相談</span>
          </button>
        </div>

        {/* Account Section */}
        {user && (
          <button
            onClick={() => {
              router.push(`/main/user/${encodeHandle(user.handle)}`);
              onClose?.();
            }}
            className="
              flex items-center w-full
              py-2.5 px-4
              text-left
              hover:bg-base-content/5
              transition-colors duration-150
            "
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.displayName || user.account}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-content text-sm font-bold">
                  {(user.displayName || user.account).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* User info */}
            <div className="flex-1 min-w-0 ml-2.5 truncate">
              <span className="text-sm text-base-content">
                @{user.account}@{user.hostName}
              </span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
