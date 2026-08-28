import { readFileSync } from "node:fs";
import { QuantityCalculationType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  formatMeasurementMethodSuggestionMarker,
  recommendMeasurementMethod,
} from "../src/lib/calculations/measurement-method-recommender";
import {
  findReusableConfirmedCalculation,
  type DimensionValueState,
} from "../src/components/boq/quantity-calculation-panel";

function recommend(
  label: string,
  overrides: {
    entityType?: string | null;
    sourceText?: string | null;
    unit?: string | null;
  } = {},
) {
  return recommendMeasurementMethod({
    label,
    entityType: overrides.entityType ?? null,
    sourceText: overrides.sourceText ?? null,
    unit: overrides.unit ?? null,
  });
}

describe("normal Quantara measurement method recommendation", () => {
  it("reuses only a confirmed calculation with the same entity, type and deterministic inputs", () => {
    const dimensions: DimensionValueState[] = [{
      key: "verifiedCount",
      label: "Verified Count",
      unit: null,
      required: true,
      value: 1,
      source: "extracted_entity",
      confidence: 100,
      reviewStatus: "PREFILLED",
    }];
    const matching = {
      id: "confirmed-count",
      status: "CONFIRMED",
      calculationType: QuantityCalculationType.COUNT,
      extractedEntityId: "entity-1",
      inputValues: { verifiedCount: 1 },
      resultValue: 1,
      resultUnit: "nr",
      formula: "verifiedCount",
    };

    expect(findReusableConfirmedCalculation(
      [
        { ...matching, id: "wrong-input", inputValues: { verifiedCount: 2 } },
        { ...matching, id: "unconfirmed", status: "EXTRACTED" },
        matching,
      ],
      QuantityCalculationType.COUNT,
      "entity-1",
      dimensions,
    )).toEqual(matching);
    expect(findReusableConfirmedCalculation(
      [matching],
      QuantityCalculationType.COUNT,
      "entity-2",
      dimensions,
    )).toBeNull();
  });

  it("keeps structural type rows as counts instead of guessing concrete volume", () => {
    expect(
      recommend("F1", { sourceText: "reinforced concrete footing schedule" })
        ?.calculationType,
    ).toBe(QuantityCalculationType.COUNT);

    expect(
      recommend("B1", { sourceText: "reinforced concrete beam schedule" })
        ?.calculationType,
    ).toBe(QuantityCalculationType.COUNT);
  });

  it("recommends count for discrete entity types and explicit count units", () => {
    expect(
      recommend("D1", { entityType: "DOOR" })?.calculationType,
    ).toBe(QuantityCalculationType.COUNT);

    expect(
      recommend("Sanitary accessory", { unit: "nr" })?.calculationType,
    ).toBe(QuantityCalculationType.COUNT);

    expect(
      recommend("Supply air diffuser")?.calculationType,
    ).toBe(QuantityCalculationType.COUNT);
  });

  it("routes specialist construction work before generic concrete wording", () => {
    expect(
      recommend("Formwork to concrete footing")?.calculationType,
    ).toBe(QuantityCalculationType.FORMWORK_AREA);

    expect(
      recommend("Reinforcement for concrete footing")?.calculationType,
    ).toBe(QuantityCalculationType.REINFORCEMENT_WEIGHT);

    expect(
      recommend("Excavation for foundations")?.calculationType,
    ).toBe(QuantityCalculationType.EXCAVATION_VOLUME);
  });

  it("routes concrete to the existing volume calculator", () => {
    const result = recommend("C30 reinforced concrete foundation");
    expect(result?.calculationType).toBe(
      QuantityCalculationType.CONCRETE_VOLUME,
    );
    expect(result?.methodFamily).toBe("VOLUME");
    expect(result?.resultUnit).toBe("m3");
  });

  it("routes linear MEP and finish work", () => {
    expect(
      recommend("100mm chilled water pipe")?.calculationType,
    ).toBe(QuantityCalculationType.PIPE_LENGTH);

    expect(
      recommend("Power cable 4C x 25mm")?.calculationType,
    ).toBe(QuantityCalculationType.CABLE_LENGTH);

    expect(
      recommend("Timber skirting")?.calculationType,
    ).toBe(QuantityCalculationType.SKIRTING_LENGTH);
  });

  it("does not treat cable tray as a cable run", () => {
    expect(recommend("Cable tray 300mm")).toBeNull();
    expect(recommend("Cable trays 300mm")).toBeNull();
  });

  it("handles common plural BOQ descriptions", () => {
    expect(
      recommend("Internal doors")?.calculationType,
    ).toBe(QuantityCalculationType.COUNT);

    expect(
      recommend("Supply air diffusers")?.calculationType,
    ).toBe(QuantityCalculationType.COUNT);

    expect(
      recommend("100mm chilled water pipes")?.calculationType,
    ).toBe(QuantityCalculationType.PIPE_LENGTH);

    expect(
      recommend("Power cables")?.calculationType,
    ).toBe(QuantityCalculationType.CABLE_LENGTH);

    expect(
      recommend("Supply air ducts")?.calculationType,
    ).toBe(QuantityCalculationType.DUCT_SURFACE_AREA);

    expect(
      recommend("Gypsum partitions")?.calculationType,
    ).toBe(QuantityCalculationType.PARTITION_AREA);

    expect(
      recommend("Ceiling tiles")?.calculationType,
    ).toBe(QuantityCalculationType.CEILING_AREA);
  });

  it("routes area-based work to the existing calculators", () => {
    expect(
      recommend("Supply air ductwork")?.calculationType,
    ).toBe(QuantityCalculationType.DUCT_SURFACE_AREA);

    expect(
      recommend("Gypsum partition")?.calculationType,
    ).toBe(QuantityCalculationType.PARTITION_AREA);

    expect(
      recommend("Painting to internal walls")?.calculationType,
    ).toBe(QuantityCalculationType.PAINT_AREA);

    expect(
      recommend("False ceiling")?.calculationType,
    ).toBe(QuantityCalculationType.CEILING_AREA);

    expect(
      recommend("Ceramic floor tiles")?.calculationType,
    ).toBe(QuantityCalculationType.FLOOR_AREA);

    expect(
      recommend("Ceramic wall tiles")?.calculationType,
    ).toBe(QuantityCalculationType.WALL_AREA);
  });

  it("returns null instead of inventing a method for an ambiguous item", () => {
    expect(recommend("General works")).toBeNull();
  });

  it("creates a non-schema provenance marker for the recommendation", () => {
    const result = recommend("100mm chilled water pipe");
    expect(result).not.toBeNull();

    expect(
      formatMeasurementMethodSuggestionMarker(result!),
    ).toContain("MEASUREMENT_METHOD_SUGGESTION:PIPE_LENGTH:");
  });

  it("is wired into the existing calculator workflow rather than a second engine", () => {
    const modal = readFileSync(
      "src/components/boq/add-item-from-source-modal.tsx",
      "utf8",
    );
    const aiDraft = readFileSync(
      "src/lib/services/ai-draft-boq-service.ts",
      "utf8",
    );
    const calculationService = readFileSync(
      "src/lib/services/quantity-calculation-service.ts",
      "utf8",
    );

    expect(modal).toContain("QuantityCalculationPanel");
    expect(modal).toContain(
      "extractionMeasurementRecommendation?.calculationType",
    );
    expect(aiDraft).toContain(
      "formatMeasurementMethodSuggestionMarker",
    );
    expect(calculationService).toContain(
      'input.key === "verifiedCount"',
    );

    const calculationPanel = readFileSync(
      "src/components/boq/quantity-calculation-panel.tsx",
      "utf8",
    );
    expect(calculationPanel).toContain(
      "if (reusableCalculation) onConfirmedRef.current?.(reusableCalculation)",
    );
  });
});
