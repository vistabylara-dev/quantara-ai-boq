import type { Locale } from "../config";
import en from "./en";
import ar from "./ar";
import type { Dictionary } from "./en";

export const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
