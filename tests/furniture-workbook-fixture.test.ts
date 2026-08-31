import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  calculateDerivedFurnitureHardware,
  calculateFurnitureBoardGroups,
  calculateFurnitureEdgeBanding,
} from "@/lib/furniture/calculations";
import type { FurniturePartCandidate } from "@/lib/furniture/candidate-mapper";
import { mapFurnitureWorkbookCandidates, type FurnitureWorkbookReadResult } from "@/lib/furniture/workbook-reader";

const FIXTURE_PATH = path.join(process.cwd(), "tests", "fixtures", "furniture", "Madam_Juli_BOQ_Cutting_List.xlsx");
const FIXTURE_SHA256 = "61b064f7611bc938810125916ff9950aa8fbe5811f55284118f70a18a1596c09";

describe("Furniture workbook fixture — Madam Juli deterministic reconciliation", () => {
  let source: Buffer;
  let workbook: FurnitureWorkbookReadResult;
  let candidates: FurniturePartCandidate[];

  beforeAll(async () => {
    source = await readFile(FIXTURE_PATH);
    const result = await mapFurnitureWorkbookCandidates(source, {
      industryEnabled: true,
      discipline: "JOINERY_CABINETRY",
      sourceFileName: "Madam_Juli_BOQ_Cutting_List.xlsx",
      frontEdgeOrientationAssumption: "WIDTH",
    });
    workbook = result.workbook;
    if (result.mapping.status !== "mapped") throw new Error("Furniture fixture unexpectedly skipped");
    candidates = result.mapping.candidates;
  });

  it("keeps the exact five-sheet source binary as a supported fixture", () => {
    expect(createHash("sha256").update(source).digest("hex")).toBe(FIXTURE_SHA256);
    expect(workbook.sheetNames).toEqual([
      "Overview",
      "Board & Sheet Material BOQ",
      "Hardware & Accessories BOQ",
      "Cutting List",
      "Notes & Assumptions",
    ]);
  });

  it("maps 155 source rows into the required room/elevation/assembly/part hierarchy", () => {
    expect(candidates).toHaveLength(155);
    expect(candidates.reduce((sum, candidate) => sum + (candidate.quantity ?? 0), 0)).toBe(209);

    const panelsByRoom = Object.fromEntries(
      ["KITCHEN", "LAUNDRY", "PANTRY"].map((room) => [
        room,
        candidates
          .filter((candidate) => candidate.room === room)
          .reduce((sum, candidate) => sum + (candidate.quantity ?? 0), 0),
      ]),
    );
    expect(panelsByRoom).toEqual({ KITCHEN: 129, LAUNDRY: 52, PANTRY: 28 });

    const hierarchy = (() => {
      const mapped = candidates[0];
      expect(mapped.evidence.sheetName).toBe("Cutting List");
      expect(mapped.evidence.rowNumber).toBe(5);
      expect(mapped.evidence.confidence).toBeNull();
      expect(mapped.evidence.sourceCellReferences).toContain("Cutting List!A5");
      return new Set(candidates.map((candidate) => candidate.assemblyGroupKey));
    })();
    expect(hierarchy.size).toBe(30);
  });

  it("treats explicit multiplicity as count-only metadata: 30 grouped keys become 33 effective units", async () => {
    const result = await mapFurnitureWorkbookCandidates(source, {
      industryEnabled: true,
      discipline: "JOINERY_CABINETRY",
      sourceFileName: "Madam_Juli_BOQ_Cutting_List.xlsx",
      frontEdgeOrientationAssumption: "WIDTH",
    });
    if (result.mapping.status !== "mapped") throw new Error("Furniture fixture unexpectedly skipped");
    expect(result.mapping.hierarchy.groupedAssemblyCount).toBe(30);
    expect(result.mapping.hierarchy.effectiveAssemblyCount).toBe(33);

    const assemblies = result.mapping.hierarchy.rooms.flatMap((room) =>
      room.elevations.flatMap((elevation) => elevation.assemblies));
    expect(assemblies.find((assembly) => assembly.label.includes("3 sections"))?.explicitMultiplicity).toBe(3);
    expect(assemblies.find((assembly) => assembly.label.includes("flanking W/D"))?.explicitMultiplicity).toBe(2);
    expect(assemblies.find((assembly) => assembly.label.includes("2x pull-out drawers"))?.explicitMultiplicity).toBe(1);
    expect(candidates.reduce((sum, candidate) => sum + (candidate.quantity ?? 0), 0)).toBe(209);
  });

  it("reconciles doors, drawer fronts and shelves from part quantities", () => {
    const quantityForPart = (part: string) => candidates
      .filter((candidate) => candidate.part === part)
      .reduce((sum, candidate) => sum + (candidate.quantity ?? 0), 0);
    expect(quantityForPart("Door Panel")).toBe(21);
    expect(quantityForPart("Drawer Front Panel")).toBe(12);
    expect(quantityForPart("Adjustable Shelf")).toBe(39);
  });

  it("groups board by thickness/material/finish and applies an editable 10% wastage input", () => {
    const result = calculateFurnitureBoardGroups(candidates, {
      wastagePercentage: 10,
      sheetWidthMm: 2440,
      sheetHeightMm: 1220,
    });
    expect(result.excluded).toEqual([]);
    expect(result.groups).toHaveLength(3);

    const byRawMaterial = new Map(result.groups.map((group) => [`${group.thicknessMm}|${group.rawMaterial}`, group]));
    const backBoard = byRawMaterial.get("8|MDF/HDF");
    expect(backBoard?.netAreaM2).toBeCloseTo(25.847811, 6);
    expect(backBoard?.areaWithWastageM2).toBeCloseTo(28.4325921, 6);
    expect(backBoard?.sheetsRequired).toBe(10);

    const finishTbd = byRawMaterial.get("18|MDF (finish TBD)");
    expect(finishTbd?.netAreaM2).toBeCloseTo(12.577234, 6);
    expect(finishTbd?.areaWithWastageM2).toBeCloseTo(13.8349574, 6);
    expect(finishTbd?.sheetsRequired).toBe(5);

    const melamine = byRawMaterial.get("18|MDF (melamine/finish TBD)");
    expect(melamine?.netAreaM2).toBeCloseTo(61.96164, 6);
    expect(melamine?.areaWithWastageM2).toBeCloseTo(68.157804, 6);
    expect(melamine?.sheetsRequired).toBe(23);

    const zeroWaste = calculateFurnitureBoardGroups(candidates, { wastagePercentage: 0 });
    expect(zeroWaste.groups.find((group) => group.rawMaterial === "MDF/HDF")?.areaWithWastageM2)
      .toBeCloseTo(25.847811, 6);
  });

  it("preserves the editable width-edge assumption at 93.040 lm and marks orientation for review", () => {
    const edge = calculateFurnitureEdgeBanding(candidates);
    expect(edge.byMode.FRONT).toBeCloseTo(93.04, 6);
    expect(edge.byMode.ALL_FOUR).toBeCloseTo(96.006, 6);
    expect(edge.unresolvedCandidateIds).toEqual([]);
    const frontCandidates = candidates.filter((candidate) => candidate.edgeBanding.mode === "FRONT");
    expect(frontCandidates.length).toBeGreaterThan(0);
    expect(frontCandidates.every((candidate) => candidate.edgeBanding.orientation === "ASSUMED")).toBe(true);
    expect(frontCandidates.every((candidate) =>
      candidate.issues.some((issue) => issue.code === "EDGE_ORIENTATION_REQUIRES_VERIFICATION"))).toBe(true);
  });

  it("reconciles safely derivable hardware and preserves the explicit hardware schedule", () => {
    const derived = calculateDerivedFurnitureHardware(candidates);
    expect(derived).toMatchObject({
      hinges: 47,
      drawerSystems: 12,
      shelfPins: 156,
      pullOutChassis: 3,
      unresolvedDoorCandidateIds: [],
    });

    const quantityFor = (pattern: RegExp) => workbook.hardwareItems.find((item) => pattern.test(item.description))?.quantity;
    expect(quantityFor(/concealed hinges/i)).toBe(47);
    expect(quantityFor(/drawer box sets/i)).toBe(12);
    expect(quantityFor(/flip-down/i)).toBe(3);
    expect(quantityFor(/shelf pins/i)).toBe(156);
    expect(quantityFor(/pull-out wire/i)).toBe(3);
    expect(workbook.hardwareItems.find((item) => /drawer box sets/i.test(item.description))?.category)
      .toBe("PROPRIETARY_DRAWER_SYSTEM");
    expect(workbook.hardwareItems.find((item) => /power point/i.test(item.description))?.category)
      .toBe("ELECTRICAL_ACCESSORY");
    expect(workbook.hardwareItems.find((item) => /LED strip/i.test(item.description))?.category).toBe("LED");
  });
});
