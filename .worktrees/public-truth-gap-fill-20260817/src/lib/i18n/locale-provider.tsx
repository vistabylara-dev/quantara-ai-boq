"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, directionForLocale, LOCALE_COOKIE_NAME, type Locale } from "./config";
import { getDictionary } from "./dictionaries";
import { createTranslator, type TranslateFn } from "./translate";

type LocaleContextValue = {
  locale: Locale;
  direction: "ltr" | "rtl";
  t: TranslateFn;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * `initialLocale` comes from the server (see get-server-locale.ts, read in
 * the root layout) so the very first client render already matches what
 * was SSR'd — no flash of the wrong language/direction.
 */
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  const setLocale = useCallback((next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    setLocaleState(next);
    // Re-runs Server Components (including the root layout's <html lang
    // dir> and any server-rendered dictionary text) against the new
    // cookie, WITHOUT a full page reload — no logout, no lost route,
    // no project/workflow state reset.
    router.refresh();
  }, [locale, router]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    direction: directionForLocale(locale),
    t: createTranslator(getDictionary(locale)),
    setLocale,
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider (see src/app/layout.tsx).");
  }
  return context;
}

/** Convenience alias for components that only need the translate function. */
export function useTranslations(): TranslateFn {
  return useLocale().t;
}
