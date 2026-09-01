import { ExtractedTableStatus, ExtractedTableType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  extractedTable: { deleteMany: vi.fn(), createMany: vi.fn() },
  extractedTableRow: { createMany: vi.fn() },
  extractedTableCell: { createMany: vi.fn() },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  },
}));

import { replaceExtractedTablesForFile } from "@/lib/repositories/extracted-table-repository";

describe("extracted table bulk persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a production-sized structured workbook in three bounded bulk writes", async () => {
    const parsedTables = [
      {
        sheetName: "Cutting List",
        title: "FULL CUTTING LIST — ALL ROOMS",
        confidence: 95,
        method: "xlsx-merge-reconstruction" as const,
        rows: Array.from({ length: 155 }, (_, index) => ({
          rowNumber: index + 4,
          confidence: 95,
          cells: [
            { columnKey: "part", rawValue: `Panel ${index + 1}`, sourceCellReference: `Cutting List!D${index + 4}` },
            { columnKey: "quantity", rawValue: "1", sourceCellReference: `Cutting List!E${index + 4}` },
          ],
        })),
      },
      {
        sheetName: "Hardware & Accessories BOQ",
        confidence: 95,
        method: "xlsx-merge-reconstruction" as const,
        rows: Array.from({ length: 12 }, (_, index) => ({
          rowNumber: index + 4,
          confidence: 95,
          cells: [{ columnKey: "item", rawValue: `Hardware ${index + 1}` }],
        })),
      },
    ];

    const ids = await replaceExtractedTablesForFile(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      parsedTables,
      ExtractedTableType.EXISTING_BOQ,
    );

    expect(ids).toHaveLength(2);
    expect(tx.extractedTable.deleteMany).toHaveBeenCalledOnce();
    expect(tx.extractedTable.createMany.mock.calls[0]?.[0].data).toHaveLength(2);
    expect(tx.extractedTableRow.createMany.mock.calls[0]?.[0].data).toHaveLength(167);
    expect(tx.extractedTableCell.createMany.mock.calls[0]?.[0].data).toHaveLength(322);
    expect(tx.extractedTableRow.createMany.mock.calls[0]?.[0].data[0]).toMatchObject({
      status: ExtractedTableStatus.EXTRACTED,
      rowNumber: 4,
    });
    expect(tx.extractedTableCell.createMany).toHaveBeenCalledOnce();
  });
});
