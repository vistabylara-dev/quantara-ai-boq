import { readFileSync } from "node:fs";
import path from "node:path";
import { QuantityCalculationType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  AutonomousCategorizationBindingError,
  categorizeDrawingSheets,
  requireMeasurementCategoryBinding,
  type CategorizerPageInput,
  type CategorizerPolicyRule,
} from "../src/lib/autonomous-boq/drawing-categorizer";

const fixture = JSON.parse(readFileSync(path.resolve(__dirname, "fixtures/autonomous-boq/drawing-categorization.json"), "utf8")) as Record<string, CategorizerPageInput[]>;

const rules: CategorizerPolicyRule[] = [
  { id: "foundation-concrete", sectionCode: "FOUNDATIONS", title: "Foundations", calculationType: QuantityCalculationType.CONCRETE_VOLUME, resultUnit: "m3" },
  { id: "electrical-point-count", sectionCode: "LIGHTING", title: "Lighting", calculationType: QuantityCalculationType.COUNT, resultUnit: "points" },
  { id: "mep-duct-surface", sectionCode: "MECHANICAL", title: "Mechanical", calculationType: QuantityCalculationType.DUCT_SURFACE_AREA, resultUnit: "m2" },
  { id: "floor-finish-area", sectionCode: "FLOORING", title: "Flooring", calculationType: QuantityCalculationType.FLOOR_AREA, resultUnit: "m2" },
];

describe("drawing and BOQ categorization engine", () => {
  it("classifies sheet type from content/title-block signals and supersedes older revisions", () => {
    const result = categorizeDrawingSheets({ engineId: "construction", pages: fixture.construction!, rules });
    expect(result[0]).toMatchObject({ status: "SUPERSEDED", supersededByPageId: "page-foundation-r2", scopeDisposition: "EXISTING" });
    expect(result[1]).toMatchObject({ status: "VERIFIED", revision: "R2", scopeDisposition: "PROPOSED" });
    expect(result[1]!.categoryPaths[0]).toMatchObject({ discipline: "Structural", drawingType: "Foundation plan", measurementRuleId: "foundation-concrete", unit: "m3" });
    expect(result[1]!.supportingEvidence.length).toBeGreaterThan(0);
  });

  it("separates multiple disciplines inside one drawing package and binds symbols/schedules to controlled rules", () => {
    const result = categorizeDrawingSheets({ engineId: "mep", pages: fixture.mep!, rules });
    expect(result.map((sheet) => sheet.categoryPaths[0]?.discipline)).toEqual(["Electrical", "Mechanical"]);
    expect(result[0]!.categoryPaths[0]).toMatchObject({ boqItemClassification: "LED downlight", measurementMethod: "COUNT", measurementRuleId: "electrical-point-count" });
    expect(result[1]!.categoryPaths[0]).toMatchObject({ boqItemClassification: "Rectangular duct", measurementMethod: "AREA", measurementRuleId: "mep-duct-surface" });
  });

  it("binds finish classification to the BOQ section and deterministic measurement rule", () => {
    const [sheet] = categorizeDrawingSheets({ engineId: "interior-fitout", pages: fixture.fitout!, rules });
    expect(sheet?.categoryPaths[0]).toMatchObject({ workPackage: "Finishes", boqSectionCode: "FLOORING", measurementRuleId: "floor-finish-area", unit: "m2" });
  });

  it("routes uncertain or excluded scope to review rather than accepting a measurement", () => {
    const [sheet] = categorizeDrawingSheets({ engineId: "interior-fitout", pages: [{ ...fixture.fitout![0]!, text: "OPTIONAL FLOOR FINISH PLAN", technicalLines: ["FINISH TO BE CONFIRMED"] }], rules });
    expect(sheet?.scopeDisposition).toBe("OPTIONAL");
    expect(() => requireMeasurementCategoryBinding({ workPackage: "floor-finish-area", evidencePageIds: [sheet!.pageId], classificationsByPageId: new Map([[sheet!.pageId, sheet!]]) })).toThrow(AutonomousCategorizationBindingError);
  });

  it("uses the specialized Joinery category path without the generic assembly stop", () => {
    const [sheet] = categorizeDrawingSheets({ engineId: "joinery", pages: fixture.joinery!, rules: [] });
    expect(sheet).toMatchObject({ status: "VERIFIED" });
    expect(sheet?.categoryPaths[0]).toMatchObject({ discipline: "Joinery", measurementRuleId: "specialized-sheet-optimization", measurementMethod: "OPTIMIZED_SHEET_QUANTITY", unit: "sheet" });
  });

  it("binds a verified Joinery unit schedule to the protected pre-assembly count rule", () => {
    const joineryRules: CategorizerPolicyRule[] = [{
      id: "joinery-unit-count",
      sectionCode: "full-cutting-list-all-rooms",
      title: "Full cutting list — all rooms",
      calculationType: QuantityCalculationType.COUNT,
      resultUnit: "pcs",
    }];
    const [sheet] = categorizeDrawingSheets({
      engineId: "joinery",
      pages: [{ ...fixture.joinery![0]!, text: "CABINET UNIT / JOINERY UNIT SCHEDULE / UNIT MULTIPLICITY" }],
      rules: joineryRules,
    });
    expect(requireMeasurementCategoryBinding({
      workPackage: "joinery-unit-count",
      evidencePageIds: [sheet!.pageId],
      classificationsByPageId: new Map([[sheet!.pageId, sheet!]]),
    })).toMatchObject({ measurementRuleId: "joinery-unit-count", unit: "pcs" });
  });

  it("does not use filenames as a substitute for drawing understanding", () => {
    const [sheet] = categorizeDrawingSheets({ engineId: "mep", pages: [{ ...fixture.mep![0]!, drawingTitle: null, sheetName: null, drawingTitles: [], technicalLines: [], text: null, projectFileId: "lighting-layout-file-name-only.pdf" }], rules });
    expect(sheet).toMatchObject({ status: "UNRESOLVED", confidence: 0, categoryPaths: [] });
  });
});
