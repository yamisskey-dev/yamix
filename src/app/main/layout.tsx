"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback, ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileDrawer, MobileBottomNav } from "@/components/MobileDrawer";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { UserContext } from "@/contexts/UserContext";
import { authApi } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import type { UserProfile } from "@/types";

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const fetchUser = useCallback(async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (error) {
      logger.warn("Failed to fetch user, redirecting to login", {}, error);
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // 未読通知カウントを取得
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch("/api/notifications?limit=1");
        if (res.ok) {
          const data = await res.json();
          setUnreadNotificationCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // パスが変わったらドロワーを閉じる
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  const handleCloseDrawer = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleOpenDrawer = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, loading, refetch: fetchUser }}>
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        メインコンテンツにスキップ
      </a>

      {/* Desktop Layout - サイドバー + メインコンテンツ */}
      <div className="hidden xl:flex h-screen">
        {/* Fixed Sidebar */}
        <aside className="w-64 h-screen flex-shrink-0 border-r border-base-300 bg-base-300/80" role="navigation" aria-label="メインナビゲーション">
          <Sidebar user={user} unreadNotificationCount={unreadNotificationCount} />
        </aside>

        {/* Main Content */}
        <main id="main-content" className="flex-1 h-screen overflow-hidden flex flex-col" role="main">
          {children}
        </main>
      </div>

      {/* Mobile/Tablet Layout - ボトムナビ + ドロワー */}
      <div className="xl:hidden flex flex-col min-h-screen">
        <main id="main-content-mobile" className="flex-1 flex flex-col pb-14" role="main">{children}</main>

        {/* Mobile Bottom Navigation */}
        <nav aria-label="モバイルナビゲーション">
          <MobileBottomNav
            pathname={pathname}
            onMenuClick={handleOpenDrawer}
            onNavigate={handleNavigate}
            unreadNotificationCount={unreadNotificationCount}
          />
        </nav>

        {/* Mobile Drawer */}
        <MobileDrawer isOpen={sidebarOpen} onClose={handleCloseDrawer}>
          <nav aria-label="メインナビゲーション" className="h-full">
            <Sidebar user={user} onClose={handleCloseDrawer} unreadNotificationCount={unreadNotificationCount} />
          </nav>
        </MobileDrawer>
      </div>
    </UserContext.Provider>
  );
}
