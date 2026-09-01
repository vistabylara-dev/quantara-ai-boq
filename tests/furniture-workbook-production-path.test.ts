import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseXlsxTablesForIndustry } from "@/lib/files/table-extraction-handler";
import { parseXlsxTables } from "@/lib/files/table-extraction/xlsx-table-parser";
import {
  furnitureSourceTableToParsedTable,
  readFurnitureWorkbook,
} from "@/lib/furniture/workbook-reader";
import { JOINERY_INDUSTRY_KEY } from "@/lib/furniture/types";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "furniture",
  "Madam_Juli_BOQ_Cutting_List.xlsx",
);

async function genericWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Generic Schedule");
  worksheet.addRow(["Item", "Qty", "Unit"]);
  worksheet.addRow(["Concrete", 12, "m3"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("furniture workbook production parser path", () => {
  it("exposes exact hardware headers, evidence, and fixture quantities through ParsedTable", async () => {
    const workbook = await readFurnitureWorkbook(await readFile(FIXTURE_PATH));
    const parsedHardware = furnitureSourceTableToParsedTable(workbook.hardwareTable);

    expect(workbook.hardwareTable).toMatchObject({
      sheetName: "Hardware & Accessories BOQ",
      title: "HARDWARE & ACCESSORIES — ORDER QUANTITIES",
    });
    expect(parsedHardware.rows).toHaveLength(12);
    expect(parsedHardware.rows[0]?.cells.map((cell) => cell.columnKey)).toEqual([
      "item",
      "quantity",
      "unit",
      "notes",
    ]);
    expect(parsedHardware.rows[0]?.cells.map((cell) => cell.sourceCellReference)).toEqual([
      "Hardware & Accessories BOQ!A4",
      "Hardware & Accessories BOQ!B4",
      "Hardware & Accessories BOQ!C4",
      "Hardware & Accessories BOQ!D4",
    ]);

    const quantityFor = (pattern: RegExp) => workbook.hardwareItems
      .find((item) => pattern.test(item.description))?.quantity;
    expect(quantityFor(/concealed hinges/i)).toBe(47);
    expect(quantityFor(/drawer box sets/i)).toBe(12);
    expect(quantityFor(/flip-down/i)).toBe(3);
    expect(quantityFor(/shelf pins/i)).toBe(156);
    expect(quantityFor(/pull-out wire/i)).toBe(3);

    const approximate = workbook.hardwareItems.find((item) => /levelling feet/i.test(item.description));
    expect(approximate).toMatchObject({ quantity: null, quantityText: "~50" });
    expect(approximate?.issues.map((issue) => issue.code)).toContain("INVALID_QUANTITY");
  });

  it("dispatches the supported fixture into cutting-list and hardware stored tables", async () => {
    const tables = await parseXlsxTablesForIndustry(
      await readFile(FIXTURE_PATH),
      JOINERY_INDUSTRY_KEY,
    );

    expect(tables.map((table) => [table.sheetName, table.rows.length])).toEqual([
      ["Cutting List", 155],
      ["Hardware & Accessories BOQ", 12],
    ]);
    expect(tables.map((table) => table.title)).toEqual([
      "FULL CUTTING LIST — ALL ROOMS",
      "HARDWARE & ACCESSORIES — ORDER QUANTITIES",
    ]);
  });

  it("leaves non-furniture XLSX parsing exactly on the existing generic parser", async () => {
    const buffer = await genericWorkbook();
    const existing = await parseXlsxTables(buffer);
    const dispatched = await parseXlsxTablesForIndustry(buffer, "construction");
    expect(dispatched).toEqual(existing);
  });

  it("falls back to the same generic parser for other furniture workbooks", async () => {
    const buffer = await genericWorkbook();
    const existing = await parseXlsxTables(buffer);
    const dispatched = await parseXlsxTablesForIndustry(buffer, JOINERY_INDUSTRY_KEY);
    expect(dispatched).toEqual(existing);
  });
});
