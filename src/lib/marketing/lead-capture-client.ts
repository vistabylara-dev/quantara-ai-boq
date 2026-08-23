export const LEAD_CAPTURE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const LEAD_CAPTURE_SUBMITTED_KEY = "quantara:marketing-lead-submitted:v1";
export const LEAD_CAPTURE_DISMISSAL_KEY = "quantara:marketing-lead-dismissed:v1";
export const DASHBOARD_LEAD_SESSION_KEY = "quantara:marketing-lead-dashboard-session:v1";
export const LEAD_CAPTURE_ATTRIBUTION_KEY = "quantara:marketing-lead-attribution:v1";
export const LEAD_CAPTURE_PACKAGE_KEY = "quantara:marketing-lead-package:v1";

type LeadStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type LeadAttribution = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
};

export type LeadPrefillSession =
  | { authenticated: false }
  | {
      authenticated: true;
      user: { fullName?: string | null; email?: string | null };
    };

const EXCLUDED_MARKETING_PATHS = new Set([
  "/acceptable-use",
  "/contact-sales",
  "/cookie-policy",
  "/data-processing",
  "/privacy",
  "/register",
  "/security",
  "/site-map",
  "/subprocessors",
  "/terms",
]);

const DASHBOARD_LEAD_PATH_PREFIXES = [
  "/dashboard",
  "/projects",
  "/clients",
  "/industry-engines",
  "/integrations",
  "/data-library",
  "/company-library",
  "/imports",
  "/catalogue",
  "/suppliers",
  "/templates",
  "/settings",
] as const;

function browserStorage(storage?: LeadStorage): LeadStorage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserSessionStorage(storage?: LeadStorage): LeadStorage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function cleanContextValue(value: string | null | undefined, maximum = 255): string {
  return (value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maximum);
}

function readTimedRecord<T extends Record<string, unknown>>(
  key: string,
  storage: LeadStorage | undefined,
  now: number,
  validate: (value: Record<string, unknown>) => value is T,
): T | null {
  const target = browserStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      target.removeItem(key);
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (!validate(record)) {
      target.removeItem(key);
      return null;
    }
    const capturedAt = record.capturedAt as number;
    if (capturedAt > now || now - capturedAt >= LEAD_CAPTURE_TTL_MS) {
      target.removeItem(key);
      return null;
    }
    return record;
  } catch {
    try {
      target.removeItem(key);
    } catch {
      // Storage is optional; a blocked storage backend must not block browsing.
    }
    return null;
  }
}

export function hasPermanentLeadSubmission(storage?: LeadStorage): boolean {
  const target = browserStorage(storage);
  if (!target) return false;
  try {
    const value = target.getItem(LEAD_CAPTURE_SUBMITTED_KEY);
    if (!value) return false;
    if (value === "submitted") return true;
    target.removeItem(LEAD_CAPTURE_SUBMITTED_KEY);
    return false;
  } catch {
    return false;
  }
}

export function recordPermanentLeadSubmission(storage?: LeadStorage): void {
  const target = browserStorage(storage);
  if (!target) return;
  try {
    target.setItem(LEAD_CAPTURE_SUBMITTED_KEY, "submitted");
    target.removeItem(LEAD_CAPTURE_DISMISSAL_KEY);
  } catch {
    // Storage is best effort; submission itself has already succeeded.
  }
}

export function hasActiveLeadDismissal(
  storage?: LeadStorage,
  now = Date.now(),
): boolean {
  return Boolean(readTimedRecord<{ capturedAt: number }>(
    LEAD_CAPTURE_DISMISSAL_KEY,
    storage,
    now,
    (value): value is { capturedAt: number } =>
      typeof value.capturedAt === "number"
      && Number.isFinite(value.capturedAt),
  ));
}

export function recordLeadDismissal(
  storage?: LeadStorage,
  now = Date.now(),
): void {
  const target = browserStorage(storage);
  if (!target) return;
  try {
    target.setItem(LEAD_CAPTURE_DISMISSAL_KEY, JSON.stringify({ capturedAt: now }));
  } catch {
    // A storage failure only removes dismissal suppression; it never blocks browsing.
  }
}

export function hasDashboardLeadSessionBeenShown(storage?: LeadStorage): boolean {
  const target = browserSessionStorage(storage);
  if (!target) return false;
  try {
    return target.getItem(DASHBOARD_LEAD_SESSION_KEY) === "shown";
  } catch {
    return false;
  }
}

export function recordDashboardLeadSessionShown(storage?: LeadStorage): void {
  const target = browserSessionStorage(storage);
  if (!target) return;
  try {
    target.setItem(DASHBOARD_LEAD_SESSION_KEY, "shown");
  } catch {
    // Session suppression is best effort and must not block the dashboard.
  }
}

export function resetDashboardLeadSession(storage?: LeadStorage): void {
  const target = browserSessionStorage(storage);
  if (!target) return;
  try {
    target.removeItem(DASHBOARD_LEAD_SESSION_KEY);
  } catch {
    // Authentication remains authoritative if sessionStorage is unavailable.
  }
}

function parseAttribution(search: string): LeadAttribution {
  const params = new URLSearchParams(search);
  return {
    utmSource: cleanContextValue(params.get("utm_source")),
    utmMedium: cleanContextValue(params.get("utm_medium")),
    utmCampaign: cleanContextValue(params.get("utm_campaign")),
  };
}

export function resolveLeadAttribution(
  search: string,
  storage?: LeadStorage,
  now = Date.now(),
): LeadAttribution {
  const current = parseAttribution(search);
  const hasCurrentAttribution = Boolean(
    current.utmSource || current.utmMedium || current.utmCampaign,
  );
  const target = browserStorage(storage);

  if (hasCurrentAttribution) {
    try {
      target?.setItem(
        LEAD_CAPTURE_ATTRIBUTION_KEY,
        JSON.stringify({ ...current, capturedAt: now }),
      );
    } catch {
      // Attribution persistence is best effort.
    }
    return current;
  }

  const stored = readTimedRecord<LeadAttribution & { capturedAt: number }>(
    LEAD_CAPTURE_ATTRIBUTION_KEY,
    storage,
    now,
    (value): value is LeadAttribution & { capturedAt: number } =>
      typeof value.utmSource === "string"
      && typeof value.utmMedium === "string"
      && typeof value.utmCampaign === "string"
      && typeof value.capturedAt === "number"
      && Number.isFinite(value.capturedAt),
  );

  return stored
    ? {
        utmSource: cleanContextValue(stored.utmSource),
        utmMedium: cleanContextValue(stored.utmMedium),
        utmCampaign: cleanContextValue(stored.utmCampaign),
      }
    : current;
}

export function storeLeadPackageInterest(
  value: string,
  storage?: LeadStorage,
  now = Date.now(),
): string {
  const packageInterest = cleanContextValue(value);
  if (!packageInterest) return "";
  const target = browserStorage(storage);
  try {
    target?.setItem(
      LEAD_CAPTURE_PACKAGE_KEY,
      JSON.stringify({ packageInterest, capturedAt: now }),
    );
  } catch {
    // Package context persistence is best effort.
  }
  return packageInterest;
}

export function readLeadPackageInterest(
  storage?: LeadStorage,
  now = Date.now(),
): string {
  const stored = readTimedRecord<{ packageInterest: string; capturedAt: number }>(
    LEAD_CAPTURE_PACKAGE_KEY,
    storage,
    now,
    (value): value is { packageInterest: string; capturedAt: number } =>
      typeof value.packageInterest === "string"
      && typeof value.capturedAt === "number"
      && Number.isFinite(value.capturedAt),
  );
  return cleanContextValue(stored?.packageInterest);
}

export function inferLeadPackageInterest(pathname: string): string {
  if (pathname === "/tayqan-ai-quantity-surveyor") return "TAYQAN AI Quantity Surveyor";
  if (pathname === "/boq-integrations" || pathname.startsWith("/boq-integrations/")) {
    return "Quantara integrations";
  }
  if (pathname === "/industries" || pathname.startsWith("/boq-software-for-")) {
    return "Quantara Industry Catalogue";
  }

  const stored = readLeadPackageInterest();
  if (stored) return stored;

  return "";
}

export function isLeadCaptureEligiblePath(pathname: string): boolean {
  return pathname.startsWith("/") && !EXCLUDED_MARKETING_PATHS.has(pathname);
}

export function isDashboardLeadCaptureEligiblePath(pathname: string): boolean {
  return DASHBOARD_LEAD_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function mergeAuthenticatedLeadPrefill<T extends { fullName: string; email: string }>(
  current: T,
  session: LeadPrefillSession,
): T {
  if (!session.authenticated) return current;
  return {
    ...current,
    fullName: current.fullName || cleanContextValue(session.user.fullName, 160),
    email: current.email || cleanContextValue(session.user.email, 254),
  };
}
