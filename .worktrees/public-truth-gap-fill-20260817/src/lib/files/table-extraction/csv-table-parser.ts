import { parseCsv } from "@/lib/imports/csv-parser";
import { normalizeColumnKey } from "./column-normalization";
import type { ParsedTable, ParsedTableRow } from "./types";

const FLAT_CONFIDENCE = 90;
const GROUPED_CONFIDENCE = 70;

/**
 * CSV has no merge concept, so parent-child grouping is inferred from a
 * common spreadsheet-export convention: when the first column is blank on a
 * row that otherwise has data, that row belongs to the most recent row that
 * did have a value there (spec section 12's Element/Concrete/Reinforcement
 * example, exported flat). Lower confidence than the XLSX merge-based
 * method below, since this is inferred rather than structurally verified.
 */
export function parseCsvTables(buffer: Buffer): ParsedTable[] {
  const text = buffer.toString("utf-8");
  const rawRows = parseCsv(text);
  if (rawRows.length < 2) return [];

  const headers = rawRows[0];
  const columnKeys = headers.map((header, index) => normalizeColumnKey(header, index));
  const dataRows = rawRows.slice(1);

  let anyBlankFirstColumn = false;
  let lastParentRowNumber: number | undefined;
  const rows: ParsedTableRow[] = [];

  dataRows.forEach((rawRow, index) => {
    const rowNumber = index + 2; // 1-indexed, +1 for the header row
    const firstValue = (rawRow[0] ?? "").trim();
    const hasAnyValue = rawRow.some((value) => value.trim() !== "");
    if (!hasAnyValue) return;

    const isChild = firstValue === "" && lastParentRowNumber !== undefined;
    if (firstValue !== "") {
      lastParentRowNumber = rowNumber;
    } else {
      anyBlankFirstColumn = true;
    }

    // Blank cells are never emitted (including a blank grouping column on a child row) — a
    // child row must carry only its own varying columns, never a trace of the parent's.
    const cells = columnKeys
      .map((columnKey, columnIndex) => ({ columnKey, rawValue: (rawRow[columnIndex] ?? "").trim() }))
      .filter((cell) => cell.rawValue !== "");

    rows.push({
      rowNumber,
      parentRowNumber: isChild ? lastParentRowNumber : undefined,
      cells,
      confidence: anyBlankFirstColumn ? GROUPED_CONFIDENCE : FLAT_CONFIDENCE,
    });
  });

  if (rows.length === 0) return [];

  const confidence = anyBlankFirstColumn ? GROUPED_CONFIDENCE : FLAT_CONFIDENCE;
  return [
    {
      confidence,
      method: "csv-blank-cell-inheritance",
      rows: rows.map((row) => ({ ...row, confidence })),
    },
  ];
}
