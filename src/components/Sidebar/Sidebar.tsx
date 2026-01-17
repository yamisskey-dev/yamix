"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChatSessionList } from "./ChatSessionList";
import type { UserProfile } from "@/types";

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
    <div className="px-3 mb-2">
      <button
        onClick={onClick}
        className={`
          group relative w-full h-11 rounded-full
          flex items-center justify-center gap-2
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

  const handleNewChat = async () => {
    router.push("/main");
    onClose?.();
  };

  const isTimelineActive = pathname === "/main/timeline";

  return (
    <div className="h-full flex flex-col bg-base-100">
      {/* Header - Instance icon */}
      <div className="sticky top-0 z-10 pt-4 pb-4 flex items-center justify-center">
        <Link
          href="/main"
          onClick={onClose}
          className="flex items-center justify-center hover:opacity-80 transition-opacity"
        >
          <Image
            src="/icon.svg"
            alt="やみっくす"
            width={36}
            height={36}
            className="rounded-lg"
          />
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto">
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

        {/* Divider */}
        <div className="mx-4 my-3 border-t border-base-content/10" />

        {/* Chat Session List */}
        <div className="px-2">
          <ChatSessionList onSessionSelect={onClose} />
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto pt-3 pb-3 bg-base-100 border-t border-base-content/10">
        {/* Post Button */}
        <div className="px-3 mb-3">
          <button
            onClick={handleNewChat}
            className="
              w-full h-11 rounded-full
              bg-gradient-to-r from-primary to-secondary
              text-primary-content text-sm font-medium
              flex items-center justify-center gap-2
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
              router.push("/main/settings");
              onClose?.();
            }}
            className="
              flex items-center w-full
              py-2.5 px-3
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
