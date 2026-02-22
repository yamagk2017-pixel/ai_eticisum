"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "musicite-theme";

function getPreferredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = getPreferredTheme();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
    setReady(true);
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 text-xs font-medium text-[var(--ui-text)] hover:bg-[var(--ui-panel-soft)]"
      disabled={!ready}
    >
      <span className="text-[10px] text-[var(--ui-text-subtle)]">
        {theme === "dark" ? "Dark" : "Light"}
      </span>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ui-accent)] text-[10px] text-[var(--ui-accent-contrast)]">
        {theme === "dark" ? "D" : "L"}
      </span>
    </button>
  );
}
