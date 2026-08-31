import ExcelJS from "exceljs";
import {
  mapFurnitureCandidateTable,
  type FurnitureMappingContext,
  type FurnitureMappingResult,
  type FurnitureSourceCell,
  type FurnitureSourceTable,
} from "./candidate-mapper";
import type { FurnitureOrderCategory, FurnitureOrderItem } from "./calculations";

export const FURNITURE_WORKBOOK_READER_VERSION = "furniture-workbook-v1" as const;

export type FurnitureWorkbookReadResult = {
  readerVersion: typeof FURNITURE_WORKBOOK_READER_VERSION;
  sheetNames: string[];
  cuttingListTable: FurnitureSourceTable;
  hardwareItems: FurnitureOrderItem[];
};

const HEADER_ALIASES: Record<string, string> = {
  room: "room",
  "elevation/ref": "elevation_ref",
  "elevation / ref": "elevation_ref",
  "elevation/reference": "elevation_ref",
  "cabinet / unit": "cabinet_unit",
  "cabinet/unit": "cabinet_unit",
  assembly: "cabinet_unit",
  part: "part",
  qty: "quantity",
  quantity: "quantity",
  "width (mm)": "width_mm",
  "width mm": "width_mm",
  width: "width_mm",
  "height (mm)": "height_mm",
  "height mm": "height_mm",
  height: "height_mm",
  "depth (mm)": "depth_mm",
  "depth mm": "depth_mm",
  depth: "depth_mm",
  "thickness (mm)": "thickness_mm",
  "thickness mm": "thickness_mm",
  thickness: "thickness_mm",
  material: "material",
  "finish/colour": "finish_colour",
  "finish/color": "finish_colour",
  finish: "finish_colour",
  "edge banding": "edge_banding",
  "edge-banding": "edge_banding",
  "grain direction": "grain_direction",
  hardware: "hardware",
  notes: "notes",
  note: "notes",
  item: "item",
  unit: "unit",
};

const CUTTING_LIST_REQUIRED_HEADERS = new Set([
  "room",
  "elevation_ref",
  "cabinet_unit",
  "part",
  "quantity",
  "width_mm",
  "height_mm",
  "thickness_mm",
  "material",
  "edge_banding",
]);

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "");
  if (typeof value === "object" && "richText" in value) {
    return (value as { richText: Array<{ text: string }> }).richText.map((part) => part.text).join("");
  }
  return String(value);
}

function normalizeHeader(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return HEADER_ALIASES[normalized]
    ?? normalized.replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
}

function findWorksheet(workbook: ExcelJS.Workbook, expectedName: string): ExcelJS.Worksheet {
  const sheet = workbook.worksheets.find((candidate) =>
    candidate.name.trim().toLowerCase() === expectedName.trim().toLowerCase());
  if (!sheet) throw new Error(`Required furniture workbook sheet '${expectedName}' was not found.`);
  return sheet;
}

function findHeader(
  worksheet: ExcelJS.Worksheet,
  requiredKeys: ReadonlySet<string>,
): { rowNumber: number; columns: Map<number, string> } {
  const scanLimit = Math.min(worksheet.rowCount, 30);
  for (let rowNumber = 1; rowNumber <= scanLimit; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const columns = new Map<number, string>();
    for (let columnNumber = 1; columnNumber <= worksheet.columnCount; columnNumber += 1) {
      const header = normalizeHeader(cellText(row.getCell(columnNumber)));
      if (header) columns.set(columnNumber, header);
    }
    const foundKeys = new Set(columns.values());
    if ([...requiredKeys].every((key) => foundKeys.has(key))) return { rowNumber, columns };
  }
  throw new Error(`A supported header row was not found in '${worksheet.name}'.`);
}

function sourceCellsForRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columns: ReadonlyMap<number, string>,
): FurnitureSourceCell[] {
  const row = worksheet.getRow(rowNumber);
  const cells: FurnitureSourceCell[] = [];
  for (const [columnNumber, columnKey] of columns) {
    const cell = row.getCell(columnNumber);
    const rawValue = cellText(cell).trim();
    if (rawValue === "") continue;
    cells.push({
      columnKey,
      rawValue,
      sourceCellReference: `${worksheet.name}!${cell.address}`,
    });
  }
  return cells;
}

function buildCuttingListTable(worksheet: ExcelJS.Worksheet): FurnitureSourceTable {
  const header = findHeader(worksheet, CUTTING_LIST_REQUIRED_HEADERS);
  const rows = [];
  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const cells = sourceCellsForRow(worksheet, rowNumber, header.columns);
    if (cells.length === 0) continue;
    const valuesByKey = new Map(cells.map((cell) => [cell.columnKey, cell.rawValue]));
    // Footer/summary rows have no hierarchy identity and are not part candidates.
    if (!["room", "elevation_ref", "cabinet_unit"].some((key) => valuesByKey.get(key)?.trim())) continue;
    rows.push({ rowNumber, cells, confidence: null });
  }
  return {
    sheetName: worksheet.name,
    title: "Furniture cutting list",
    rows,
    confidence: null,
    method: FURNITURE_WORKBOOK_READER_VERSION,
  };
}

function numericQuantity(raw: string): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function explicitHardwareCategory(description: string): FurnitureOrderCategory {
  if (/drawer\s+(?:box|system)|tandembox|legrabox/i.test(description)) return "PROPRIETARY_DRAWER_SYSTEM";
  if (/power\s*point|socket|electrical/i.test(description)) return "ELECTRICAL_ACCESSORY";
  if (/\bled\b/i.test(description)) return "LED";
  return "HARDWARE";
}

function buildHardwareItems(worksheet: ExcelJS.Worksheet): FurnitureOrderItem[] {
  const header = findHeader(worksheet, new Set(["item", "quantity", "unit", "notes"]));
  const items: FurnitureOrderItem[] = [];
  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const cells = sourceCellsForRow(worksheet, rowNumber, header.columns);
    const values = new Map(cells.map((cell) => [cell.columnKey, cell.rawValue]));
    const description = values.get("item")?.trim() ?? "";
    if (description === "") continue;
    const quantityText = values.get("quantity")?.trim() ?? "";
    const notes = values.get("notes")?.trim() || null;
    items.push({
      id: `${worksheet.name}:${rowNumber}`,
      description,
      quantity: numericQuantity(quantityText),
      quantityText,
      unit: values.get("unit")?.trim() || null,
      category: explicitHardwareCategory(description),
      suppliedByOthers: notes ? /supplied\s+by\s+others/i.test(notes) : false,
      notes,
      evidence: {
        sheetName: worksheet.name,
        rowNumber,
        sourceCellReferences: cells.map((cell) => cell.sourceCellReference).filter((value): value is string => Boolean(value)),
      },
    });
  }
  return items;
}

export async function readFurnitureWorkbook(buffer: Buffer): Promise<FurnitureWorkbookReadResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const cuttingList = findWorksheet(workbook, "Cutting List");
  const hardware = findWorksheet(workbook, "Hardware & Accessories BOQ");
  return {
    readerVersion: FURNITURE_WORKBOOK_READER_VERSION,
    sheetNames: workbook.worksheets.map((worksheet) => worksheet.name),
    cuttingListTable: buildCuttingListTable(cuttingList),
    hardwareItems: buildHardwareItems(hardware),
  };
}

export async function mapFurnitureWorkbookCandidates(
  buffer: Buffer,
  context: Omit<FurnitureMappingContext, "sourceKind">,
): Promise<{ workbook: FurnitureWorkbookReadResult; mapping: FurnitureMappingResult }> {
  const workbook = await readFurnitureWorkbook(buffer);
  return {
    workbook,
    mapping: mapFurnitureCandidateTable(workbook.cuttingListTable, { ...context, sourceKind: "WORKBOOK" }),
  };
}
