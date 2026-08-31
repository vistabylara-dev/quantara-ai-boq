import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildFurnitureCanonicalOutput,
  DEFAULT_FURNITURE_WASTAGE_PERCENTAGE,
  FURNITURE_CANONICAL_SECTIONS,
  type ConfirmedFurnitureCandidate,
  type ConfirmedFurnitureOrderItem,
  type FurnitureCanonicalItem,
} from "@/lib/furniture/canonical-output";
import {
  FURNITURE_CANDIDATE_MAPPING_VERSION,
  type FurniturePartCandidate,
} from "@/lib/furniture/candidate-mapper";
import type { FurnitureOrderCategory } from "@/lib/furniture/calculations";
import {
  buildFurnitureManagedItemUpdate,
  furnitureManagedNotes,
  furnitureManagedItemCode,
  furnitureManagedSourceReference,
  planFurnitureManagedRows,
  readFurnitureManagedKey,
  type ExistingFurnitureManagedBOQItem,
} from "@/lib/services/furniture-boq-service";

function candidate(id = "candidate-1"): FurniturePartCandidate {
  const dimension = (name: string, valueMm: number) => ({
    valueMm,
    readings: [{
      columnKey: name,
      rawValue: String(valueMm),
      valueMm,
      evidenceReference: `Cutting List!${name}`,
    }],
    hasConflict: false,
  });
  return {
    candidateId: id,
    mappingVersion: FURNITURE_CANDIDATE_MAPPING_VERSION,
    discipline: "JOINERY_CABINETRY",
    room: "KITCHEN",
    elevationReference: "E01",
    assembly: "Base cabinet",
    assemblyGroupKey: "kitchen|e01|base-cabinet",
    part: "Door Panel",
    quantity: 2,
    dimensions: {
      width: dimension("B5", 600),
      height: dimension("C5", 800),
      depth: dimension("D5", 18),
      thickness: dimension("E5", 18),
    },
    material: { raw: "MDF (Oak)", name: "MDF", finish: "Oak" },
    edgeBanding: {
      raw: "All four edges",
      mode: "ALL_FOUR",
      selectedEdges: [{ dimension: "WIDTH", count: 2 }, { dimension: "HEIGHT", count: 2 }],
      orientation: "EXPLICIT",
    },
    grainDirection: "Vertical",
    hardwareNotes: ["Soft-close"],
    notes: "Verified against elevation E01.",
    evidence: {
      sourceFileId: "source-file-1",
      sourceFileName: "schedule.xlsx",
      sourceKind: "WORKBOOK",
      method: "furniture-workbook-v1",
      sheetName: "Cutting List",
      pageNumber: null,
      rowNumber: 5,
      drawingReference: "E01",
      confidence: 98,
      sourceCellReferences: ["Cutting List!A5", "Cutting List!B5"],
      rawCells: { room: "KITCHEN", part: "Door Panel" },
    },
    issues: [],
    verificationStatus: "READY_FOR_REVIEW",
  };
}

function confirmed(value = candidate()): ConfirmedFurnitureCandidate {
  return {
    entityId: `entity-${value.candidateId}`,
    status: "CONFIRMED",
    confirmedAt: "2026-08-31T08:00:00.000Z",
    updatedAt: "2026-08-31T08:01:00.000Z",
    candidate: value,
  };
}

function build(confirmedOrderItems: ConfirmedFurnitureOrderItem[] = []) {
  return buildFurnitureCanonicalOutput({
    projectId: "project-1",
    projectReference: "FJC-001",
    projectName: "Controlled Furniture Test",
    discipline: "JOINERY_CABINETRY",
    wastagePercentage: DEFAULT_FURNITURE_WASTAGE_PERCENTAGE,
    confirmedCandidates: [confirmed()],
    confirmedOrderItems,
  });
}

function existing(
  id: string,
  item: FurnitureCanonicalItem,
  overrides: Partial<ExistingFurnitureManagedBOQItem> = {},
): ExistingFurnitureManagedBOQItem {
  return {
    id,
    sectionId: "section-brd",
    sectionCode: "BRD",
    itemCode: furnitureManagedItemCode(item.managedKey),
    sourceReference: furnitureManagedSourceReference(item),
    category: item.category,
    description: item.description,
    specification: item.specification,
    quantity: new Prisma.Decimal(item.quantity),
    unit: item.unit,
    wastagePercentage: new Prisma.Decimal(item.wastagePercentage),
    roomOrZone: item.roomOrZone,
    drawingReference: item.drawingReference,
    confidenceScore: new Prisma.Decimal(item.confidenceScore),
    notes: furnitureManagedNotes(item),
    itemNumber: 10_000,
    sortOrder: 10_000,
    sellingRate: new Prisma.Decimal(125),
    createdAt: new Date("2026-08-31T08:00:00.000Z"),
    ...overrides,
  };
}

describe("furniture canonical output", () => {
  it("produces exactly the five mandated sections from confirmed evidence with caller-visible 10% wastage", () => {
    const output = build();
    expect(DEFAULT_FURNITURE_WASTAGE_PERCENTAGE).toBe(10);
    expect(output.wastagePercentage).toBe(10);
    expect(output.sections.map(({ title }) => title)).toEqual([
      "PROJECT SUMMARY",
      "BOARD / SHEET MATERIAL — ORDER QUANTITIES",
      "HARDWARE & ACCESSORIES — ORDER QUANTITIES",
      "FULL CUTTING LIST — ALL ROOMS",
      "NOTES, ASSUMPTIONS & VERIFICATION ITEMS",
    ]);
    expect(output.sections).toHaveLength(FURNITURE_CANONICAL_SECTIONS.length);
    expect(output.sections.find(({ code }) => code === "BRD")?.items[0]).toMatchObject({
      category: "BOARD",
      wastagePercentage: 10,
      unit: "sheets",
    });
    const cutting = output.sections.find(({ code }) => code === "CUT")?.items[0];
    expect(cutting?.quantity).toBe(2);
    expect(cutting?.evidence).toMatchObject({
      extractedEntityIds: ["entity-candidate-1"],
      candidateIds: ["candidate-1"],
      sourceFileIds: ["source-file-1"],
      sourceFileNames: ["schedule.xlsx"],
      sourceCellReferences: ["Cutting List!A5", "Cutting List!B5"],
      confirmationTimestamps: ["2026-08-31T08:00:00.000Z"],
      sourceMethods: ["furniture-workbook-v1"],
    });
    expect(output.sections.find(({ code }) => code === "VER")?.items[0].specification).toContain("10%");
  });

  it("rejects any non-confirmed candidate at the canonical boundary", () => {
    const unconfirmed = { ...confirmed(), status: "NEEDS_REVIEW" } as unknown as ConfirmedFurnitureCandidate;
    expect(() => buildFurnitureCanonicalOutput({
      projectId: "project-1",
      projectReference: "FJC-001",
      projectName: "Controlled Furniture Test",
      discipline: "FURNITURE",
      wastagePercentage: 10,
      confirmedCandidates: [unconfirmed],
    })).toThrow("only CONFIRMED");
  });

  it("keeps every specialist order category separate and moves supplied-by-others out of hardware", () => {
    const categories: FurnitureOrderCategory[] = [
      "HARDWARE",
      "STONE_QUARTZ",
      "GLASS_MIRROR",
      "APPLIANCE",
      "ELECTRICAL_ACCESSORY",
      "LED",
      "PROPRIETARY_DRAWER_SYSTEM",
    ];
    const confirmedOrderItems: ConfirmedFurnitureOrderItem[] = categories.map((categoryName, index) => ({
      entityId: `entity-order-${index + 1}`,
      status: "CONFIRMED",
      confirmedAt: "2026-08-31T08:02:00.000Z",
      updatedAt: `2026-08-31T08:${String(index + 3).padStart(2, "0")}:00.000Z`,
      item: {
        id: `item-${categoryName}`,
        description: categoryName,
        quantity: index + 1,
        quantityText: String(index + 1),
        unit: "pcs",
        category: categoryName,
        suppliedByOthers: false,
        notes: null,
      },
    }));
    confirmedOrderItems.push({
      entityId: "entity-order-supplied",
      status: "CONFIRMED",
      confirmedAt: "2026-08-31T08:10:00.000Z",
      updatedAt: "2026-08-31T08:11:00.000Z",
      item: {
        id: "item-supplied",
        description: "Client-supplied appliance",
        quantity: 1,
        quantityText: "1",
        unit: "pcs",
        category: "APPLIANCE",
        suppliedByOthers: true,
        notes: "Supplied by others",
      },
    });
    const output = build(confirmedOrderItems);
    for (const categoryName of categories) {
      expect(output.orderItemsByCategory[categoryName]).toHaveLength(1);
    }
    expect(output.orderItemsByCategory.SUPPLIED_BY_OTHERS.map(({ id }) => id)).toEqual(["item-supplied"]);
    const generatedCategories = output.sections.find(({ code }) => code === "HWA")?.items.map(({ category }) => category);
    expect(generatedCategories).toContain("STONE_QUARTZ");
    expect(generatedCategories).toContain("GLASS_MIRROR");
    expect(generatedCategories).toContain("APPLIANCE");
    expect(generatedCategories).toContain("ELECTRICAL_ACCESSORY");
    expect(generatedCategories).toContain("LED");
    expect(generatedCategories).toContain("PROPRIETARY_DRAWER_SYSTEM");
    expect(generatedCategories).toContain("SUPPLIED_BY_OTHERS");
  });
});

describe("managed furniture BOQ row reconciliation", () => {
  it("is a no-op when the exact managed output already exists", () => {
    const desired = build().sections.find(({ code }) => code === "BRD")!.items[0];
    const current = existing("managed-current", desired);
    const plan = planFurnitureManagedRows([current], [desired]);
    expect(plan).toMatchObject({
      create: [],
      update: [],
      deleteIds: [],
      unchangedIds: ["managed-current"],
      manualOrUnmarkedIds: [],
    });
  });

  it("updates one matched managed row, removes managed duplicates/stale rows, and preserves every unmarked row", () => {
    const desired = build().sections.find(({ code }) => code === "BRD")!.items[0];
    const stale: FurnitureCanonicalItem = { ...desired, managedKey: "board:stale" };
    const rows = [
      existing("managed-keeper", desired, { description: "old", createdAt: new Date("2026-08-31T08:00:00Z") }),
      existing("managed-duplicate", desired, { createdAt: new Date("2026-08-31T08:01:00Z") }),
      existing("managed-stale", stale),
      existing("manual-row", desired, { itemCode: "MAN-001", sourceReference: "Designer entry" }),
    ];
    const plan = planFurnitureManagedRows(rows, [desired]);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([{ id: "managed-keeper", item: desired }]);
    expect(plan.deleteIds.sort()).toEqual(["managed-duplicate", "managed-stale"]);
    expect(plan.manualOrUnmarkedIds).toEqual(["manual-row"]);
  });

  it("matches a managed key across sections so its commercial row can be moved instead of recreated", () => {
    const desired = build().sections.find(({ code }) => code === "BRD")!.items[0];
    const misplaced = existing("managed-misplaced", desired, {
      sectionId: "section-hwa",
      sectionCode: "HWA",
    });
    const plan = planFurnitureManagedRows([misplaced], [desired]);
    expect(plan.create).toEqual([]);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.update).toEqual([{ id: "managed-misplaced", item: desired }]);
    const update = buildFurnitureManagedItemUpdate(misplaced, desired, 0);
    expect(update).not.toHaveProperty("unitCost");
    expect(update).not.toHaveProperty("sellingRate");
  });

  it("requires both explicit markers and never includes commercial rate fields in a managed technical update", () => {
    const desired = build().sections.find(({ code }) => code === "BRD")!.items[0];
    const current = existing("managed", desired, { description: "old" });
    expect(readFurnitureManagedKey(current)).toBe(desired.managedKey);
    expect(readFurnitureManagedKey({
      ...current,
      itemCode: "USER-EDITED",
      sourceReference: "User source",
    })).toBeNull();
    const update = buildFurnitureManagedItemUpdate(current, desired, 0);
    expect(update).not.toHaveProperty("unitCost");
    expect(update).not.toHaveProperty("freightCost");
    expect(update).not.toHaveProperty("installationCost");
    expect(update).not.toHaveProperty("additionalCost");
    expect(update).not.toHaveProperty("landedCost");
    expect(update).not.toHaveProperty("sellingRate");
    expect(new Prisma.Decimal(update.totalAmount as Prisma.Decimal).toNumber()).toBe(125 * desired.quantity);
  });
});
