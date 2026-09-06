import { describe, expect, it, vi } from "vitest";
import { createDeterministicMeasurementReasoner } from "../src/lib/autonomous-boq/deterministic-measurement-reasoner";

const PAGE_ID = "40000000-0000-4000-8000-000000000001";
const FILE_ID = "40000000-0000-4000-8000-000000000002";
const ENTITY_ID = "40000000-0000-4000-8000-000000000003";

function bundle() {
  return {
    project: {
      id: "40000000-0000-4000-8000-000000000004",
      slug: "joinery-test",
      name: "Joinery Test",
      reference: "JT-01",
    },
    governingContext: {
      projectCategory: "Joinery",
      categoryScope: "Selected project industry: joinery",
      measurementStandard: null,
      exclusions: null,
      deadlineText: null,
      specialInstructions: null,
      pricingBasis: "Unpriced BOQ",
      authoritativeSourcePolicy: "Frozen source",
      industryPolicy: {
        engineId: "joinery",
        key: "joinery",
        name: "Joinery",
        policyVersion: "test",
        configurationHash: "a".repeat(64),
        supportedUnits: ["pcs"],
        sections: [{ code: "JNR", title: "Joinery" }],
        supportedCalculationTypes: ["COUNT"],
        rules: [{
          id: "joinery-unit-count",
          sectionCode: "JNR",
          title: "Verified joinery unit multiplicity",
          calculationType: "COUNT",
          resultUnit: "pcs",
        }],
      },
    },
    sourceFileIds: [FILE_ID],
    pages: [{
      id: PAGE_ID,
      projectFileId: FILE_ID,
      originalName: "joinery.pdf",
      pageNumber: 1,
      drawingNumber: "J-101",
      drawingTitle: "Joinery Schedule",
      revisionNumber: "R01",
      discipline: "JOINERY",
      drawingType: "SCHEDULE",
      sheetName: "J-101",
      role: "SCHEDULE",
      width: 1000,
      height: 1000,
      dpi: 150,
      text: "Type J01 quantity 4",
      drawingTitles: ["Joinery Schedule"],
      technicalLines: ["J01 4"],
      detectedScale: null,
      scaleVerified: false,
      scaleRatio: null,
      drawingUnit: null,
      realWorldUnit: null,
      hasImage: true,
      classification: {
        pageId: PAGE_ID,
        projectFileId: FILE_ID,
        pageNumber: 1,
        sheetNumber: "J-101",
        drawingNumber: "J-101",
        revision: "R01",
        maturity: "CONSTRUCTION",
        status: "VERIFIED",
        categoryPaths: [{
          discipline: "JOINERY",
          workPackage: "joinery-unit-count",
          location: null,
        }],
      },
    }],
    existingEntities: [{
      id: ENTITY_ID,
      projectFileId: FILE_ID,
      drawingPageId: PAGE_ID,
      entityType: "FURNITURE",
      label: "J01 base cabinet",
      quantity: 4,
      unit: "pcs",
      confidence: 96,
      status: "EXTRACTED",
      sourceText: "J01 base cabinet qty 4",
      sourceReference: "J-101",
      technicalData: {
        calculationType: "COUNT",
        categoryPath: { workPackage: "joinery-unit-count" },
      },
      extractionMethod: "TABLE_PARSER",
    }],
    rooms: [],
    existingBoqItems: [],
  } as never;
}

describe("deterministic core estimator", () => {
  it("routes extracted evidence to registered formulas without loading an AI image", async () => {
    const loadPageImageDataUrl = vi.fn();
    const result = await createDeterministicMeasurementReasoner()({
      bundle: bundle(),
      loadPageImageDataUrl,
    });

    expect(loadPageImageDataUrl).not.toHaveBeenCalled();
    expect(result.provider).toBe("quantara-deterministic");
    expect(result.responseIds).toEqual([]);
    expect(result.plan.subjects).toEqual([
      expect.objectContaining({
        existingEntityId: ENTITY_ID,
        workPackage: "joinery-unit-count",
        calculationType: "COUNT",
        inputs: [expect.objectContaining({ key: "verifiedCount", value: 4 })],
      }),
    ]);
  });

  it("never invents missing dimensions", async () => {
    const input = bundle() as any;
    input.existingEntities[0].quantity = null;
    const result = await createDeterministicMeasurementReasoner()({
      bundle: input,
      loadPageImageDataUrl: vi.fn(),
    });

    expect(result.plan.subjects).toHaveLength(0);
    expect(result.plan.exceptions[0]).toEqual(expect.objectContaining({
      kind: "INSUFFICIENT_EVIDENCE",
      relatedEntityId: ENTITY_ID,
    }));
  });

  it("binds the controlled category path by measurementRuleId rather than its human work-package label", async () => {
    const input = bundle() as any;
    input.existingEntities[0].technicalData = {
      categoryPath: {
        workPackage: "Human-readable furniture package",
        measurementRuleId: "joinery-unit-count",
        calculationType: "COUNT",
      },
    };
    const result = await createDeterministicMeasurementReasoner()({ bundle: input, loadPageImageDataUrl: vi.fn() });
    expect(result.plan.subjects[0]).toEqual(expect.objectContaining({
      workPackage: "joinery-unit-count",
      calculationType: "COUNT",
    }));
  });

  it("blocks reinforcement when neither a schedule weight nor the complete bar calculation exists", async () => {
    const input = bundle() as any;
    input.governingContext.industryPolicy.rules = [{
      id: "structural-reinforcement", sectionCode: "CON", title: "Reinforcement",
      calculationType: "REINFORCEMENT_WEIGHT", resultUnit: "kg",
    }];
    input.existingEntities[0].technicalData = {
      categoryPath: { measurementRuleId: "structural-reinforcement", calculationType: "REINFORCEMENT_WEIGHT" },
      barLength: 120,
    };
    const result = await createDeterministicMeasurementReasoner()({ bundle: input, loadPageImageDataUrl: vi.fn() });
    expect(result.plan.subjects).toHaveLength(0);
    expect(result.plan.exceptions[0]?.message).toContain("unit weight per metre");
  });
});
