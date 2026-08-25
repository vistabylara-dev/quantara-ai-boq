import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_LEAD_SESSION_KEY,
  LEAD_CAPTURE_ATTRIBUTION_KEY,
  LEAD_CAPTURE_DISMISSAL_KEY,
  LEAD_CAPTURE_SUBMITTED_KEY,
  LEAD_CAPTURE_TTL_MS,
  hasActiveLeadDismissal,
  hasDashboardLeadSessionBeenShown,
  hasPermanentLeadSubmission,
  inferLeadPackageInterest,
  isDashboardLeadCaptureEligiblePath,
  isLeadCaptureEligiblePath,
  mergeAuthenticatedLeadPrefill,
  readLeadPackageInterest,
  recordDashboardLeadSessionShown,
  recordLeadDismissal,
  recordPermanentLeadSubmission,
  resetDashboardLeadSession,
  resolveLeadAttribution,
  storeLeadPackageInterest,
} from "@/lib/marketing/lead-capture-client";

function createStorageMock() {
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

describe("marketing lead popup state", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: createStorageMock(),
      sessionStorage: createStorageMock(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("suppresses successful public submissions permanently, including beyond seven days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
    recordPermanentLeadSubmission();

    expect(hasPermanentLeadSubmission()).toBe(true);
    expect(window.localStorage.getItem(LEAD_CAPTURE_SUBMITTED_KEY)).toBe("submitted");

    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    expect(hasPermanentLeadSubmission()).toBe(true);

    vi.setSystemTime(new Date("2036-08-23T12:00:00.000Z"));
    expect(hasPermanentLeadSubmission()).toBe(true);
  });

  it("suppresses dismissal for exactly seven days and permits the popup after expiry", () => {
    const now = Date.UTC(2026, 7, 23, 12);
    recordLeadDismissal(undefined, now);

    expect(hasActiveLeadDismissal(undefined, now + LEAD_CAPTURE_TTL_MS - 1)).toBe(true);
    expect(hasActiveLeadDismissal(undefined, now + LEAD_CAPTURE_TTL_MS)).toBe(false);
    expect(window.localStorage.getItem(LEAD_CAPTURE_DISMISSAL_KEY)).toBeNull();
  });

  it("keeps public submission and dismissal state separate", () => {
    recordLeadDismissal(undefined, Date.UTC(2026, 7, 23));
    expect(window.localStorage.getItem(LEAD_CAPTURE_DISMISSAL_KEY)).not.toBeNull();

    recordPermanentLeadSubmission();
    expect(hasPermanentLeadSubmission()).toBe(true);
    expect(window.localStorage.getItem(LEAD_CAPTURE_DISMISSAL_KEY)).toBeNull();
  });

  it("tracks dashboard display only for the current browser session and can reset on login", () => {
    expect(hasDashboardLeadSessionBeenShown()).toBe(false);
    recordDashboardLeadSessionShown();
    expect(hasDashboardLeadSessionBeenShown()).toBe(true);
    expect(window.sessionStorage.getItem(DASHBOARD_LEAD_SESSION_KEY)).toBe("shown");
    expect(window.localStorage.getItem(LEAD_CAPTURE_SUBMITTED_KEY)).toBeNull();

    resetDashboardLeadSession();
    expect(hasDashboardLeadSessionBeenShown()).toBe(false);
  });

  it("fails safely for malformed or unavailable storage", () => {
    window.localStorage.setItem(LEAD_CAPTURE_DISMISSAL_KEY, "{bad-json");
    window.localStorage.setItem(LEAD_CAPTURE_SUBMITTED_KEY, "invalid");
    window.sessionStorage.setItem(DASHBOARD_LEAD_SESSION_KEY, "invalid");

    expect(() => hasActiveLeadDismissal()).not.toThrow();
    expect(hasActiveLeadDismissal()).toBe(false);
    expect(hasPermanentLeadSubmission()).toBe(false);
    expect(hasDashboardLeadSessionBeenShown()).toBe(false);

    const blockedStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    vi.stubGlobal("window", {
      localStorage: blockedStorage,
      sessionStorage: blockedStorage,
    });

    expect(() => recordLeadDismissal()).not.toThrow();
    expect(() => recordPermanentLeadSubmission()).not.toThrow();
    expect(() => recordDashboardLeadSessionShown()).not.toThrow();
    expect(hasActiveLeadDismissal()).toBe(false);
    expect(hasPermanentLeadSubmission()).toBe(false);
    expect(hasDashboardLeadSessionBeenShown()).toBe(false);
  });

  it("captures and retains UTM attribution across a later page without query parameters", () => {
    const first = resolveLeadAttribution("?utm_source=google&utm_medium=cpc&utm_campaign=dubai-boq");
    expect(first).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "dubai-boq",
    });

    const later = resolveLeadAttribution("");
    expect(later).toEqual(first);
    expect(window.localStorage.getItem(LEAD_CAPTURE_ATTRIBUTION_KEY)).toContain("dubai-boq");
  });

  it("keeps package interest blank without context and captures public package context", () => {
    expect(inferLeadPackageInterest("/")).toBe("");
    expect(inferLeadPackageInterest("/pricing")).toBe("");
    expect(inferLeadPackageInterest("/boq-integrations/autodesk")).toBe("Quantara integrations");
    expect(inferLeadPackageInterest("/tayqan-ai-quantity-surveyor")).toBe("TAYQAN AI Quantity Surveyor");

    expect(storeLeadPackageInterest("Quantara Professional")).toBe("Quantara Professional");
    expect(readLeadPackageInterest()).toBe("Quantara Professional");
    expect(inferLeadPackageInterest("/pricing")).toBe("Quantara Professional");
  });

  it("prefills only missing authenticated name/email values", () => {
    const session = {
      authenticated: true as const,
      user: { fullName: "Aisha Al Mansoori", email: "aisha@example.com" },
    };
    expect(mergeAuthenticatedLeadPrefill({ fullName: "", email: "", mobile: "" }, session)).toEqual({
      fullName: "Aisha Al Mansoori",
      email: "aisha@example.com",
      mobile: "",
    });
    expect(mergeAuthenticatedLeadPrefill({ fullName: "Entered Name", email: "entered@example.com" }, session)).toEqual({
      fullName: "Entered Name",
      email: "entered@example.com",
    });
  });

  it("uses distinct public marketing and authenticated dashboard route policies", () => {
    expect(isLeadCaptureEligiblePath("/")).toBe(true);
    expect(isLeadCaptureEligiblePath("/pricing")).toBe(true);
    expect(isLeadCaptureEligiblePath("/boq-software-dubai")).toBe(true);
    expect(isLeadCaptureEligiblePath("/privacy")).toBe(false);
    expect(isLeadCaptureEligiblePath("/contact-sales")).toBe(false);
    expect(isLeadCaptureEligiblePath("/register")).toBe(false);

    expect(isDashboardLeadCaptureEligiblePath("/dashboard")).toBe(true);
    expect(isDashboardLeadCaptureEligiblePath("/projects/project-1")).toBe(true);
    expect(isDashboardLeadCaptureEligiblePath("/projects/new")).toBe(false);
    expect(isDashboardLeadCaptureEligiblePath("/settings")).toBe(true);
    expect(isDashboardLeadCaptureEligiblePath("/marketplace")).toBe(false);
    expect(isDashboardLeadCaptureEligiblePath("/admin")).toBe(false);
    expect(isDashboardLeadCaptureEligiblePath("/")).toBe(false);
  });

  it("is SSR-safe without a window global", () => {
    vi.unstubAllGlobals();
    expect(hasPermanentLeadSubmission()).toBe(false);
    expect(hasActiveLeadDismissal()).toBe(false);
    expect(hasDashboardLeadSessionBeenShown()).toBe(false);
    expect(readLeadPackageInterest()).toBe("");
    expect(resolveLeadAttribution("")).toEqual({
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
    });
  });

  it("mounts public and dashboard modes explicitly with no marketplace lead dependency", () => {
    const marketingLayout = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "layout.tsx"),
      "utf8",
    );
    const conditionalShell = readFileSync(
      join(process.cwd(), "src", "components", "layout", "conditional-app-shell.tsx"),
      "utf8",
    );
    const marketplacePage = readFileSync(
      join(process.cwd(), "src", "app", "marketplace", "page.tsx"),
      "utf8",
    );
    const leadClient = readFileSync(
      join(process.cwd(), "src", "lib", "marketing", "lead-capture-client.ts"),
      "utf8",
    );

    expect(marketingLayout).toContain('<LeadCapturePopup mode="public" />');
    expect(conditionalShell).toContain('<LeadCapturePopup mode="dashboard" />');
    expect(marketplacePage).not.toContain("LeadCapturePopup");
    expect(leadClient).not.toMatch(/pricing-intent|pendingPricing|\/marketplace/);
  });

  it("keeps client payload free of server-owned identity and timestamp fields", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "marketing", "lead-capture-popup.tsx"),
      "utf8",
    );
    const postCall = source.match(/apiClient\.post<\{ received: true \}>\("\/api\/marketing\/leads", \{([\s\S]*?)\n      \}\);/);
    expect(postCall).not.toBeNull();
    expect(postCall?.[1]).not.toMatch(/userId|submittedAt|status/);
    expect(source).toContain("AUTO_OPEN_DELAY_MS = 15_000");
    expect(source).toContain("MEANINGFUL_SCROLL_RATIO = 0.35");
    expect(source).not.toContain("Quantara package guidance");
  });
});
