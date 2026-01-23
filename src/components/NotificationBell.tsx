"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  type: "RESPONSE" | "MENTION" | "GAS_RECEIVED" | "SYSTEM";
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 通知を取得
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data: NotificationResponse = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // 初回ロード
  useEffect(() => {
    fetchNotifications();
    // 30秒ごとに自動更新
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 通知を既読にする
  const markAsRead = async (notificationIds: string[]) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });

      if (res.ok) {
        // ローカル状態を更新
        setNotifications((prev) =>
          prev.map((n) => (notificationIds.includes(n.id) ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  // 全て既読にする
  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  // 通知クリック時
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead([notification.id]);
    }
    setIsOpen(false);
  };

  // アイコンの種類
  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "RESPONSE":
        return "💬";
      case "MENTION":
        return "📣";
      case "GAS_RECEIVED":
        return "🕯️";
      case "SYSTEM":
        return "ℹ️";
      default:
        return "🔔";
    }
  };

  // 相対時間表示
  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "たった今";
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString("ja-JP");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ベルアイコン */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications(); // 開く時に最新化
        }}
        className="btn btn-ghost btn-circle relative"
        aria-label="通知"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {/* 未読バッジ */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-error"></span>
          </span>
        )}
      </button>

      {/* ドロップダウン */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-base-100 rounded-lg shadow-xl border border-base-300 z-50 max-h-[32rem] flex flex-col">
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-3 border-b border-base-300">
            <span className="font-bold text-sm">通知</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline"
              >
                全て既読にする
              </button>
            )}
          </div>

          {/* 通知リスト */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <span className="loading loading-spinner loading-sm"></span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center p-8 text-base-content/50 text-sm">
                通知はありません
              </div>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id}>
                  {notification.linkUrl ? (
                    <Link
                      href={notification.linkUrl}
                      onClick={() => handleNotificationClick(notification)}
                      className={`block px-4 py-3 hover:bg-base-200 transition-colors border-b border-base-300 ${
                        !notification.isRead ? "bg-primary/5" : ""
                      }`}
                    >
                      <NotificationItem notification={notification} getIcon={getNotificationIcon} getTime={getRelativeTime} />
                    </Link>
                  ) : (
                    <div
                      onClick={() => handleNotificationClick(notification)}
                      className={`block px-4 py-3 cursor-pointer hover:bg-base-200 transition-colors border-b border-base-300 ${
                        !notification.isRead ? "bg-primary/5" : ""
                      }`}
                    >
                      <NotificationItem notification={notification} getIcon={getNotificationIcon} getTime={getRelativeTime} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 通知アイテムコンポーネント
function NotificationItem({
  notification,
  getIcon,
  getTime,
}: {
  notification: Notification;
  getIcon: (type: Notification["type"]) => string;
  getTime: (date: string) => string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-2xl flex-shrink-0">{getIcon(notification.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{notification.title}</p>
          {!notification.isRead && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
          )}
        </div>
        <p className="text-xs text-base-content/70 line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-base-content/50 mt-1">{getTime(notification.createdAt)}</p>
      </div>
    </div>
  );
}
