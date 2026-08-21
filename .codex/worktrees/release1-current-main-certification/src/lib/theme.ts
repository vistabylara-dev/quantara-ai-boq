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

/**
 * Always sets an explicit resolved value ("light"/"dark"), never removes the
 * attribute — Tailwind's attribute-based dark-mode strategy (configured for
 * the admin dashboard) needs a concrete value to match against, which a
 * missing attribute can't provide. The saved preference in localStorage
 * still records "system" untouched; only the applied DOM attribute is ever
 * the resolved value.
 */
export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", resolveTheme(mode));
}

/**
 * Registers live reactivity for system mode: when the OS preference changes
 * while the saved mode is "system", re-resolves and re-applies the
 * attribute. Returns an unsubscribe function. No-op outside the browser.
 */
export function watchSystemThemeChanges(getCurrentMode: () => ThemeMode): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    if (getCurrentMode() === "system") {
      applyThemeMode("system");
    }
  };
  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
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
    // Matches getSavedThemeMode()'s and THEME_INIT_SCRIPT's own default —
    // light is the policy for a visitor with no resolvable preference
    // (including no window to read prefers-color-scheme from), not dark.
    if (typeof window === "undefined") {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}
