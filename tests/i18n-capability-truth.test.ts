import { describe, expect, it } from "vitest";
import ar from "../src/lib/i18n/dictionaries/ar";
import en from "../src/lib/i18n/dictionaries/en";

/**
 * ARABIC-RTL-LOCALIZATION — TEST 7: capability truth. Translation must
 * never accidentally upgrade a real, honest "not implemented yet" claim
 * into wording that implies automatic OCR, automatic Autodesk/Revit/AutoCAD
 * extraction, or autonomous professional approval — none of which this
 * product does. Since the current dictionaries don't yet contain OCR/CAD
 * copy at all (those surfaces are out of scope for this pass), this test's
 * job is to keep it that way honestly: fail loudly the moment such a claim
 * is added to either dictionary without deliberate review, rather than
 * silently accepting it later.
 */

function flattenStrings(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (node && typeof node === "object") {
    return Object.values(node as Record<string, unknown>).flatMap(flattenStrings);
  }
  return [];
}

const FORBIDDEN_CLAIM_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "implies OCR is performed automatically", pattern: /\bocr\b.*(implement|perform|automatic|available)|(?:يتم|تُنفَّذ|متاحة).{0,20}\bocr\b/i },
  { label: "implies Autodesk/Revit/AutoCAD automatic extraction", pattern: /(autodesk|revit|autocad).{0,30}(automatic|implemented|available)|(?:أوتوديسك|ريفيت|أوتوكاد).{0,30}(تلقائي|متاح|منفَّذ)/i },
  { label: "implies autonomous approval without human review", pattern: /autonomous (professional )?approval|automatic(ally)? approv(ed|al)|موافقة تلقائية|اعتماد تلقائي/i },
];

describe("i18n capability truth: no dictionary string overclaims OCR/Autodesk/autonomous-approval", () => {
  for (const [localeName, dictionary] of [["en", en], ["ar", ar]] as const) {
    it(`${localeName} dictionary never overclaims unimplemented capabilities`, () => {
      const allStrings = flattenStrings(dictionary);
      for (const { label, pattern } of FORBIDDEN_CLAIM_PATTERNS) {
        const offenders = allStrings.filter((value) => pattern.test(value));
        expect(offenders, `${localeName} dictionary has a string that ${label}: ${JSON.stringify(offenders)}`).toEqual([]);
      }
    });
  }
});
