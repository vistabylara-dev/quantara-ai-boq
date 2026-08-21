/**
 * Centralized locale configuration — the single place that names which
 * locales exist. Adding a locale later means updating this file and adding
 * a dictionary; nothing else in the app should hardcode "en"/"ar" literals
 * for locale membership checks.
 */

export const SUPPORTED_LOCALES = ["en", "ar"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Non-sensitive UI preference — no database migration needed for this. */
export const LOCALE_COOKIE_NAME = "quantara_locale";

export const LOCALE_DIRECTION: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

export const LOCALE_LABELS: Record<Locale, { native: string; short: string }> = {
  en: { native: "English", short: "EN" },
  ar: { native: "العربية", short: "ع" },
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function directionForLocale(locale: Locale): "ltr" | "rtl" {
  return LOCALE_DIRECTION[locale];
}
