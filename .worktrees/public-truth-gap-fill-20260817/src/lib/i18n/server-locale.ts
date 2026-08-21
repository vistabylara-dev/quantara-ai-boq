import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE_NAME, type Locale } from "./config";

/**
 * Reads the persisted locale preference server-side (Server Components,
 * layouts, route handlers) — the same cookie the client-side switcher
 * writes to. Used by the root layout so `<html lang dir>` is correct on
 * the FIRST server-rendered response, never a post-hydration flip.
 */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE_NAME)?.value;
  return isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;
}
