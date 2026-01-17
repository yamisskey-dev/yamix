"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import type { UserProfile } from "@/types";

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refetch: async () => {},
});

export function useUser() {
  return useContext(UserContext);
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.replace("/");
        return;
      }
      const userData = await res.json();
      setUser(userData);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      router.replace("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
      <div className="hidden desktop:flex h-screen">
        {/* Fixed Sidebar */}
        <aside className="w-72 h-screen flex-shrink-0 border-r border-base-300 bg-base-100">
          <Sidebar user={user} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 h-screen overflow-hidden flex flex-col">
          {children}
        </main>
      </div>

      {/* Mobile Layout - ボトムナビ + ドロワー */}
      <div className="desktop:hidden">
        <div className="drawer">
          <input
            id="mobile-drawer"
            type="checkbox"
            className="drawer-toggle"
            checked={sidebarOpen}
            onChange={(e) => setSidebarOpen(e.target.checked)}
          />

          <div className="drawer-content flex flex-col min-h-screen">
            <main className="flex-1 flex flex-col pb-16">{children}</main>

            {/* Mobile Bottom Navigation */}
            <nav className="btm-nav btm-nav-sm bg-base-100 border-t border-base-300">
              {/* メニュー（サイドバー開く） */}
              <button
                onClick={() => setSidebarOpen(true)}
                className=""
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
                <span className="btm-nav-label text-xs">メニュー</span>
              </button>
              {/* 相談 */}
              <button
                onClick={() => router.push("/main")}
                className={pathname === "/main" || pathname?.startsWith("/main/chat") ? "text-primary active" : ""}
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span className="btm-nav-label text-xs">相談</span>
              </button>
              {/* タイムライン */}
              <button
                onClick={() => router.push("/main/timeline")}
                className={pathname === "/main/timeline" ? "text-primary active" : ""}
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
                <span className="btm-nav-label text-xs">TL</span>
              </button>
              {/* 設定 */}
              <button
                onClick={() => router.push("/main/settings")}
                className={pathname === "/main/settings" ? "text-primary active" : ""}
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
                <span className="btm-nav-label text-xs">設定</span>
              </button>
            </nav>
          </div>

          {/* Mobile Drawer */}
          <div className="drawer-side z-50">
            <label htmlFor="mobile-drawer" className="drawer-overlay" />
            <div className="w-72 min-h-full bg-base-100">
              <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        </div>
      </div>
    </UserContext.Provider>
  );
}
