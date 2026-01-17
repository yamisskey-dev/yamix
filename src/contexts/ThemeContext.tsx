"use client";

import { createContext, useContext, useEffect, useState } from "react";

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    const savedPreference = localStorage.getItem(
      "yamix_theme_preference"
    ) as ThemePreference | null;

    if (
      savedPreference &&
      ["dark", "light", "system"].includes(savedPreference)
    ) {
      setPreferenceState(savedPreference);
      const resolvedTheme =
        savedPreference === "system" ? getSystemTheme() : savedPreference;
      setTheme(resolvedTheme);
      document.documentElement.setAttribute("data-theme", resolvedTheme);
    } else {
      // Default to system
      const systemTheme = getSystemTheme();
      setTheme(systemTheme);
      document.documentElement.setAttribute("data-theme", systemTheme);
    }
    setMounted(true);
  }, []);

  // Listen to system theme changes when preference is "system"
  useEffect(() => {
    if (!mounted || preference !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "light" : "dark";
      setTheme(newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mounted, preference]);

  const setPreference = (newPreference: ThemePreference) => {
    setPreferenceState(newPreference);
    localStorage.setItem("yamix_theme_preference", newPreference);

    const resolvedTheme =
      newPreference === "system" ? getSystemTheme() : newPreference;
    setTheme(resolvedTheme);
    document.documentElement.setAttribute("data-theme", resolvedTheme);
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
