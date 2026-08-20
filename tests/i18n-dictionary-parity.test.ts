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

  it("never has an Arabic leaf whose type differs from its English counterpart (catches a bypassed `as any`)", () => {
    // Key-set parity above only proves the KEY exists in both dictionaries —
    // not that the Arabic VALUE is actually a translatable string. Someone
    // bypassing the compile-time `Dictionary` type (e.g. `ar.foo = 5 as any`)
    // would still pass the key-parity checks above but silently break the
    // translator (createTranslator only returns `node` when it's a string —
    // see translate.ts's readPath — so a non-string leaf falls back to the
    // raw key).
    function walkTypes(enNode: unknown, arNode: unknown, path: string, offenders: string[]) {
      if (typeof enNode === "string") {
        if (typeof arNode !== "string") offenders.push(`${path} (expected string, got ${typeof arNode})`);
        return;
      }
      if (enNode && typeof enNode === "object") {
        for (const [key, value] of Object.entries(enNode as Record<string, unknown>)) {
          walkTypes(value, (arNode as Record<string, unknown> | undefined)?.[key], path ? `${path}.${key}` : key, offenders);
        }
      }
    }
    const typeOffenders: string[] = [];
    walkTypes(en, ar, "", typeOffenders);
    expect(typeOffenders).toEqual([]);
  });

  it("never has an Arabic value that is byte-identical to its English counterpart for translatable prose", () => {
    // A handful of keys are legitimately identical by design (the brand
    // name "Quantara", and technical acronyms like "PDF") — everything
    // else being identical would mean a key was copy-pasted untranslated.
    const allowedIdentical = new Set([
      "common.appName",
      "documents.downloadPdf",
      "publicContent.pricing.saasStarterFeature7",
      "publicContent.pricing.saasProfessionalFeature7",
      "publicContent.pricing.saasBusinessFeature7",
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

  it("keeps Arabic comparison links aligned with their English route order", () => {
    const comparisons = JSON.parse(ar.publicRoutes.comparisonsHub) as {
      categories: Array<{ links: Array<{ label: string }> }>;
    };
    expect(comparisons.categories[0]?.links.map((link) => link.label)).toEqual([
      "مقارنة برامج جداول الكميات في الإمارات",
      "Quantara مقابل Excel لجداول الكميات",
      "برمجيات جداول الكميات مقابل جداول البيانات",
      "برمجيات تقدير الإنشاءات مقابل Excel",
    ]);

    const estimating = JSON.parse(ar.publicRoutes.constructionEstimatingSoftware) as {
      relatedPages: Array<{ label: string }>;
    };
    expect(estimating.relatedPages.map((page) => page.label)).toEqual([
      "مقارنة برامج جداول الكميات في الإمارات",
      "برنامج BOQ",
      "إدارة BOQ",
      "حصر الكميات",
      "إنشاء المستندات",
      "ميزات المنتج",
    ]);

    const navigation = JSON.parse(ar.publicRoutes.publicNavigation) as {
      labels: Record<string, string>;
      descriptions: Record<string, string>;
    };
    expect(navigation.labels["/boq-software-comparison-uae"]).toBe(
      "مقارنة برامج جداول الكميات في الإمارات",
    );
    expect(navigation.descriptions["/boq-software-comparison-uae"]).toContain(
      "المصادر الرسمية",
    );
  });
});
