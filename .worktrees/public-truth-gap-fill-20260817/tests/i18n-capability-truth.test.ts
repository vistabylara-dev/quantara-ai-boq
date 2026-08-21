import { describe, expect, it } from "vitest";
import ar from "../src/lib/i18n/dictionaries/ar";
import en from "../src/lib/i18n/dictionaries/en";

/**
 * ARABIC-RTL-LOCALIZATION — TEST 7: capability truth. Translation must
 * never accidentally upgrade a real, honest "not implemented yet" claim
 * into wording that implies automatic OCR, automatic Autodesk/Revit/AutoCAD
 * extraction, or autonomous professional approval — none of which this
 * product does. Controlled Autodesk metadata extraction is implemented, so
 * the guard targets unattended geometry/takeoff claims rather than truthful
 * availability, error, or empty-account messages.
 */

function flattenStrings(node: unknown): string[] {
  if (typeof node === "string") {
    if (/^[{[]/.test(node.trim())) {
      try {
        return flattenStrings(JSON.parse(node));
      } catch {
        // Ordinary prose may begin with punctuation; keep it as one leaf.
      }
    }
    return [node];
  }
  if (node && typeof node === "object") {
    return Object.values(node as Record<string, unknown>).flatMap(flattenStrings);
  }
  return [];
}

const FORBIDDEN_CLAIM_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "implies OCR is performed automatically", pattern: /\bocr\b.*(implement|perform|automatic|available)|(?:يتم|تُنفَّذ|متاحة).{0,20}\bocr\b/i },
  { label: "implies Autodesk/Revit/AutoCAD unattended geometry extraction", pattern: /(autodesk|revit|autocad).{0,50}(automatic|autonomous|unattended).{0,30}(geometry|takeoff|extract)|(?:أوتوديسك|ريفيت|أوتوكاد).{0,50}(تلقائي|ذاتي).{0,30}(هندس|حصر|استخراج)/i },
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
