import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_MODE_KEY,
  applyThemeMode,
  getSavedThemeMode,
  resolveTheme,
  saveThemeMode,
} from "../src/lib/theme";

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

function createDocumentElementMock() {
  const attributes = new Map<string, string>();
  return {
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
    getAttribute: (name: string) => attributes.get(name) ?? null,
  };
}

describe("theme mode persistence", () => {
  let documentElement: ReturnType<typeof createDocumentElementMock>;
  let prefersDark: boolean;

  beforeEach(() => {
    documentElement = createDocumentElementMock();
    prefersDark = true;
    vi.stubGlobal("window", {
      localStorage: createLocalStorageMock(),
      matchMedia: (query: string) => ({ matches: query.includes("dark") && prefersDark }),
    });
    vi.stubGlobal("document", { documentElement });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to light when nothing is saved (first-time visitor)", () => {
    expect(getSavedThemeMode()).toBe("light");
  });

  it("falls back to light for an invalid stored value", () => {
    window.localStorage.setItem(THEME_MODE_KEY, "purple-haze");
    expect(getSavedThemeMode()).toBe("light");
  });

  it("saves and reloads a saved light preference, applying the attribute", () => {
    saveThemeMode("light");
    expect(getSavedThemeMode()).toBe("light");
    expect(documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("saves and reloads a saved dark preference, applying the attribute", () => {
    saveThemeMode("dark");
    expect(getSavedThemeMode()).toBe("dark");
    expect(documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("removes the data-theme attribute for system mode instead of setting it", () => {
    saveThemeMode("dark");
    applyThemeMode("system");
    expect(documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("keeps the persisted value literally 'system', never a resolved light/dark value", () => {
    saveThemeMode("system");
    expect(window.localStorage.getItem(THEME_MODE_KEY)).toBe("system");
    expect(getSavedThemeMode()).toBe("system");
  });

  it("resolves saved system mode against the OS preference: OS dark -> dark", () => {
    prefersDark = true;
    expect(resolveTheme("system")).toBe("dark");
  });

  it("resolves saved system mode against the OS preference: OS light -> light", () => {
    prefersDark = false;
    expect(resolveTheme("system")).toBe("light");
  });

  it("resolves explicit light/dark regardless of OS preference", () => {
    prefersDark = false;
    expect(resolveTheme("dark")).toBe("dark");
    prefersDark = true;
    expect(resolveTheme("light")).toBe("light");
  });

  it("re-resolves system mode live when the OS preference changes (no stale value)", () => {
    prefersDark = true;
    expect(resolveTheme("system")).toBe("dark");
    prefersDark = false;
    expect(resolveTheme("system")).toBe("light");
  });

  it("restores the saved selection after a simulated refresh (fresh read)", () => {
    saveThemeMode("dark");
    // Simulate a refresh: a brand-new call reading only from storage, not
    // from any in-memory state.
    expect(getSavedThemeMode()).toBe("dark");
  });
});

describe("root layout theme initialization (source-level regression guard)", () => {
  const layoutSource = readFileSync(
    path.resolve(__dirname, "../src/app/layout.tsx"),
    "utf8",
  );

  it("no longer hardcodes a dark-only body class", () => {
    expect(layoutSource).not.toMatch(/className=["'`][^"'`]*bg-\[#07111F\]/);
  });

  it("applies the theme attribute before hydration via an inline script", () => {
    expect(layoutSource).toMatch(/dangerouslySetInnerHTML/);
    expect(layoutSource).toMatch(/data-theme/);
  });
});
