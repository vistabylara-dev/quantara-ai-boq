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

  beforeEach(() => {
    documentElement = createDocumentElementMock();
    vi.stubGlobal("window", {
      localStorage: createLocalStorageMock(),
      matchMedia: (query: string) => ({ matches: query.includes("dark") }),
    });
    vi.stubGlobal("document", { documentElement });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to system when nothing is saved", () => {
    expect(getSavedThemeMode()).toBe("system");
  });

  it("falls back to system for an invalid stored value", () => {
    window.localStorage.setItem(THEME_MODE_KEY, "purple-haze");
    expect(getSavedThemeMode()).toBe("system");
  });

  it("saves and reloads a valid mode", () => {
    saveThemeMode("dark");
    expect(getSavedThemeMode()).toBe("dark");
    expect(documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("removes the data-theme attribute for system mode instead of setting it", () => {
    saveThemeMode("dark");
    applyThemeMode("system");
    expect(documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("resolves system mode against the OS color-scheme preference", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("system")).toBe("dark");
  });
});
