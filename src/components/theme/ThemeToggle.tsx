// src/components/theme/ThemeToggle.tsx
"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="
        flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
        transition-all duration-200
        text-[var(--text-muted)] hover:text-[var(--text-primary)]
        hover:bg-[var(--bg-hover)]
        border border-transparent hover:border-[var(--border)]
      "
    >
      {theme === "dark" ? (
        <>
          <Sun size={16} className="text-yellow-400" />
          <span>Light Mode</span>
        </>
      ) : (
        <>
          <Moon size={16} className="text-blue-400" />
          <span>Dark Mode</span>
        </>
      )}
    </button>
  );
}