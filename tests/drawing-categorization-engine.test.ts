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
import { buildPreliminaryConceptSchedule } from "../src/lib/autonomous-boq/concept-schedule";

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
      pages: [{ ...fixture.joinery![0]!, text: "ISSUED FOR CONSTRUCTION / CABINET UNIT / JOINERY UNIT SCHEDULE / UNIT MULTIPLICITY" }],
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

  it("keeps a verified architectural category separate from non-payable concept maturity", () => {
    const conceptRules: CategorizerPolicyRule[] = [{ id: "gross-floor-area", sectionCode: "ARE", title: "Measured Areas", calculationType: QuantityCalculationType.FLOOR_AREA, resultUnit: "m2" }];
    const [sheet] = categorizeDrawingSheets({
      engineId: "construction",
      rules: conceptRules,
      pages: [{ ...fixture.construction![1]!, drawingTitle: "Concept Area Schedule", text: "NOT FOR CONSTRUCTION. GROSS FLOOR AREA: 1,250 m2. OPTION T. OPTION L.", drawingTitles: ["ARCHITECTURAL GROSS FLOOR AREA"] }],
    });
    expect(sheet).toMatchObject({ status: "VERIFIED", maturity: "CONCEPT_BASIS_OF_DESIGN", payableStatus: "NOT_PAYABLE_CONCEPT" });
    expect(sheet?.categoryPaths[0]).toMatchObject({ discipline: "Architectural", measurementRuleId: "gross-floor-area" });
    expect(() => requireMeasurementCategoryBinding({ workPackage: "gross-floor-area", evidencePageIds: [sheet!.pageId], classificationsByPageId: new Map([[sheet!.pageId, sheet!]]) })).toThrow(/not eligible for a payable BOQ/);

    const schedule = buildPreliminaryConceptSchedule([{ ...sheet!, id: sheet!.pageId, classification: sheet, originalName: "concept.pdf", revisionNumber: sheet!.revision, drawingTitle: "Concept Area Schedule", sheetName: "A-001", role: "PLAN", width: null, height: null, dpi: null, text: "NOT FOR CONSTRUCTION. GROSS FLOOR AREA: 1,250 m2. OPTION T. OPTION L.", drawingTitles: ["ARCHITECTURAL GROSS FLOOR AREA"], technicalLines: [], detectedScale: null, scaleVerified: false, scaleRatio: null, drawingUnit: null, realWorldUnit: null, hasImage: true } as never]);
    expect(schedule).toMatchObject({ payable: false, alternatives: ["Scheme L", "Scheme T"] });
    expect(schedule?.metrics).toEqual([expect.objectContaining({ label: "GROSS FLOOR AREA", value: 1250, unit: "m2" })]);
  });

  it("classifies an explicit IFC architectural schedule as payable and rate-ready eligible", () => {
    const architecturalRules: CategorizerPolicyRule[] = [{ id: "door-window-count", sectionCode: "OPN", title: "Doors and Windows", calculationType: QuantityCalculationType.COUNT, resultUnit: "nos" }];
    const [sheet] = categorizeDrawingSheets({ engineId: "construction", rules: architecturalRules, pages: [{ ...fixture.construction![1]!, drawingTitle: "Door Schedule", text: "ISSUED FOR CONSTRUCTION. DOOR SCHEDULE. DOOR AND WINDOW SCHEDULE.", drawingTitles: ["ARCHITECTURAL DOOR SCHEDULE"] }] });
    expect(sheet).toMatchObject({ status: "VERIFIED", maturity: "IFC_CONSTRUCTION", payableStatus: "PAYABLE_ELIGIBLE" });
    expect(requireMeasurementCategoryBinding({ workPackage: "door-window-count", evidencePageIds: [sheet!.pageId], classificationsByPageId: new Map([[sheet!.pageId, sheet!]]) })).toMatchObject({ unit: "nos" });
  });

  it("classifies the rendered valid Construction fixture into payable measurement rules", () => {
    const constructionRules: CategorizerPolicyRule[] = [
      { id: "gross-floor-area", sectionCode: "AREA", title: "Gross floor area", calculationType: QuantityCalculationType.FLOOR_AREA, resultUnit: "m2" },
      { id: "net-floor-area", sectionCode: "AREA", title: "Net floor area", calculationType: QuantityCalculationType.FLOOR_AREA, resultUnit: "m2" },
      { id: "room-schedule-count", sectionCode: "SPACE", title: "Room schedule", calculationType: QuantityCalculationType.COUNT, resultUnit: "nos" },
      { id: "door-window-count", sectionCode: "OPENINGS", title: "Doors and windows", calculationType: QuantityCalculationType.COUNT, resultUnit: "nos" },
      { id: "construction-partition-area", sectionCode: "PARTITIONS", title: "Partitions", calculationType: QuantityCalculationType.PARTITION_AREA, resultUnit: "m2" },
    ];
    const pages: CategorizerPageInput[] = [{
      id: "ifc-page-1", projectFileId: "ifc-file", pageNumber: 1, drawingNumber: "A-101", revisionNumber: "R02",
      drawingTitle: null, sheetName: null, drawingTitles: [], technicalLines: [],
      text: "ISSUED FOR CONSTRUCTION IFC GROUND FLOOR PLAN AND AREA SCHEDULE GROSS FLOOR AREA GFA 78.00 m2 NET FLOOR AREA NFA 72.00 m2 ROOM SCHEDULE ROOM COUNT 3",
    }, {
      id: "ifc-page-2", projectFileId: "ifc-file", pageNumber: 2, drawingNumber: "A-601", revisionNumber: "R02",
      drawingTitle: null, sheetName: null, drawingTitles: [], technicalLines: [],
      text: "ISSUED FOR CONSTRUCTION IFC ARCHITECTURAL SCHEDULES DOOR SCHEDULE WINDOW SCHEDULE DOOR AND WINDOW SCHEDULE PARTITION SCHEDULE PARTITION TYPE",
    }];

    const classified = categorizeDrawingSheets({ engineId: "construction", pages, rules: constructionRules });

    expect(classified).toHaveLength(2);
    expect(classified.every((sheet) => sheet.status === "VERIFIED" && sheet.payableStatus === "PAYABLE_ELIGIBLE")).toBe(true);
    expect(classified.flatMap((sheet) => sheet.categoryPaths).map((path) => path.measurementRuleId)).toEqual(expect.arrayContaining([
      "gross-floor-area", "net-floor-area", "room-schedule-count", "door-window-count", "construction-partition-area",
    ]));
  });
});
