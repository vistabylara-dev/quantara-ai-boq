import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRUSTED_PUBLIC_PRICE_CODES,
  buildLoginPricingHref,
  buildRegisterPricingHref,
  buildSubscriptionPricingHref,
  clearPendingPricingIntent,
  isTrustedPublicPriceCode,
  normalizePublicPriceCode,
  normalizeSafeInternalPath,
  readPendingPricingIntent,
  storePendingPricingIntent,
} from "../src/lib/commercial/pricing-intent";

const repoRoot = process.cwd();
const STORAGE_KEY = "quantara:pending-pricing-intent:v1";

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

describe("trusted public price code allowlist", () => {
  it("accepts exactly the nine approved codes", () => {
    expect(TRUSTED_PUBLIC_PRICE_CODES).toHaveLength(9);
    for (const code of TRUSTED_PUBLIC_PRICE_CODES) {
      expect(isTrustedPublicPriceCode(code)).toBe(true);
      expect(normalizePublicPriceCode(code)).toBe(code);
    }
  });

  it("rejects everything not on the exact allowlist", () => {
    const rejected: unknown[] = [
      "professional_monthly_aed_400",
      "professional_monthly",
      "enterprise_core_annual_aed_14999",
      "enterprise_core_monthly_aed_15000",
      "enterprise_scale_annual_aed_25001",
      "enterprise_authority",
      "price_enterprise_authority",
      "starter",
      "AED399",
      "price_123",
      "prod_123",
      "https://evil.example",
      "",
      null,
      undefined,
    ];
    for (const value of rejected) {
      expect(isTrustedPublicPriceCode(value)).toBe(false);
      expect(normalizePublicPriceCode(value)).toBeNull();
    }
  });

  it("rejects a plausible-looking amount that was never approved", () => {
    expect(isTrustedPublicPriceCode("professional_monthly_aed_1")).toBe(false);
  });
});

describe("pending pricing intent storage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing is stored", () => {
    expect(readPendingPricingIntent()).toBeNull();
  });

  it("stores and reads back a valid trusted code", () => {
    storePendingPricingIntent("professional_monthly_aed_399");
    expect(readPendingPricingIntent()).toBe("professional_monthly_aed_399");
  });

  it("clears a stored intent", () => {
    storePendingPricingIntent("starter_monthly_aed_149");
    clearPendingPricingIntent();
    expect(readPendingPricingIntent()).toBeNull();
  });

  it("rejects and removes an expired record (older than 7 days)", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ priceCode: "starter_monthly_aed_149", createdAt: eightDaysAgo }));

    expect(readPendingPricingIntent()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("accepts a record just under 7 days old", () => {
    const almostSevenDays = Date.now() - (7 * 24 * 60 * 60 * 1000 - 60_000);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ priceCode: "business_annual_aed_8990", createdAt: almostSevenDays }));

    expect(readPendingPricingIntent()).toBe("business_annual_aed_8990");
  });

  it("ignores malformed JSON without throwing", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(() => readPendingPricingIntent()).not.toThrow();
    expect(readPendingPricingIntent()).toBeNull();
  });

  it("ignores a wrong-shaped stored object", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    expect(readPendingPricingIntent()).toBeNull();
  });

  it("ignores a stored record carrying an untrusted price code", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ priceCode: "professional_monthly_aed_400", createdAt: Date.now() }));
    expect(readPendingPricingIntent()).toBeNull();
  });

  it("ignores a stored record with an invalid timestamp", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ priceCode: "starter_monthly_aed_149", createdAt: "yesterday" }));
    expect(readPendingPricingIntent()).toBeNull();
  });

  it("persists only the price code and a timestamp — never an amount or currency", () => {
    storePendingPricingIntent("professional_annual_aed_3990");
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["createdAt", "priceCode"]);
    expect(raw).not.toMatch(/"amount"/);
    expect(raw).not.toMatch(/"currency"/);
  });
});

describe("SSR safety", () => {
  it("never touches localStorage when window is undefined", () => {
    // The default vitest "node" test environment has no `window` global.
    expect(() => readPendingPricingIntent()).not.toThrow();
    expect(readPendingPricingIntent()).toBeNull();
    expect(() => storePendingPricingIntent("starter_monthly_aed_149")).not.toThrow();
    expect(() => clearPendingPricingIntent()).not.toThrow();
  });
});

describe("trusted href builders", () => {
  it("builds encoded trusted hrefs for register, login and subscription", () => {
    expect(buildRegisterPricingHref("professional_monthly_aed_399")).toBe("/register?priceCode=professional_monthly_aed_399");
      expect(buildRegisterPricingHref("enterprise_core_annual_aed_15000")).toBe("/register?priceCode=enterprise_core_annual_aed_15000");
    expect(buildLoginPricingHref("professional_monthly_aed_399")).toBe("/login?priceCode=professional_monthly_aed_399");
    expect(buildSubscriptionPricingHref("professional_monthly_aed_399")).toBe("/settings/subscription?priceCode=professional_monthly_aed_399");
  });
});

describe("normalizeSafeInternalPath — open redirect protection", () => {
  it("accepts internal paths", () => {
    expect(normalizeSafeInternalPath("/dashboard")).toBe("/dashboard");
    expect(normalizeSafeInternalPath("/projects")).toBe("/projects");
    expect(normalizeSafeInternalPath("/settings/subscription")).toBe("/settings/subscription");
    expect(normalizeSafeInternalPath("/projects/test?tab=boq")).toBe("/projects/test?tab=boq");
  });

  it("rejects external/unsafe values, always falling back to /dashboard", () => {
    const unsafe: Array<string | null | undefined> = [
      "https://evil.example",
      "http://evil.example",
      "//evil.example",
      "javascript:alert(1)",
      "data:text/html,test",
      "\\evil.example",
      null,
      undefined,
      "",
    ];
    for (const value of unsafe) {
      expect(normalizeSafeInternalPath(value)).toBe("/dashboard");
    }
  });
});

describe("public pricing CTA source contract", () => {
  it("routes plan CTAs through the trusted-priceCode helper and never calls checkout directly", () => {
    const source = readFileSync(join(repoRoot, "src", "app", "(marketing)", "pricing", "pricing-plans.tsx"), "utf8");

    expect(source).toContain("buildRegisterPricingHref");
    expect(source).toContain("storePendingPricingIntent");
    expect(source).not.toContain("/api/commerce/checkout");
  });
});

describe("login page pricing-intent source contract", () => {
  it("validates query intent, recovers stored intent, routes to subscription, and never sends priceCode to the login API", () => {
    const source = readFileSync(join(repoRoot, "src", "app", "login", "page.tsx"), "utf8");

    expect(source).toContain('normalizePublicPriceCode(searchParams.get("priceCode"))');
    expect(source).toContain("readPendingPricingIntent()");
    expect(source).toContain("buildSubscriptionPricingHref(pendingPriceCode)");
    expect(source).toContain('normalizeSafeInternalPath(searchParams.get("next"))');

    const loginCallMatch = source.match(/apiClient\.post\("\/api\/auth\/login",\s*\{([^}]*)\}/s);
    expect(loginCallMatch).not.toBeNull();
    expect(loginCallMatch?.[1]).not.toMatch(/priceCode/);
  });
});

describe("registration page pricing-intent source contract", () => {
  it("keeps priceCode out of the register API body and only changes the sign-in link", () => {
    const source = readFileSync(join(repoRoot, "src", "app", "(marketing)", "register", "page.tsx"), "utf8");

    expect(source).toContain('normalizePublicPriceCode(searchParams.get("priceCode"))');
    expect(source).toContain("buildLoginPricingHref(pendingPriceCode)");

    const registerCallMatch = source.match(/apiClient\.post\("\/api\/auth\/register",\s*\{([^}]*)\}/s);
    expect(registerCallMatch).not.toBeNull();
    expect(registerCallMatch?.[1]).not.toMatch(/priceCode/);
  });
});

describe("subscription page pricing-intent source contract", () => {
  it("only highlights the matching price with a machine-readable marker and never auto-starts checkout", () => {
    const source = readFileSync(join(repoRoot, "src", "app", "settings", "subscription", "page.tsx"), "utf8");

    expect(source).toContain("selectedPricingIntent");
    expect(source).toContain("price.priceCode === selectedPricingIntent");
    expect(source).toContain('aria-current={isSelectedPricingIntent ? "true" : undefined}');
    expect(source).toContain('data-selected-pricing-intent={isSelectedPricingIntent ? "true" : undefined}');
    expect(source).not.toMatch(/useEffect\(\(\) => \{?\s*(?:void )?checkout\(/);
  });
});
