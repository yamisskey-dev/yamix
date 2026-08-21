"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

type Theme = "dark" | "light";
type ThemePreference = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function getSavedPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem(
    "yamix_theme_preference"
  ) as ThemePreference | null;
  return saved && ["dark", "light", "system"].includes(saved) ? saved : "system";
}

// SSR では false、クライアントでは true（マウント検知。setState 不要）
const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getSavedPreference);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = getSavedPreference();
    return saved === "system" ? getSystemTheme() : saved;
  });
  const mounted = useMounted();

  // data-theme 属性を theme に追随させる
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Listen to system theme changes when preference is "system"
  useEffect(() => {
    if (!mounted || preference !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "light" : "dark");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mounted, preference]);

  const setPreference = (newPreference: ThemePreference) => {
    setPreferenceState(newPreference);
    localStorage.setItem("yamix_theme_preference", newPreference);
    setTheme(newPreference === "system" ? getSystemTheme() : newPreference);
  };

  // Prevent flash of wrong theme
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
