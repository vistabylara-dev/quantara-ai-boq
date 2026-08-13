import type { Dictionary } from "./dictionaries/en";

/**
 * Recursively derives every leaf dot-path of the dictionary as a union of
 * string literal types — `t("boq.grandTotal")` is a compile-time error if
 * the key doesn't exist in the English (canonical) dictionary shape.
 */
type DotPaths<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: DotPaths<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>;
    }[keyof T & string];

export type TranslationKey = DotPaths<Dictionary>;

export type TranslateVars = Record<string, string | number>;

export type TranslateFn = (key: TranslationKey, vars?: TranslateVars) => string;

function readPath(dictionary: Dictionary, key: string): string | undefined {
  const parts = key.split(".");
  let node: unknown = dictionary;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Never throws and never silently swallows a missing key into blank UI —
 * a missing key renders as the key itself (visibly wrong, easy to spot in
 * review) rather than an empty string or a crash. The dictionary-parity
 * test is what actually enforces zero missing keys across locales; this is
 * just a safe runtime fallback for defense in depth.
 */
export function createTranslator(dictionary: Dictionary): TranslateFn {
  return (key, vars) => {
    const value = readPath(dictionary, key);
    if (value === undefined) return key;
    return interpolate(value, vars);
  };
}

/**
 * Reads a structured page payload from the canonical PR #36 dictionary.
 * Public landing pages use this for route-specific content while retaining
 * the same locale cookie, server locale, dictionary parity and translator.
 */
export function translateStructuredContent<T>(
  translate: TranslateFn,
  key: TranslationKey,
  fallback: T,
): T {
  const value = translate(key);
  if (value === key || value === "{}") return fallback;
  try {
    const localized = JSON.parse(value) as unknown;
    const merge = (base: unknown, override: unknown): unknown => {
      if (override === undefined) return base;
      if (Array.isArray(override)) {
        if (!Array.isArray(base)) return override;
        return override.map((item, index) => merge(base[index], item));
      }
      if (
        base &&
        override &&
        typeof base === "object" &&
        typeof override === "object" &&
        !Array.isArray(base)
      ) {
        return Object.fromEntries(
          [...new Set([...Object.keys(base), ...Object.keys(override)])].map((property) => [
            property,
            merge(
              (base as Record<string, unknown>)[property],
              (override as Record<string, unknown>)[property],
            ),
          ]),
        );
      }
      return override;
    };
    return merge(fallback, localized) as T;
  } catch {
    return fallback;
  }
}
