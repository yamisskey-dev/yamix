"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback, ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileDrawer, MobileBottomNav } from "@/components/MobileDrawer";
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
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, loading, refetch: fetchUser }}>
      {/* Desktop Layout - サイドバー + メインコンテンツ */}
      <div className="hidden xl:flex h-screen">
        {/* Fixed Sidebar */}
        <aside className="w-60 h-screen flex-shrink-0 border-r border-base-300 bg-base-100">
          <Sidebar user={user} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 h-screen overflow-hidden flex flex-col">
          {children}
        </main>
      </div>

      {/* Mobile/Tablet Layout - ボトムナビ + ドロワー */}
      <div className="xl:hidden flex flex-col min-h-screen">
        <main className="flex-1 flex flex-col pb-14">{children}</main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav
          pathname={pathname}
          onMenuClick={handleOpenDrawer}
          onNavigate={handleNavigate}
        />

        {/* Mobile Drawer */}
        <MobileDrawer isOpen={sidebarOpen} onClose={handleCloseDrawer}>
          <Sidebar user={user} onClose={handleCloseDrawer} />
        </MobileDrawer>
      </div>
    </UserContext.Provider>
  );
}
