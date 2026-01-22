"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ConfirmModal } from "./Modal";
import { WalletBadge } from "./WalletBadge";
import type { UserProfile } from "@/types";

interface HeaderProps {
  user?: UserProfile | null;
  onMenuClick?: () => void;
}

export function Header({ user, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutModalRef = useRef<HTMLDialogElement>(null);

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

  return (
    <header className="navbar bg-base-100/80 backdrop-blur-md border-b border-base-300 sticky top-0 z-50">
      <div className="flex-none lg:hidden">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="btn btn-square btn-ghost"
            aria-label="メニューを開く"
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
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
      </div>
      <div className="flex-1">
        <Link href="/main" className="btn btn-ghost text-xl font-bold">
          Yamix
        </Link>
      </div>

      <div className="flex-none gap-2">
        {user && (
          <>
            <WalletBadge />
            <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-circle avatar"
            >
              <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.displayName || user.account}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="bg-primary text-primary-content flex items-center justify-center w-full h-full text-lg font-bold">
                    {(user.displayName || user.account).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-52"
            >
              <li className="menu-title">
                <span className="text-xs text-base-content/50 truncate">
                  {user.handle}
                </span>
              </li>
              <li>
                <Link href="/main" className="justify-between">
                  相談
                  <span className="badge badge-primary badge-sm">Chat</span>
                </Link>
              </li>
              <li>
                <Link href="/main/history">履歴</Link>
              </li>
              <li>
                <Link href="/main/settings">設定</Link>
              </li>
              <div className="divider my-1" />
              <li>
                <button
                  onClick={() => logoutModalRef.current?.showModal()}
                  className="text-error"
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "ログアウト"
                  )}
                </button>
              </li>
            </ul>
          </div>
          </>
        )}
      </div>

      <ConfirmModal
        ref={logoutModalRef}
        title="ログアウト"
        body="ログアウトしますか？"
        confirmText="ログアウト"
        cancelText="キャンセル"
        onConfirm={handleLogout}
      />
    </header>
  );
}
