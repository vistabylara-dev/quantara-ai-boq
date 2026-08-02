import arabicReshaper from "arabic-reshaper";
import bidiFactory from "bidi-js";

const bidi = bidiFactory();

// Arabic block, Arabic Supplement, and the Presentation Forms produced by
// the reshaper (arabic-reshaper maps logical Arabic letters onto these).
const ARABIC_RANGE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export function isArabicChar(char: string): boolean {
  return ARABIC_RANGE.test(char);
}

export type ScriptRun = { text: string; arabic: boolean };

/**
 * Splits an already-shaped, visually-reordered string into contiguous runs
 * of Arabic-presentation-form characters vs everything else, so the PDF
 * generator can switch fonts per run (the embedded Arabic font has no Latin
 * digit/punctuation glyphs, and Helvetica has no Arabic glyphs).
 */
export function splitScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  let current = "";
  let currentIsArabic: boolean | null = null;

  for (const char of text) {
    const arabic = isArabicChar(char);
    // Spaces and neutral punctuation attach to whichever run they're in.
    const effectiveArabic: boolean = char === " " ? currentIsArabic ?? arabic : arabic;
    if (currentIsArabic === null || effectiveArabic === currentIsArabic) {
      current += char;
      currentIsArabic = currentIsArabic ?? effectiveArabic;
    } else {
      runs.push({ text: current, arabic: Boolean(currentIsArabic) });
      current = char;
      currentIsArabic = effectiveArabic;
    }
  }
  if (current) runs.push({ text: current, arabic: Boolean(currentIsArabic) });
  return runs;
}

/**
 * Shapes Arabic letters into their correct positional presentation forms
 * (initial/medial/final/isolated) based on logical adjacency, then reorders
 * the result into left-to-right visual order so a naive LTR glyph-drawing
 * engine (pdfkit does no bidi analysis of its own) renders it correctly.
 * Must be called on the original logical-order string — reshaping depends
 * on reading-order neighbors, not visual-order neighbors.
 */
export function toVisualArabic(text: string): string {
  const shaped: string = arabicReshaper.convertArabic(text);
  const embeddingLevels = bidi.getEmbeddingLevels(shaped);
  return bidi.getReorderedString(shaped, embeddingLevels);
}
