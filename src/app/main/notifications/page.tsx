"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { clientLogger } from "@/lib/client-logger";

interface Notification {
  id: string;
  type: "RESPONSE" | "MENTION" | "GAS_RECEIVED" | "SYSTEM";
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch (error) {
      clientLogger.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationIds: string[]) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (notificationIds.includes(n.id) ? { ...n, isRead: true } : n))
        );
      }
    } catch (error) {
      clientLogger.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (error) {
      clientLogger.error("Failed to mark all as read:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead([notification.id]);
    }
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "RESPONSE":
        return (
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-primary">
              <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case "MENTION":
        return (
          <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-accent">
              <path d="M3 4a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm2.5 1a.5.5 0 00-.5.5v1.077l4.146 2.907a1.5 1.5 0 001.708 0L15 6.577V5.5a.5.5 0 00-.5-.5h-9zM15 8.077l-3.854 2.7a2.5 2.5 0 01-2.848-.056L4.5 8.077V13.5a.5.5 0 00.5.5h9.5a.5.5 0 00.5-.5V8.077z" />
            </svg>
          </div>
        );
      case "GAS_RECEIVED":
        return (
          <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-500">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
          </div>
        );
      case "SYSTEM":
        return (
          <div className="w-9 h-9 rounded-full bg-info/15 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-info">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const renderNotificationCard = (notification: Notification) => {
    const content = (
      <div
        className={`flex items-start gap-3 p-4 transition-colors ${
          !notification.isRead ? "bg-primary/5" : ""
        } ${notification.linkUrl ? "hover:bg-base-200/50 cursor-pointer" : ""}`}
      >
        {getNotificationIcon(notification.type)}
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed ${!notification.isRead ? "font-medium" : "text-base-content/80"}`}>
            {notification.message}
          </p>
          <p className="text-xs text-base-content/40 mt-1">{getRelativeTime(notification.createdAt)}</p>
        </div>
        {!notification.isRead && (
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
        )}
      </div>
    );

    if (notification.linkUrl) {
      return (
        <Link
          key={notification.id}
          href={notification.linkUrl}
          onClick={() => handleNotificationClick(notification)}
          className="block"
        >
          {content}
        </Link>
      );
    }

    return <div key={notification.id}>{content}</div>;
  };

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-base-content/30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
            </div>
            <p className="text-base-content/50 text-sm">
              通知はありません
            </p>
          </div>
        ) : (
          <div className="bg-base-100/50 backdrop-blur-sm rounded-xl border border-base-content/10 overflow-hidden divide-y divide-base-content/5">
            {notifications.map(renderNotificationCard)}
          </div>
        )}
      </div>
    </div>
  );
}
