import { describe, expect, it } from "vitest";
import {
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
  furnitureOrderItemCandidateEnvelope,
  mapFurnitureOrderItemCandidates,
} from "@/lib/furniture/order-item-mapper";
import type { FurnitureSourceTable } from "@/lib/furniture/candidate-mapper";

function hardwareTable(overrides: Partial<FurnitureSourceTable> = {}): FurnitureSourceTable {
  return {
    sourceTableId: "stored-table-id",
    sourceTableKey: "hardware-table:0",
    sheetName: "Hardware & Accessories BOQ",
    title: "HARDWARE & ACCESSORIES — ORDER QUANTITIES",
    method: "TABLE_PARSER",
    rows: [
      {
        sourceRowId: "stored-row-led",
        sourceRowKey: "11:0",
        rowNumber: 11,
        cells: [
          { columnKey: "item", rawValue: "LED strip lighting", sourceCellReference: "Hardware!A11" },
          { columnKey: "quantity", rawValue: "1", sourceCellReference: "Hardware!B11" },
          { columnKey: "unit", rawValue: "lot", sourceCellReference: "Hardware!C11" },
        ],
      },
      {
        sourceRowId: "stored-row-legs",
        sourceRowKey: "12:1",
        rowNumber: 12,
        cells: [
          { columnKey: "item", rawValue: "Cabinet legs", sourceCellReference: "Hardware!A12" },
          { columnKey: "quantity", rawValue: "~50", sourceCellReference: "Hardware!B12" },
          { columnKey: "unit", rawValue: "pcs", sourceCellReference: "Hardware!C12" },
        ],
      },
      {
        sourceRowId: "stored-row-glass",
        sourceRowKey: "13:2",
        rowNumber: 13,
        cells: [
          { columnKey: "description", rawValue: "Insert panel", sourceCellReference: "Hardware!A13" },
          { columnKey: "qty", rawValue: "2", sourceCellReference: "Hardware!B13" },
          { columnKey: "order_category", rawValue: "Glass / Mirror", sourceCellReference: "Hardware!D13" },
        ],
      },
      {
        sourceRowId: "stored-row-supplied",
        sourceRowKey: "14:3",
        rowNumber: 14,
        cells: [
          { columnKey: "item", rawValue: "Special fitting", sourceCellReference: "Hardware!A14" },
          { columnKey: "quantity", rawValue: "1 lot", sourceCellReference: "Hardware!B14" },
          { columnKey: "notes", rawValue: "Supplied by others", sourceCellReference: "Hardware!D14" },
        ],
      },
      {
        sourceRowId: "stored-row-empty",
        sourceRowKey: "15:4",
        rowNumber: 15,
        cells: [{ columnKey: "notes", rawValue: "No item declaration", sourceCellReference: "Hardware!D15" }],
      },
    ],
    ...overrides,
  };
}

describe("furniture stored order-item mapper", () => {
  it("maps literal values, strict quantities, categories, and evidence without inventing data", () => {
    const result = mapFurnitureOrderItemCandidates(hardwareTable());

    expect(result.items).toHaveLength(4);
    expect(result.skippedRows).toEqual([
      { rowNumber: 15, sourceRowKey: "15:4", reason: "MISSING_DESCRIPTION" },
    ]);
    expect(result.items[0]).toMatchObject({
      description: "LED strip lighting",
      quantity: 1,
      quantityText: "1",
      unit: "lot",
      category: "LED",
      suppliedByOthers: false,
      verificationStatus: "NEEDS_REVIEW",
      evidence: {
        sourceTableId: "stored-table-id",
        sourceRowId: "stored-row-led",
        sourceTableKey: "hardware-table:0",
        sourceRowKey: "11:0",
        sourceCellReferences: ["Hardware!A11", "Hardware!B11", "Hardware!C11"],
      },
    });
    expect(result.items[1]).toMatchObject({
      quantity: null,
      quantityText: "~50",
      category: "HARDWARE",
      verificationStatus: "BLOCKED",
      issues: [{ code: "INVALID_QUANTITY", severity: "BLOCKING" }],
    });
    expect(result.items[2]).toMatchObject({
      quantity: 2,
      category: "GLASS_MIRROR",
      verificationStatus: "BLOCKED",
      issues: [{ code: "MISSING_UNIT", severity: "BLOCKING" }],
    });
    expect(result.items[3]).toMatchObject({
      quantity: null,
      quantityText: "1 lot",
      category: "SUPPLIED_BY_OTHERS",
      suppliedByOthers: true,
      verificationStatus: "BLOCKED",
    });
    expect(result.items[3]?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_QUANTITY", severity: "BLOCKING" }),
      expect.objectContaining({ code: "MISSING_UNIT", severity: "BLOCKING" }),
    ]));
  });

  it("uses stable logical table/row keys rather than ephemeral database ids", () => {
    const first = mapFurnitureOrderItemCandidates(hardwareTable()).items[0];
    const regenerated = mapFurnitureOrderItemCandidates(hardwareTable({
      sourceTableId: "new-table-database-id",
      rows: hardwareTable().rows.map((row, index) => ({
        ...row,
        sourceRowId: `new-row-database-id-${index}`,
      })),
    })).items[0];

    expect(first?.id).toBe(regenerated?.id);
    expect(first?.evidence.sourceTableId).not.toBe(regenerated?.evidence.sourceTableId);
    expect(first?.evidence.sourceRowId).not.toBe(regenerated?.evidence.sourceRowId);
  });

  it("keeps unknown non-hardware rows unclassified for review", () => {
    const result = mapFurnitureOrderItemCandidates({
      ...hardwareTable(),
      sheetName: "Order Schedule",
      title: "Order Schedule",
      rows: [{
        sourceRowKey: "1:0",
        rowNumber: 1,
        cells: [
          { columnKey: "item", rawValue: "Custom component" },
        ],
      }],
    });

    expect(result.items[0]).toMatchObject({ category: "UNCLASSIFIED", verificationStatus: "BLOCKED" });
    expect(result.items[0]?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_QUANTITY", severity: "BLOCKING" }),
      expect.objectContaining({ code: "MISSING_UNIT", severity: "BLOCKING" }),
      expect.objectContaining({ code: "CATEGORY_REQUIRES_REVIEW", severity: "BLOCKING" }),
    ]));
  });

  it("keeps an exact Joinery drawing schedule quantity usable while leaving category editable", () => {
    const result = mapFurnitureOrderItemCandidates({
      ...hardwareTable(),
      sheetName: null,
      title: "Joinery item schedule — page 1",
      rows: [{
        sourceRowKey: "1:0",
        rowNumber: 1,
        cells: [
          { columnKey: "item_code", rawValue: "J05" },
          { columnKey: "room", rawValue: "MASTER BATH" },
          { columnKey: "description", rawValue: "CABINET WITH DRAWERS" },
          { columnKey: "quantity", rawValue: "1" },
          { columnKey: "unit", rawValue: "nr" },
        ],
      }],
    });

    expect(result.items[0]).toMatchObject({
      description: "CABINET WITH DRAWERS",
      quantity: 1,
      unit: "nr",
      category: "UNCLASSIFIED",
      verificationStatus: "NEEDS_REVIEW",
      issues: [{ code: "CATEGORY_REQUIRES_REVIEW", severity: "REVIEW" }],
    });
  });

  it("exposes the persistence marker and typed envelope without changing the candidate", () => {
    const candidate = mapFurnitureOrderItemCandidates(hardwareTable()).items[0]!;
    expect(furnitureOrderItemCandidateEnvelope(candidate)).toEqual({
      kind: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
      candidate,
    });
  });
});
