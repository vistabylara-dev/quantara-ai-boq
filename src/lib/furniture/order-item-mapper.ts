import {
  FURNITURE_ORDER_CATEGORIES,
  type FurnitureOrderCategory,
  type FurnitureOrderItem,
} from "./calculations";
import type {
  FurnitureSourceKind,
  FurnitureSourceCell,
  FurnitureSourceRow,
  FurnitureSourceTable,
} from "./candidate-mapper";
import { FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND } from "./types";

export { FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND } from "./types";

export const FURNITURE_ORDER_ITEM_MAPPING_VERSION = "furniture-order-item-v1" as const;
export type FurnitureOrderItemIssue = {
  code: "MISSING_QUANTITY" | "INVALID_QUANTITY" | "MISSING_UNIT" | "CATEGORY_REQUIRES_REVIEW";
  field: "quantity" | "unit" | "category";
  severity: "BLOCKING" | "REVIEW";
  message: string;
  evidenceReferences: string[];
};

export type FurnitureOrderItemCandidate = FurnitureOrderItem & {
  mappingVersion: typeof FURNITURE_ORDER_ITEM_MAPPING_VERSION;
  verificationStatus: "BLOCKED" | "NEEDS_REVIEW" | "CORRECTED" | "APPROVED_LOCKED";
  issues: FurnitureOrderItemIssue[];
  evidence: NonNullable<FurnitureOrderItem["evidence"]> & {
    sourceTableId: string | null;
    sourceRowId: string | null;
    sourceFileId: string | null;
    sourceFileName: string;
    sourceKind: FurnitureSourceKind;
    pageNumber: number | null;
    confidence: number | null;
    method: string;
    sourceTableKey: string;
    sourceRowKey: string;
    rawCells: Record<string, string>;
  };
};

export type FurnitureOrderItemMappingResult = {
  mappingVersion: typeof FURNITURE_ORDER_ITEM_MAPPING_VERSION;
  items: FurnitureOrderItemCandidate[];
  skippedRows: Array<{
    rowNumber: number;
    sourceRowKey: string;
    reason: "MISSING_DESCRIPTION";
  }>;
};

export type FurnitureOrderItemCandidateEnvelope = {
  kind: typeof FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND;
  candidate: FurnitureOrderItemCandidate;
};

export function furnitureOrderItemCandidateEnvelope(
  candidate: FurnitureOrderItemCandidate,
): FurnitureOrderItemCandidateEnvelope {
  return { kind: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND, candidate };
}

const DESCRIPTION_KEYS = ["item", "description", "item_description", "item_name"] as const;
const QUANTITY_KEYS = ["quantity", "qty"] as const;
const UNIT_KEYS = ["unit", "uom", "unit_of_measure"] as const;
const NOTES_KEYS = ["notes", "note", "remarks"] as const;
const CATEGORY_KEYS = ["category", "order_category", "item_category"] as const;

const EXPLICIT_CATEGORY_VALUES = new Map<string, FurnitureOrderCategory>(
  FURNITURE_ORDER_CATEGORIES.flatMap((category) => {
    const normalized = normalizeValue(category);
    return [
      [normalized, category],
      [normalized.replace(/_/g, " "), category],
    ] as Array<[string, FurnitureOrderCategory]>;
  }),
);

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}

function rowCells(row: FurnitureSourceRow): Map<string, FurnitureSourceCell[]> {
  const cells = new Map<string, FurnitureSourceCell[]>();
  for (const cell of row.cells) {
    const key = normalizeKey(cell.columnKey);
    const existing = cells.get(key) ?? [];
    existing.push(cell);
    cells.set(key, existing);
  }
  return cells;
}

function firstCell(
  cells: ReadonlyMap<string, FurnitureSourceCell[]>,
  aliases: readonly string[],
): FurnitureSourceCell | null {
  for (const alias of aliases) {
    const cell = cells.get(alias)?.find((candidate) => candidate.rawValue.trim() !== "");
    if (cell) return cell;
  }
  return null;
}

function sourceReference(
  table: FurnitureSourceTable,
  row: FurnitureSourceRow,
  cell: FurnitureSourceCell,
): string {
  if (cell.sourceCellReference) return cell.sourceCellReference;
  if (table.sheetName) return `${table.sheetName}!R${row.rowNumber}:${cell.columnKey}`;
  if (table.pageNumber !== undefined) return `page:${table.pageNumber}:row:${row.rowNumber}:${cell.columnKey}`;
  return `row:${row.rowNumber}:${cell.columnKey}`;
}

function rawCells(row: FurnitureSourceRow): Record<string, string> {
  const result: Record<string, string> = {};
  for (const cell of row.cells) {
    const baseKey = normalizeKey(cell.columnKey) || "column";
    let key = baseKey;
    let suffix = 2;
    while (key in result) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }
    result[key] = cell.rawValue;
  }
  return result;
}

function strictQuantity(raw: string): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(raw.trim())) return null;
  const quantity = Number(raw);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

function explicitlySuppliedByOthers(notes: string): boolean {
  return /\bsupplied\s+by\s+others\b/i.test(notes)
    || /\bsupplied(?:\s*\/\s*fixed)?\s+separately\b/i.test(notes);
}

/**
 * Uses only literal source declarations. It deliberately has no fuzzy or AI
 * classification: an explicit category column wins, otherwise exact nouns in
 * the description are recognized, and every remaining row keeps the table's
 * explicit hardware context (or UNCLASSIFIED outside that context).
 */
function explicitCategory(
  table: FurnitureSourceTable,
  description: string,
  categoryText: string,
  suppliedByOthers: boolean,
): FurnitureOrderCategory {
  if (suppliedByOthers) return "SUPPLIED_BY_OTHERS";

  const declared = EXPLICIT_CATEGORY_VALUES.get(normalizeValue(categoryText));
  if (declared) return declared;

  if (/\bled\b/i.test(description)) return "LED";
  if (/\b(?:power\s*point|electrical\s+accessor(?:y|ies))\b/i.test(description)) {
    return "ELECTRICAL_ACCESSORY";
  }
  if (/\b(?:drawer\s+box\s+sets?|tandembox|legrabox|proprietary\s+drawer\s+systems?)\b/i.test(description)) {
    return "PROPRIETARY_DRAWER_SYSTEM";
  }
  if (/\b(?:stone|quartz)\b/i.test(description)) return "STONE_QUARTZ";
  if (/\b(?:glass|mirror)\b/i.test(description)) return "GLASS_MIRROR";
  if (/\bappliance\b/i.test(description)) return "APPLIANCE";

  const tableContext = normalizeValue(`${table.sheetName ?? ""} ${table.title ?? ""}`);
  if (tableContext.includes("hardware accessories")) return "HARDWARE";
  if (tableContext.includes("board sheet material")) return "BOARD";
  return "UNCLASSIFIED";
}

function stableIdentity(table: FurnitureSourceTable, row: FurnitureSourceRow): {
  tableKey: string;
  rowKey: string;
} {
  const tableKey = table.sourceTableKey
    ?? table.sourceTableId
    ?? table.sheetName
    ?? table.title
    ?? (table.pageNumber === undefined ? "table" : `page-${table.pageNumber}`);
  const rowKey = row.sourceRowKey ?? row.sourceRowId ?? String(row.rowNumber);
  return { tableKey, rowKey };
}

export function mapFurnitureOrderItemCandidates(
  table: FurnitureSourceTable,
  context: {
    sourceFileId?: string | null;
    sourceFileName?: string;
    sourceKind?: FurnitureSourceKind;
  } = {},
): FurnitureOrderItemMappingResult {
  const items: FurnitureOrderItemCandidate[] = [];
  const skippedRows: FurnitureOrderItemMappingResult["skippedRows"] = [];

  for (const row of table.rows) {
    const cells = rowCells(row);
    const descriptionCell = firstCell(cells, DESCRIPTION_KEYS);
    const { tableKey, rowKey } = stableIdentity(table, row);
    if (!descriptionCell) {
      skippedRows.push({ rowNumber: row.rowNumber, sourceRowKey: rowKey, reason: "MISSING_DESCRIPTION" });
      continue;
    }

    const description = descriptionCell.rawValue.trim();
    const quantityCell = firstCell(cells, QUANTITY_KEYS);
    const quantityText = quantityCell?.rawValue.trim() ?? "";
    const quantity = strictQuantity(quantityText);
    const unit = firstCell(cells, UNIT_KEYS)?.rawValue.trim() || null;
    const notes = firstCell(cells, NOTES_KEYS)?.rawValue.trim() || null;
    const categoryCell = firstCell(cells, CATEGORY_KEYS);
    const suppliedByOthers = explicitlySuppliedByOthers(notes ?? "")
      || normalizeValue(categoryCell?.rawValue ?? "") === "supplied by others";
    const category = explicitCategory(
      table,
      description,
      categoryCell?.rawValue ?? "",
      suppliedByOthers,
    );
    const issues: FurnitureOrderItemIssue[] = [];

    if (quantityText === "") {
      issues.push({
        code: "MISSING_QUANTITY",
        field: "quantity",
        severity: "BLOCKING",
        message: "Quantity was not present in the source row and must be provided before approval.",
        evidenceReferences: [],
      });
    } else if (quantity === null) {
      issues.push({
        code: "INVALID_QUANTITY",
        field: "quantity",
        severity: "BLOCKING",
        message: "The source quantity was preserved but was not treated as numeric because it is approximate or contains prose.",
        evidenceReferences: quantityCell ? [sourceReference(table, row, quantityCell)] : [],
      });
    }
    if (unit === null) {
      issues.push({
        code: "MISSING_UNIT",
        field: "unit",
        severity: "BLOCKING",
        message: "Unit was not present in the source row and must be corrected before approval.",
        evidenceReferences: [],
      });
    }
    if (category === "UNCLASSIFIED") {
      issues.push({
        code: "CATEGORY_REQUIRES_REVIEW",
        field: "category",
        severity: "BLOCKING",
        message: "No explicit order category was present in the source row; select a category before approval.",
        evidenceReferences: [sourceReference(table, row, descriptionCell)],
      });
    }

    items.push({
      id: `${FURNITURE_ORDER_ITEM_MAPPING_VERSION}:${encodeURIComponent(tableKey)}:${encodeURIComponent(rowKey)}`,
      description,
      quantity,
      quantityText,
      unit,
      category,
      suppliedByOthers,
      notes,
      mappingVersion: FURNITURE_ORDER_ITEM_MAPPING_VERSION,
      verificationStatus: issues.some((issue) => issue.severity === "BLOCKING")
        ? "BLOCKED"
        : "NEEDS_REVIEW",
      issues,
      evidence: {
        sheetName: table.sheetName ?? null,
        rowNumber: row.rowNumber,
        sourceCellReferences: row.cells
          .filter((cell) => cell.rawValue.trim() !== "")
          .map((cell) => sourceReference(table, row, cell)),
        sourceTableId: table.sourceTableId ?? null,
        sourceRowId: row.sourceRowId ?? null,
        sourceFileId: context.sourceFileId ?? null,
        sourceFileName: context.sourceFileName ?? "",
        sourceKind: context.sourceKind ?? "WORKBOOK",
        pageNumber: table.pageNumber ?? null,
        confidence: row.confidence ?? table.confidence ?? null,
        method: table.method ?? "TABLE_PARSER",
        sourceTableKey: tableKey,
        sourceRowKey: rowKey,
        rawCells: rawCells(row),
      },
    });
  }

  return {
    mappingVersion: FURNITURE_ORDER_ITEM_MAPPING_VERSION,
    items,
    skippedRows,
  };
}
