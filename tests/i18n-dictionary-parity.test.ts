import { describe, expect, it } from "vitest";
import en from "../src/lib/i18n/dictionaries/en";
import ar from "../src/lib/i18n/dictionaries/ar";

/**
 * ARABIC-RTL-LOCALIZATION — TEST 1: dictionary parity. The English
 * dictionary is the canonical key inventory; Arabic must contain exactly
 * the same keys — no missing key, no silent English fallback anywhere in
 * the audited core journey. ar.ts is also typed directly against
 * `Dictionary` (see its own top-of-file comment), which already catches
 * this at compile time — this test is the same invariant enforced at
 * runtime/CI, independent of whether someone bypasses the type with `as
 * any` later.
 */

function flattenKeys(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n dictionary parity: English (canonical) vs Arabic", () => {
  const enKeys = flattenKeys(en).sort();
  const arKeys = flattenKeys(ar).sort();

  it("has the same number of leaf keys in both dictionaries", () => {
    expect(arKeys.length).toBe(enKeys.length);
  });

  it("has zero English keys missing from Arabic", () => {
    const missingFromAr = enKeys.filter((key) => !arKeys.includes(key));
    expect(missingFromAr).toEqual([]);
  });

  it("has zero Arabic keys that don't exist in English (no orphaned/stale keys)", () => {
    const extraInAr = arKeys.filter((key) => !enKeys.includes(key));
    expect(extraInAr).toEqual([]);
  });

  it("never has an Arabic value that is byte-identical to its English counterpart for translatable prose", () => {
    // A handful of keys are legitimately identical by design (the brand
    // name "Quantara", and technical acronyms like "PDF") — everything
    // else being identical would mean a key was copy-pasted untranslated.
    const allowedIdentical = new Set([
      "common.appName",
      "documents.downloadPdf",
      "languageSwitcher.switchToArabic", // English-language self-label, correct as-is
    ]);
    function walk(enNode: unknown, arNode: unknown, path: string, offenders: string[]) {
      if (typeof enNode === "string") {
        if (enNode === arNode && !allowedIdentical.has(path) && /[A-Za-z]/.test(enNode)) {
          offenders.push(path);
        }
        return;
      }
      if (enNode && typeof enNode === "object") {
        for (const [key, value] of Object.entries(enNode as Record<string, unknown>)) {
          walk(value, (arNode as Record<string, unknown> | undefined)?.[key], path ? `${path}.${key}` : key, offenders);
        }
      }
    }
    const offenders: string[] = [];
    walk(en, ar, "", offenders);
    expect(offenders).toEqual([]);
  });
});
