import { describe, expect, it } from "vitest";
import {
  calculateExplicitEdgeLengthM,
  separateFurnitureOrderItems,
  type FurnitureOrderCategory,
  type FurnitureOrderItem,
} from "@/lib/furniture/calculations";
import {
  FURNITURE_CANDIDATE_MAPPING_VERSION,
  mapFurnitureCandidateTable,
  type FurnitureCandidateDiscipline,
  type FurnitureSourceCell,
  type FurnitureSourceTable,
} from "@/lib/furniture/candidate-mapper";

function cell(columnKey: string, rawValue: string, reference?: string): FurnitureSourceCell {
  return { columnKey, rawValue, sourceCellReference: reference };
}

function explicitPdfTable(overrides: FurnitureSourceCell[] = []): FurnitureSourceTable {
  const baseCells = [
    cell("room", "KITCHEN", "page:4:table:1:R2C1"),
    cell("elevation_ref", "Elev A", "page:4:table:1:R2C2"),
    cell("cabinet_unit", "Base Cabinet", "page:4:table:1:R2C3"),
    cell("part", "Door Panel", "page:4:table:1:R2C4"),
    cell("quantity", "2", "page:4:table:1:R2C5"),
    cell("width_mm", "600", "page:4:table:1:R2C6"),
    cell("height_mm", "700", "page:4:table:1:R2C7"),
    cell("thickness_mm", "18", "page:4:table:1:R2C8"),
    cell("material", "MDF (finish TBD)", "page:4:table:1:R2C9"),
    cell("edge_banding", "Front edge", "page:4:table:1:R2C10"),
  ];
  const overriddenKeys = new Set(overrides.map((candidate) => candidate.columnKey));
  return {
    title: "Explicit furniture cutting table",
    pageNumber: 4,
    method: "pdf-grid-detection",
    confidence: 65,
    rows: [{
      rowNumber: 2,
      confidence: 62,
      cells: [...baseCells.filter((candidate) => !overriddenKeys.has(candidate.columnKey)), ...overrides],
    }],
  };
}

function mapPdf(
  table: FurnitureSourceTable,
  discipline: FurnitureCandidateDiscipline = "JOINERY_CABINETRY",
  frontEdgeOrientationAssumption?: "WIDTH" | "HEIGHT",
) {
  return mapFurnitureCandidateTable(table, {
    industryEnabled: true,
    discipline,
    sourceKind: "PDF_TABLE",
    sourceFileName: "explicit-furniture-schedule.pdf",
    sourceFileId: "file-controlled-1",
    frontEdgeOrientationAssumption,
  });
}

describe("Furniture candidate mapping core", () => {
  it("is a guarded no-op outside the furniture industry dispatch", () => {
    const result = mapFurnitureCandidateTable(explicitPdfTable(), {
      industryEnabled: false,
      discipline: "JOINERY_CABINETRY",
      sourceKind: "PDF_TABLE",
      sourceFileName: "other-industry.pdf",
    });
    expect(result).toEqual({
      status: "skipped",
      mappingVersion: FURNITURE_CANDIDATE_MAPPING_VERSION,
      reason: "FURNITURE_INDUSTRY_NOT_ENABLED",
      candidates: [],
      hierarchy: null,
    });
  });

  it("maps an existing explicit PDF table without visual OCR or invented evidence", () => {
    const result = mapPdf(explicitPdfTable());
    expect(result.status).toBe("mapped");
    if (result.status !== "mapped") return;
    expect(result.candidates).toHaveLength(1);
    expect(result.hierarchy.rooms[0]).toMatchObject({ kind: "ROOM", label: "KITCHEN" });
    expect(result.hierarchy.rooms[0].elevations[0]).toMatchObject({
      kind: "ELEVATION_REFERENCE",
      label: "Elev A",
    });
    expect(result.hierarchy.rooms[0].elevations[0].assemblies[0]).toMatchObject({
      kind: "ASSEMBLY",
      label: "Base Cabinet",
    });

    const candidate = result.candidates[0];
    expect(candidate.mappingVersion).toBe("furniture-candidate-v1");
    expect(candidate.evidence).toMatchObject({
      sourceKind: "PDF_TABLE",
      method: "pdf-grid-detection",
      sourceFileId: "file-controlled-1",
      pageNumber: 4,
      rowNumber: 2,
      confidence: 62,
    });
    expect(candidate.evidence.sourceCellReferences).toContain("page:4:table:1:R2C6");
    expect(candidate.edgeBanding.selectedEdges).toEqual([]);
    expect(candidate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "EDGE_ORIENTATION_REQUIRES_VERIFICATION", severity: "REVIEW" }),
      expect.objectContaining({ code: "GRAIN_DIRECTION_MISSING", severity: "REVIEW" }),
    ]));
    expect(calculateExplicitEdgeLengthM(candidate)).toBeNull();
  });

  it("preserves missing and conflicting dimension evidence as blocking issues", () => {
    const table = explicitPdfTable([
      cell("width_mm", "600", "page:4:table:1:R2C6"),
      cell("width", "610", "page:4:table:1:R2C11"),
      cell("height_mm", "", "page:4:table:1:R2C7"),
    ]);
    const result = mapPdf(table);
    if (result.status !== "mapped") throw new Error("Furniture table unexpectedly skipped");
    const candidate = result.candidates[0];
    expect(candidate.dimensions.width.hasConflict).toBe(true);
    expect(candidate.dimensions.width.readings.map((reading) => reading.valueMm)).toEqual([600, 610]);
    expect(candidate.dimensions.height.valueMm).toBeNull();
    expect(candidate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DIMENSION_CONFLICT", field: "width" }),
      expect.objectContaining({ code: "MISSING_DIMENSION", field: "height" }),
    ]));
    expect(candidate.verificationStatus).toBe("BLOCKED");
  });

  it("retains an explicit editable front-edge orientation assumption", () => {
    const widthResult = mapPdf(explicitPdfTable(), "JOINERY_CABINETRY", "WIDTH");
    if (widthResult.status !== "mapped") throw new Error("Furniture table unexpectedly skipped");
    expect(widthResult.candidates[0].edgeBanding).toMatchObject({
      mode: "FRONT",
      orientation: "ASSUMED",
      selectedEdges: [{ dimension: "WIDTH", count: 1 }],
    });
    expect(calculateExplicitEdgeLengthM(widthResult.candidates[0])).toBeCloseTo(1.2, 8);

    const allFour = explicitPdfTable([cell("edge_banding", "All 4 edges", "page:4:table:1:R2C10")]);
    const allFourResult = mapPdf(allFour);
    if (allFourResult.status !== "mapped") throw new Error("Furniture table unexpectedly skipped");
    expect(calculateExplicitEdgeLengthM(allFourResult.candidates[0])).toBeCloseTo(5.2, 8);
  });

  it("preserves Furniture versus Joinery discipline selection", () => {
    const furniture = mapPdf(explicitPdfTable(), "FURNITURE");
    const joinery = mapPdf(explicitPdfTable(), "JOINERY_CABINETRY");
    if (furniture.status !== "mapped" || joinery.status !== "mapped") throw new Error("Unexpected guarded skip");
    expect(furniture.candidates[0].discipline).toBe("FURNITURE");
    expect(joinery.candidates[0].discipline).toBe("JOINERY_CABINETRY");
  });

  it("separates explicitly categorized order items without prose inference", () => {
    const categories: FurnitureOrderCategory[] = [
      "BOARD",
      "HARDWARE",
      "STONE_QUARTZ",
      "GLASS_MIRROR",
      "APPLIANCE",
      "ELECTRICAL_ACCESSORY",
      "LED",
      "PROPRIETARY_DRAWER_SYSTEM",
      "SUPPLIED_BY_OTHERS",
      "UNCLASSIFIED",
    ];
    const items: FurnitureOrderItem[] = categories.map((category, index) => ({
      id: `item-${index}`,
      description: category,
      quantity: 1,
      quantityText: "1",
      unit: "item",
      category,
      suppliedByOthers: category === "SUPPLIED_BY_OTHERS",
      notes: null,
    }));
    const separated = separateFurnitureOrderItems(items);
    for (const category of categories) expect(separated[category]).toHaveLength(1);
  });
});
