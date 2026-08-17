import { describe, expect, it } from "vitest";
import {
  applyAiMeasurementSuggestion,
  countExactDrawingLabel,
  formatAiMeasurementSuggestionMarker,
  hasAiMeasurementSuggestion,
  inferAiDraftMeasurement,
  type AiMeasurementCandidate,
  type AiMeasurementEvidencePage,
} from "../src/lib/guidance/ai-measurement-inference";

function candidate(
  label: string,
  rawData: Record<string, unknown> = {},
  overrides: Partial<AiMeasurementCandidate> = {},
): AiMeasurementCandidate {
  return {
    id: `entity-${label}`,
    entityType: "SCHEDULE_ROW",
    label,
    quantity: null,
    unit: null,
    confidence: 50,
    sourceText: null,
    status: "NEEDS_REVIEW",
    technicalDataJson: { rawData },
    ...overrides,
  };
}

const footingLayout: AiMeasurementEvidencePage = {
  projectFileId: "file-1",
  pageNumber: 4,
  drawingTitles: ["LAYOUT OF FOOTING"],
  text: [
    "MODIFICATION IN EXIST G+1 FLOOR VILLA",
    "LAYOUT OF FOOTING",
    "F1 94 766 844 284",
    "F1",
    "F3",
    "F2*",
    "F1",
    "F4",
    "F3",
    "F4 STB2",
    "531 F5",
    "F2*",
    "F6 F6 229 141",
    "F6 F6",
  ].join("\n"),
};

const slabLayout: AiMeasurementEvidencePage = {
  projectFileId: "file-1",
  pageNumber: 2,
  drawingTitles: ["LAYOUT OF FIRST FLOOR SLAB"],
  text: [
    "LAYOUT OF FIRST FLOOR SLAB",
    "CB CB B1",
    "B1 B1",
    "CB B1 CB",
    "PROPOSED PARAPET HEIGHT IS 0.50m INV.B1",
  ].join("\n"),
};

const tieBeamLayout: AiMeasurementEvidencePage = {
  projectFileId: "file-1",
  pageNumber: 3,
  drawingTitles: ["LAYOUT OF TIE BEAM"],
  text: [
    "LAYOUT OF TIE BEAM",
    "TB1",
    "TB1",
    "TB1 TB1",
  ].join("\n"),
};

describe("AI measurement inference", () => {
  it("counts exact structural type labels instead of substring matches", () => {
    expect(countExactDrawingLabel("F1 F10 F1 F1A", "F1")).toBe(2);
    expect(countExactDrawingLabel("F2* F2 F2*", "F2*")).toBe(2);
  });

  it("infers F1 count and normalizes footing dimensions from cm without changing the source entity", () => {
    const source = candidate("F1", {
      r_c_c_dimensions_cm_l: "160",
      r_c_c_dimensions_cm_b: "120",
      r_c_c_dimensions_cm_d: "35",
    });

    const suggestion = inferAiDraftMeasurement(source, [footingLayout]);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.quantity).toBe(3);
    expect(suggestion?.unit).toBe("nr");
    expect(suggestion?.method).toBe("EXACT_LAYOUT_LABEL_COUNT");
    expect(suggestion?.normalizedDimensions).toMatchObject({
      kind: "FOOTING",
      lengthM: 1.6,
      widthM: 1.2,
      depthM: 0.35,
      volumePerUnitM3: 0.672,
      totalVolumeM3: 2.016,
    });
    expect(suggestion?.scopeCaution).toContain("Modification");
    expect(source.quantity).toBeNull();
    expect(source.unit).toBeNull();

    const draftCandidate = applyAiMeasurementSuggestion(source, suggestion);
    expect(draftCandidate.quantity).toBe(3);
    expect(draftCandidate.unit).toBe("nr");
  });

  it("handles starred footing labels and repeated footing occurrences", () => {
    const f2Star = inferAiDraftMeasurement(
      candidate("F2*", {
        r_c_c_dimensions_cm_l: "220",
        r_c_c_dimensions_cm_b: "180",
        r_c_c_dimensions_cm_d: "40",
      }),
      [footingLayout],
    );
    const f6 = inferAiDraftMeasurement(
      candidate("F6", {
        r_c_c_dimensions_cm_l: "180",
        r_c_c_dimensions_cm_b: "110",
        r_c_c_dimensions_cm_d: "40",
      }),
      [footingLayout],
    );

    expect(f2Star?.quantity).toBe(2);
    expect(f6?.quantity).toBe(4);
  });

  it("infers beam/tie-beam segment counts only from their matching layout pages", () => {
    const b1 = inferAiDraftMeasurement(
      candidate("B1", { dimensions_cm: "20 X 80" }),
      [footingLayout, slabLayout, tieBeamLayout],
    );
    const tb1 = inferAiDraftMeasurement(
      candidate("TB1", { dimensions_cm: "20 X 60" }),
      [footingLayout, slabLayout, tieBeamLayout],
    );

    expect(b1?.quantity).toBe(4);
    expect(b1?.normalizedDimensions).toMatchObject({
      kind: "BEAM_SECTION",
      widthM: 0.2,
      depthM: 0.8,
    });
    expect(tb1?.quantity).toBe(4);
  });

  it("does not create a count from a schedule page when no matching layout exists", () => {
    const scheduleOnly: AiMeasurementEvidencePage = {
      projectFileId: "file-1",
      pageNumber: 1,
      drawingTitles: ["SCHEDULE OF FOOTING"],
      text: "SCHEDULE OF FOOTING\nF1 160 120 35",
    };
    expect(
      inferAiDraftMeasurement(
        candidate("F1", {
          r_c_c_dimensions_cm_l: "160",
          r_c_c_dimensions_cm_b: "120",
          r_c_c_dimensions_cm_d: "35",
        }),
        [scheduleOnly],
      ),
    ).toBeNull();
  });

  it("suggests nr for a countable extracted entity that already has a positive quantity but no unit", () => {
    const suggestion = inferAiDraftMeasurement(
      candidate("D1", {}, {
        entityType: "DOOR",
        quantity: 8,
        unit: null,
      }),
      [],
    );
    expect(suggestion).toMatchObject({
      quantity: 8,
      unit: "nr",
      method: "COUNTABLE_ENTITY_UNIT",
    });
  });

  it("never replaces a complete extracted measurement", () => {
    expect(
      inferAiDraftMeasurement(
        candidate("F1", {}, { quantity: 3, unit: "nr" }),
        [footingLayout],
      ),
    ).toBeNull();
  });

  it("marks AI measurement provenance in the existing sourceReference string", () => {
    const suggestion = inferAiDraftMeasurement(
      candidate("F1", {
        r_c_c_dimensions_cm_l: "160",
        r_c_c_dimensions_cm_b: "120",
        r_c_c_dimensions_cm_d: "35",
      }),
      [footingLayout],
    );
    expect(suggestion).not.toBeNull();
    const marker = formatAiMeasurementSuggestionMarker(suggestion!);
    expect(marker).toContain("AI_MEASUREMENT_SUGGESTION:EXACT_LAYOUT_LABEL_COUNT:3:nr:P4");
    expect(hasAiMeasurementSuggestion(`source | ${marker}`)).toBe(true);
    expect(hasAiMeasurementSuggestion("source only")).toBe(false);
  });
});