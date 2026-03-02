export type ThemeMode = "pop" | "dark";

export const THEME_STORAGE_KEY = "musicite-theme";

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "pop" || value === "dark";
}

export function toThemeMode(value: string | null): ThemeMode | null {
  if (value === "light") {
    return "pop";
  }
  return isThemeMode(value) ? value : null;
}

export function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "pop";
  }

  const saved = toThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  if (saved) {
    return saved;
  }

  return "pop";
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = mode;
}
