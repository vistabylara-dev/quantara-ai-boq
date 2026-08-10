import { describe, expect, it } from "vitest";
import { buildPageTextExtraction, extractPageTextSignals } from "../src/lib/files/pdf-text-extraction";

describe("drawing text-layer evidence", () => {
  it("preserves floor-plan text and highlights titles, scale, member/reinforcement/measurement lines without claiming spatial detection", () => {
    const text = [
      "LAYOUT OF FIRST FLOOR SLAB",
      "SCALE 1/100",
      "CB CB B1",
      "T&B MESH",
      "T12@15cm",
      "20 T16@15cm L=3.0m",
      "MODIFIED PARAPET",
      "HEIGHT IS 1.3m",
      "ALL DIMENSIONS ARE IN CENTIMETERS",
    ].join("\n");

    const signals = extractPageTextSignals(text);
    expect(signals.drawingTitles).toContain("LAYOUT OF FIRST FLOOR SLAB");
    expect(signals.scales).toContain("SCALE 1/100");
    expect(signals.technicalLines).toContain("T12@15cm");
    expect(signals.technicalLines).toContain("20 T16@15cm L=3.0m");
    expect(signals.technicalLines).toContain("HEIGHT IS 1.3m");

    const extraction = buildPageTextExtraction(text, "00000000-0000-4000-8000-000000000001");
    expect(extraction.text).toBe(text);
    expect(extraction.hasText).toBe(true);
    expect(extraction.ocrStatus).toBe("NOT_APPLICABLE");
  });

  it("keeps image-only pages honest instead of fabricating text", () => {
    const extraction = buildPageTextExtraction("", "00000000-0000-4000-8000-000000000001");
    expect(extraction.hasText).toBe(false);
    expect(extraction.text).toBe("");
    expect(extraction.ocrStatus).toBe("OCR_REQUIRED");
    expect(extraction.signals.technicalLines).toEqual([]);
  });
});
