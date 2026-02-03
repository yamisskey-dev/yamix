"use client";

import { useEffect, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * MobileDrawer - アクセシブルなモバイルドロワー
 * - ESCキーで閉じる
 * - オーバーレイクリックで閉じる
 * - フォーカストラップ
 * - スムーズなアニメーション
 */
export function MobileDrawer({ isOpen, onClose, children }: MobileDrawerProps) {
  // ESCキーで閉じる
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // スクロールロック
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // SSR対応
  if (typeof window === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
    >
      {/* Overlay - Enhanced with blur */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-strong transition-opacity duration-300 ease-smooth ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel - Enhanced with glassmorphism and animation */}
      <div
        className={`absolute left-0 top-0 h-full w-60 glass-card-enhanced shadow-elevated transition-all duration-300 ease-smooth ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

// ============================================
// Navigation Icons
// ============================================

interface NavIconProps {
  className?: string;
}

export function MenuIcon({ className = "h-6 w-6" }: NavIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

export function ChatIcon({ className = "h-6 w-6" }: NavIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

export function TimelineIcon({ className = "h-6 w-6" }: NavIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
      />
    </svg>
  );
}

export function SettingsIcon({ className = "h-6 w-6" }: NavIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
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
  );
}

// ============================================
// Notification Icon
// ============================================

export function NotificationIcon({ className = "h-6 w-6" }: NavIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}

// ============================================
// Mobile Bottom Navigation
// ============================================

interface BottomNavProps {
  pathname: string | null;
  onMenuClick: () => void;
  onNavigate: (path: string) => void;
  unreadNotificationCount?: number;
}

export function MobileBottomNav({ pathname, onMenuClick, onNavigate, unreadNotificationCount = 0 }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-base-100/95 backdrop-blur-medium border-t border-base-300 flex items-center justify-around px-2 z-40 shadow-soft">
      {/* Menu (Burger) Button */}
      <button
        onClick={onMenuClick}
        className="flex flex-col items-center justify-center w-12 h-12 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 text-base-content/60 hover:bg-primary/10 hover:text-primary"
        aria-label="メニューを開く"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {/* Timeline Button */}
      <button
        onClick={() => onNavigate("/main/timeline")}
        className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 ${
          pathname === "/main/timeline"
            ? "text-primary bg-primary/10"
            : "text-base-content/60 hover:bg-primary/10 hover:text-primary"
        }`}
        aria-label="タイムライン"
      >
        <TimelineIcon className="h-5 w-5" />
      </button>

      {/* Notification Button */}
      <button
        onClick={() => onNavigate("/main/notifications")}
        className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 ${
          pathname === "/main/notifications"
            ? "text-primary bg-primary/10"
            : "text-base-content/60 hover:bg-primary/10 hover:text-primary"
        }`}
        aria-label={`通知${unreadNotificationCount > 0 ? `（${unreadNotificationCount}件の未読）` : ""}`}
      >
        <NotificationIcon className="h-5 w-5" />
        {unreadNotificationCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error"></span>
          </span>
        )}
      </button>

      {/* New Consultation Button (Right, Gradient) */}
      <button
        onClick={() => onNavigate("/main")}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-primary to-secondary text-primary-content hover:brightness-110 transition-all duration-150 ease-smooth focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 shadow-soft"
        aria-label="新しい相談"
      >
        <ChatIcon className="h-5 w-5" />
      </button>
    </nav>
  );
}
