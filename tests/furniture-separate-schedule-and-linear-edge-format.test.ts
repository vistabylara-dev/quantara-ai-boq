import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { boqQuantityInputValue } from "@/components/boq/boq-editor";
import {
  FURNITURE_SCHEDULE_FIELDS,
  furnitureEngine,
} from "@/config/industries/furniture";
import {
  formatFurnitureJoineryLinearEdgeQuantity,
  formatFurnitureJoineryQuantity,
  FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE,
  isFurnitureJoineryLinearEdgeItem,
} from "@/lib/furniture/linear-edge-format";
import type { BOQItem } from "@/types/boq";

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), ...relativePath.split("/")), "utf8");
}

function boqItem(overrides: Partial<BOQItem> = {}): BOQItem {
  return {
    id: "linear-edge-item",
    itemNumber: 1,
    itemCode: "FJC-M1-edge",
    category: "HARDWARE",
    description: "Front-edge banding length",
    specification: FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE,
    quantity: 93.04,
    unit: "lm",
    unitCost: 0,
    landedCost: 0,
    marginPercentage: 0,
    sellingRate: 0,
    totalAmount: 0,
    wastagePercentage: 0,
    taxApplicable: true,
    sourceReference: `[FJC_MANAGED_V1:${encodeURIComponent("order:HARDWARE:edge-banding:front")}] fixture.xlsx`,
    roomOrZone: "All rooms",
    drawingReference: "",
    confidenceScore: 100,
    status: "confirmed",
    notes: FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE,
    options: [],
    ...overrides,
  };
}

describe("separate Furniture schedule behavior", () => {
  it("keeps the established Furniture identity and supports the complete loose/manufactured schedule evidence contract", () => {
    expect(furnitureEngine).toMatchObject({ id: "furniture", name: "Furniture", status: "active" });
    expect(furnitureEngine.requiredFields).toEqual([...FURNITURE_SCHEDULE_FIELDS]);
    expect(furnitureEngine.requiredFields).toEqual(expect.arrayContaining([
      "item",
      "specification",
      "room",
      "location",
      "quantity",
      "unit",
      "width",
      "height",
      "depth",
      "material",
      "finishColour",
      "manufacturer",
      "productReference",
      "installation",
      "hardwareAccessories",
      "manufacturingComponents",
      "sourceReference",
      "pageNumber",
      "evidence",
      "confidence",
      "verificationStatus",
      "notes",
      "assumptions",
    ]));
  });

  it("never attaches Joinery cutting-list sections or cabinetry formulas to ordinary Furniture", () => {
    expect(furnitureEngine.boqSections.map(({ code }) => code)).toEqual(["EXE", "WRK", "SEA", "STO"]);
    expect(furnitureEngine.boqSections.some(({ code }) => ["PRJ", "BRD", "HWA", "CUT", "VER"].includes(code))).toBe(false);
    expect(furnitureEngine.calculationTypes).toEqual(["unitCount", "setQuantity", "optionSelection"]);
    expect(furnitureEngine.calculationTypes).not.toEqual(expect.arrayContaining([
      "surfaceArea",
      "linearMetre",
      "panelQuantity",
      "cuttingList",
    ]));
  });
});

describe("scoped furniture/joinery linear-edge presentation", () => {
  it("preserves the required 93.040 display and all three professional-review labels", () => {
    const item = boqItem();
    expect(isFurnitureJoineryLinearEdgeItem(item)).toBe(true);
    expect(formatFurnitureJoineryLinearEdgeQuantity(item.quantity)).toBe("93.040");
    expect(formatFurnitureJoineryQuantity(item)).toBe("93.040");
    expect(FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE).toBe(
      "Editable assumption. Requires professional verification. Based on the workbook’s selected-edge interpretation.",
    );
  });

  it("does not change generic quantities or apply the Joinery presentation to Furniture", () => {
    const generic = boqItem({ description: "Loose lounge chair", category: "FURNITURE", unit: "pcs" });
    expect(isFurnitureJoineryLinearEdgeItem(generic)).toBe(false);
    expect(formatFurnitureJoineryQuantity(generic)).toBe("93.04");
    expect(boqQuantityInputValue("furniture", boqItem())).toBe(93.04);
    expect(boqQuantityInputValue("joinery", boqItem())).toBe("93.040");
  });

  it("uses the scoped formatter in both authenticated BOQ and client-proposal UI", () => {
    const editor = source("src/components/boq/boq-editor.tsx");
    const proposal = source("src/app/proposal/[token]/proposal-client-view.tsx");
    expect(editor).toContain("boqQuantityInputValue(industryId, item)");
    expect(editor).toContain("industryId === JOINERY_INDUSTRY_KEY");
    expect(proposal).toContain('view.project.industry.trim().toLowerCase() === "joinery"');
    expect(proposal).toContain("formatFurnitureJoineryLinearEdgeQuantity(item.quantity)");
  });
});
