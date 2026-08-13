import en, { type Dictionary } from "./dictionaries/en";

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
 * Canonical fallback for framework-agnostic helpers and existing callers that
 * do not render inside LocaleProvider. UI components should still inject the
 * active locale translator so Arabic remains reactive at render time.
 */
export const defaultTranslator = createTranslator(en);
