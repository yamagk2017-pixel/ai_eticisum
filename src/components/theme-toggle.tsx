"use client";

import { useEffect, useState } from "react";
import { applyThemeMode, getInitialThemeMode, THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme/mode";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialThemeMode());

  useEffect(() => {
    applyThemeMode(theme);
  }, [theme]);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "pop" : "dark";
    setTheme(next);
    applyThemeMode(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "pop" : "dark"} mode`}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 text-xs font-medium text-[var(--ui-text)] hover:bg-[var(--ui-panel-soft)]"
    >
      <span className="text-[10px] text-[var(--ui-text-subtle)]">
        {theme === "dark" ? "Dark" : "Pop"}
      </span>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ui-accent)] text-[10px] text-[var(--ui-accent-contrast)]">
        {theme === "dark" ? "D" : "P"}
      </span>
    </button>
  );
}
