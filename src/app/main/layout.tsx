"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback, ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileDrawer, MobileBottomNav } from "@/components/MobileDrawer";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { UserContext } from "@/contexts/UserContext";
import { BookmarkProvider } from "@/contexts/BookmarkContext";
import { authApi } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import { clientLogger } from "@/lib/client-logger";
import { initializeMasterKey } from "@/lib/client-encryption";
import type { UserProfile } from "@/types";

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMasterKeyReady, setIsMasterKeyReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarWidth');
      return saved ? parseInt(saved, 10) : 288;
    }
    return 288;
  });
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const fetchUser = useCallback(async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);

      // E2EE マスター鍵を初期化
      try {
        await initializeMasterKey(userData.handle);
        clientLogger.info('[E2EE] Master key initialized successfully');
        setIsMasterKeyReady(true);
      } catch (e2eeError) {
        clientLogger.error('[E2EE] Failed to initialize master key:', e2eeError);
        // E2EE初期化失敗はアプリの使用を妨げない（暗号化なしで続行）
        setIsMasterKeyReady(true); // エラーでも続行可能とマーク
      }
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

  // Save sidebar state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarWidth', sidebarWidth.toString());
    }
  }, [sidebarWidth]);

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
        clientLogger.error("Failed to fetch unread count:", error);
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

  const handleToggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev: boolean) => !prev);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + diff)); // Min: 200px, Max: 500px
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, loading, refetch: fetchUser, isMasterKeyReady }}>
    <BookmarkProvider>
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        メインコンテンツにスキップ
      </a>

      {/* Desktop Layout - サイドバー + メインコンテンツ */}
      <div className="hidden xl:flex h-screen">
        {/* Fixed Sidebar */}
        <aside
          className="h-screen flex-shrink-0 border-r border-base-300 bg-base-300/80 transition-all duration-300 ease-smooth relative"
          style={{ width: sidebarCollapsed ? "64px" : `${sidebarWidth}px` }}
          role="navigation"
          aria-label="メインナビゲーション"
        >
          <Sidebar
            user={user}
            unreadNotificationCount={unreadNotificationCount}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleSidebarCollapse}
          />
          {/* Resize handle */}
          {!sidebarCollapsed && (
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors duration-150"
              aria-label="サイドバーの幅を変更"
            />
          )}
        </aside>

        {/* Main Content */}
        <main id="main-content" className="flex-1 h-screen overflow-hidden flex flex-col" role="main">
          {children}
        </main>
      </div>

      {/* Mobile/Tablet Layout - ボトムナビ + ドロワー */}
      <div className="xl:hidden flex flex-col h-screen">
        <main id="main-content-mobile" className="flex-1 flex flex-col pb-14 overflow-hidden" role="main">{children}</main>

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
    </BookmarkProvider>
    </UserContext.Provider>
  );
}
