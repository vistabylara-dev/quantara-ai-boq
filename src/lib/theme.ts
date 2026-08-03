export type ThemeMode = "light" | "dark" | "system";
export const THEME_MODE_KEY = "quantara-theme-mode";

/** Light is the default for a first-time visitor with no saved preference. */
export function getSavedThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(THEME_MODE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "light";
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const html = document.documentElement;
  if (mode === "system") {
    html.removeAttribute("data-theme");
    return;
  }

  html.setAttribute("data-theme", mode);
}

export function saveThemeMode(mode: ThemeMode): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_MODE_KEY, mode);
  applyThemeMode(mode);
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window === "undefined") {
      return "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}
