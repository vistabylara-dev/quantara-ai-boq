import ExcelJS from "exceljs";
import { normalizeColumnKey } from "./column-normalization";
import type { ParsedTable, ParsedTableRow } from "./types";

const FLAT_CONFIDENCE = 95;
const GROUPED_CONFIDENCE = 85;

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "");
  if (typeof value === "object" && "richText" in value) {
    return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join("");
  }
  return String(value);
}

type MergeRange = { colStart: number; colEnd: number; rowStart: number; rowEnd: number };

function parseMerges(worksheet: ExcelJS.Worksheet): MergeRange[] {
  const merges = (worksheet.model.merges ?? []) as string[];
  const ranges: MergeRange[] = [];
  for (const range of merges) {
    const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
    if (!match) continue;
    const [, colStartLetter, rowStartStr, colEndLetter, rowEndStr] = match;
    ranges.push({
      colStart: columnLetterToNumber(colStartLetter),
      colEnd: columnLetterToNumber(colEndLetter),
      rowStart: Number(rowStartStr),
      rowEnd: Number(rowEndStr),
    });
  }
  return ranges;
}

function columnLetterToNumber(letters: string): number {
  let result = 0;
  for (const char of letters) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result;
}

/**
 * Reconstructs merged cells (a merged cell's value only lives on its
 * top-left/master cell in ExcelJS's model) and groups rows that share an
 * identical multi-row vertical merge range across the same set of columns
 * into one parent row + child rows — the section 12 worked example
 * (Foundations/Concrete spanning several reinforcement-diameter rows).
 * Columns that are NOT part of that shared merge range vary per row and
 * become the child rows' own cells; the merged columns stay on the parent
 * only, so summing children never double-counts the parent quantity.
 */
export async function parseXlsxTables(buffer: Buffer): Promise<ParsedTable[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const tables: ParsedTable[] = [];

  for (const worksheet of workbook.worksheets) {
    if (worksheet.rowCount < 2) continue;

    const headerRow = worksheet.getRow(1);
    const columnCount = worksheet.columnCount;
    const columnKeys: string[] = [];
    for (let col = 1; col <= columnCount; col += 1) {
      columnKeys.push(normalizeColumnKey(cellText(headerRow.getCell(col)), col - 1));
    }

    const merges = parseMerges(worksheet);
    // Multi-row merges keyed by "rowStart:rowEnd" -> the set of columns merged across exactly that range.
    const groupsByRange = new Map<string, { rowStart: number; rowEnd: number; columns: Set<number> }>();
    for (const merge of merges) {
      if (merge.rowEnd <= merge.rowStart) continue; // horizontal-only merges don't define a parent-child row group
      const key = `${merge.rowStart}:${merge.rowEnd}`;
      const existing = groupsByRange.get(key) ?? { rowStart: merge.rowStart, rowEnd: merge.rowEnd, columns: new Set<number>() };
      for (let col = merge.colStart; col <= merge.colEnd; col += 1) existing.columns.add(col);
      groupsByRange.set(key, existing);
    }

    // Map each data row number to the group it belongs to (if any).
    const rowToGroup = new Map<number, { rowStart: number; rowEnd: number; columns: Set<number> }>();
    for (const group of groupsByRange.values()) {
      for (let row = group.rowStart; row <= group.rowEnd; row += 1) rowToGroup.set(row, group);
    }

    const hasGrouping = groupsByRange.size > 0;
    const confidence = hasGrouping ? GROUPED_CONFIDENCE : FLAT_CONFIDENCE;
    const rows: ParsedTableRow[] = [];
    const emittedParentForRange = new Set<string>();

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const group = rowToGroup.get(rowNumber);

      const rowHasAnyValue = columnKeys.some((_, colIndex) => cellText(row.getCell(colIndex + 1)).trim() !== "");
      if (!rowHasAnyValue) continue;

      if (!group) {
        const cells = columnKeys
          .map((columnKey, colIndex) => ({
            columnKey,
            rawValue: cellText(row.getCell(colIndex + 1)).trim(),
            sourceCellReference: `${worksheet.name}!R${rowNumber}C${colIndex + 1}`,
          }))
          .filter((cell) => cell.rawValue !== "");
        if (cells.length > 0) rows.push({ rowNumber, cells, confidence });
        continue;
      }

      const rangeKey = `${group.rowStart}:${group.rowEnd}`;
      if (!emittedParentForRange.has(rangeKey)) {
        emittedParentForRange.add(rangeKey);
        const masterRow = worksheet.getRow(group.rowStart);
        const parentCells = columnKeys
          .map((columnKey, colIndex) => ({
            columnKey,
            rawValue: cellText(masterRow.getCell(colIndex + 1)).trim(),
            sourceCellReference: `${worksheet.name}!R${group.rowStart}C${colIndex + 1}`,
          }))
          .filter((cell, colIndex) => cell.rawValue !== "" && group.columns.has(colIndex + 1));
        rows.push({ rowNumber: group.rowStart, cells: parentCells, confidence });
      }

      const childCells = columnKeys
        .map((columnKey, colIndex) => ({
          columnKey,
          rawValue: cellText(row.getCell(colIndex + 1)).trim(),
          sourceCellReference: `${worksheet.name}!R${rowNumber}C${colIndex + 1}`,
        }))
        .filter((cell, colIndex) => cell.rawValue !== "" && !group.columns.has(colIndex + 1));

      if (childCells.length > 0) {
        rows.push({ rowNumber, parentRowNumber: group.rowStart, cells: childCells, confidence });
      }
    }

    if (rows.length > 0) {
      tables.push({ sheetName: worksheet.name, confidence, method: "xlsx-merge-reconstruction", rows });
    }
  }

  return tables;
}
