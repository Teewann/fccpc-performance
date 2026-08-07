// src/components/theme/ThemeProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

// This defines what our theme system can do
type Theme = "dark" | "light";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

// Create a "container" that any component can tap into
const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

// This is the hook your components will use: const { theme, toggleTheme } = useTheme()
export function useTheme() {
  return useContext(ThemeContext);
}

// This wraps your whole app and manages the theme
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // When the app first loads, check if the user had a saved preference
  useEffect(() => {
    const saved = localStorage.getItem("fccpc-theme") as Theme | null;
    const initial = saved || "dark"; // Default is always dark
    setTheme(initial);
    applyTheme(initial);
  }, []);

  // This function actually switches the CSS class on the <html> element
  function applyTheme(t: Theme) {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("fccpc-theme", next); // Remember the choice
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
