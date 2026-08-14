export const TRUSTED_PUBLIC_PRICE_CODES = [
  "starter_monthly_aed_149",
  "starter_annual_aed_1490",
  "professional_monthly_aed_399",
  "professional_annual_aed_3990",
  "business_monthly_aed_899",
  "business_annual_aed_8990",
] as const;

export type TrustedPublicPriceCode = (typeof TRUSTED_PUBLIC_PRICE_CODES)[number];

const STORAGE_KEY = "quantara:pending-pricing-intent:v1";
const INTENT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

type StoredPricingIntent = {
  priceCode: TrustedPublicPriceCode;
  createdAt: number;
};

export function isTrustedPublicPriceCode(value: unknown): value is TrustedPublicPriceCode {
  return typeof value === "string" && (TRUSTED_PUBLIC_PRICE_CODES as readonly string[]).includes(value);
}

export function normalizePublicPriceCode(value: unknown): TrustedPublicPriceCode | null {
  return isTrustedPublicPriceCode(value) ? value : null;
}

function isStoredPricingIntent(value: unknown): value is StoredPricingIntent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return isTrustedPublicPriceCode(record.priceCode) && typeof record.createdAt === "number" && Number.isFinite(record.createdAt);
}

export function storePendingPricingIntent(priceCode: TrustedPublicPriceCode): void {
  if (typeof window === "undefined") return;
  const record: StoredPricingIntent = { priceCode, createdAt: Date.now() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private browsing / storage quota - pricing intent is a soft preference, safe to drop.
  }
}

export function readPendingPricingIntent(): TrustedPublicPriceCode | null {
  if (typeof window === "undefined") return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPendingPricingIntent();
    return null;
  }

  if (!isStoredPricingIntent(parsed) || Date.now() - parsed.createdAt > INTENT_EXPIRATION_MS) {
    clearPendingPricingIntent();
    return null;
  }

  return parsed.priceCode;
}

export function clearPendingPricingIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function buildRegisterPricingHref(priceCode: TrustedPublicPriceCode): string {
  return "/register?priceCode=" + encodeURIComponent(priceCode);
}

export function buildLoginPricingHref(priceCode: TrustedPublicPriceCode): string {
  return "/login?priceCode=" + encodeURIComponent(priceCode);
}

export function buildSubscriptionPricingHref(priceCode: TrustedPublicPriceCode): string {
  return "/settings/subscription?priceCode=" + encodeURIComponent(priceCode);
}

function hasDisallowedCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 32) return true;
  }
  return false;
}

/**
 * Guards the auth `next` redirect against becoming an open redirect: only an
 * internal, single-leading-slash path is trusted, so a scheme, protocol-relative
 * "//host", backslash, or control character always falls back to /dashboard.
 */
export function normalizeSafeInternalPath(value: string | null | undefined): string {
  const fallback = "/dashboard";
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (hasDisallowedCharacter(value)) return fallback;
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return fallback;
  return value;
}
