export const OCR_IMPLEMENTATION_STATUS = "NOT_IMPLEMENTED" as const;

export type PageTextSignals = {
  drawingTitles: string[];
  scales: string[];
  technicalLines: string[];
};

export type PageTextExtraction = {
  extractionMethod: "pdf-text-layer";
  sourceProjectFileId: string;
  hasText: boolean;
  text: string;
  normalizedText: string;
  characterCount: number;
  ocrStatus: "NOT_APPLICABLE" | "OCR_REQUIRED";
  signals: PageTextSignals;
};

export type PdfContentClassification = "TEXT_LAYER" | "SCANNED_IMAGE" | "MIXED" | "UNKNOWN";

export function normalizeExtractedText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function uniqueLimited(values: string[], limit: number): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

export function extractPageTextSignals(rawText: string): PageTextSignals {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const drawingTitles = uniqueLimited(
    lines.filter((line) =>
      /^(?:LAYOUT OF|DETAILS? OF|DETAIL OF|TYPICAL SECTION|SECTION\b|SEC\b|SCHEDULE OF)/i.test(line)
    ),
    30,
  );

  const scales = uniqueLimited(
    lines.filter((line) => /\bSCALE\s*:?\s*\d+\s*(?::|\/)\s*\d+\b/i.test(line)),
    20,
  );

  const technicalLines = uniqueLimited(
    lines.filter((line) =>
      /\d+\s*[xX×]\s*\d+/i.test(line)
      || /\bT\d+\b/i.test(line)
      || /\d+\s*T\s*\d+/i.test(line)
      || /@\s*\d+(?:\.\d+)?\s*(?:cm|mm|m)\b/i.test(line)
      || /\b\d+(?:\.\d+)?\s*(?:mm|cm|m|m2|m3|kN|N\/mm2)\b/i.test(line)
      || /\b(?:TB|CB|STB|B|C|F)\d+\*?\b/i.test(line)
    ),
    120,
  );

  return { drawingTitles, scales, technicalLines };
}

export function buildPageTextExtraction(rawText: string, sourceProjectFileId: string): PageTextExtraction {
  const normalizedText = normalizeExtractedText(rawText);
  const hasText = normalizedText.length > 0;
  return {
    extractionMethod: "pdf-text-layer",
    sourceProjectFileId,
    hasText,
    text: rawText,
    normalizedText,
    characterCount: normalizedText.length,
    ocrStatus: hasText ? "NOT_APPLICABLE" : "OCR_REQUIRED",
    signals: extractPageTextSignals(rawText),
  };
}

export function classifyPdfContent(pages: Array<{ hasText: boolean | null | undefined }>): PdfContentClassification {
  if (pages.length === 0 || pages.some((page) => page.hasText == null)) return "UNKNOWN";
  const withText = pages.filter((page) => page.hasText === true).length;
  if (withText === 0) return "SCANNED_IMAGE";
  if (withText === pages.length) return "TEXT_LAYER";
  return "MIXED";
}
