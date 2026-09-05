import type { ParsedCell, ParsedTable, ParsedTableRow } from "./types";
import { normalizeColumnKey } from "./column-normalization";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — the third deterministic PDF table-recovery
 * fallback, tried only after both pdf-grid-detection (vector geometry) and
 * pdf-text-schedule-fallback (known FOOTING/BEAM regex schedules) fail to
 * recover anything from a page.
 *
 * No OCR, no image guessing, no AI geometry hallucination. This works
 * entirely from pdf-parse's own PDF text-coordinate engine: getText() is
 * called (by the caller, pdf-table-parser.ts) with cellSeparator/
 * cellThreshold set, which inserts a tab wherever two text items on the
 * same baseline have a horizontal gap exceeding cellThreshold — pdf-parse's
 * real column-band detection, not a hand-rolled one — and lineThreshold
 * clusters text items into rows by vertical (Y) proximity. This module's
 * only job is deciding, from the resulting tab/newline-delimited grid,
 * whether that reconstruction is trustworthy enough to call a table.
 *
 * Deterministic, not fuzzy: a page becomes a table only if enough rows
 * (MIN_ROWS_FOR_TABLE) agree on the exact same column count. Rows with a
 * different count are dropped as noise (running headers/footers, stray
 * captions) rather than forced to fit — an inconsistent page is rejected
 * outright (returns []), never guessed into a wrong shape.
 */

const FALLBACK_CONFIDENCE = 40; // Lower than the schedule-specific fallback (50) — this is generic, not semantically verified against a known BOQ schedule format.
const MIN_ROWS_FOR_TABLE = 3; // header + at least 2 data rows sharing the same column count
const MIN_COLUMNS = 2;

function isHeaderlessJoineryItemSchedule(rows: string[][], columnCount: number): boolean {
  if (columnCount !== 3 || rows.length < MIN_ROWS_FOR_TABLE) return false;
  return rows.every((row) => (
    /^J\d+[A-Z]?$/i.test(row[0]?.trim() ?? "")
    && (row[1]?.trim().length ?? 0) > 0
    && (row[2]?.trim().length ?? 0) > 0
  ));
}

function splitIntoCellRows(cellSeparatedText: string): string[][] {
  // Deliberately do NOT trim trailing whitespace off the whole line before
  // splitting — a trailing tab is a meaningful empty final cell (e.g. a row
  // with a real value in every column except the last), not padding.
  // Stripping it here previously changed that row's cell count and caused
  // it to be silently excluded from the table entirely instead of kept
  // with an empty cell.
  return cellSeparatedText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split("\t").map((cellText) => cellText.trim()));
}

function findDominantColumnCount(rows: string[][]): { count: number; frequency: number } {
  const frequency = new Map<number, number>();
  for (const row of rows) {
    if (row.length < MIN_COLUMNS) continue;
    frequency.set(row.length, (frequency.get(row.length) ?? 0) + 1);
  }
  let dominantCount = 0;
  let dominantFrequency = 0;
  for (const [count, freq] of frequency) {
    if (freq > dominantFrequency) {
      dominantCount = count;
      dominantFrequency = freq;
    }
  }
  return { count: dominantCount, frequency: dominantFrequency };
}

export function parsePositionalTextFallback(cellSeparatedText: string, pageNumber: number): ParsedTable[] {
  const rows = splitIntoCellRows(cellSeparatedText);
  const { count: dominantColumnCount, frequency } = findDominantColumnCount(rows);

  // Not enough rows agree on a shape — reject rather than guess.
  if (frequency < MIN_ROWS_FOR_TABLE) return [];

  const matchingRows = rows.filter((row) => row.length === dominantColumnCount);
  const headerlessJoinery = isHeaderlessJoineryItemSchedule(matchingRows, dominantColumnCount);
  const headerRow = headerlessJoinery
    ? ["Item code", "Room", "Description"]
    : matchingRows[0];
  const dataRows = headerlessJoinery ? matchingRows : matchingRows.slice(1);
  if (!headerRow || dataRows.length === 0) return [];

  const parsedRows: ParsedTableRow[] = dataRows
    .map((row, index): ParsedTableRow => {
      const cells: ParsedCell[] = row
        .map((rawValue, columnIndex): ParsedCell => {
          const columnTitle = headerRow[columnIndex]?.trim() || `Column ${columnIndex + 1}`;
          return {
            columnKey: normalizeColumnKey(columnTitle, columnIndex),
            columnTitle,
            rawValue: rawValue.trim(),
            sourceCellReference: `page ${pageNumber}, positional row ${index + 2}, col ${columnIndex + 1}`,
          };
        })
        .filter((c) => c.rawValue !== "");
      if (headerlessJoinery) {
        const itemCode = row[0]!.trim();
        cells.push({
          columnKey: "quantity",
          columnTitle: "Quantity",
          rawValue: "1",
          sourceCellReference: `page ${pageNumber}, scheduled item ${itemCode}, one row occurrence`,
        });
        cells.push({
          columnKey: "unit",
          columnTitle: "Unit",
          rawValue: "nr",
          sourceCellReference: `page ${pageNumber}, scheduled item ${itemCode}, counted occurrence`,
        });
      }
      return { rowNumber: index + 1, confidence: FALLBACK_CONFIDENCE, cells };
    })
    .filter((row) => row.cells.length > 0);

  if (parsedRows.length === 0) return [];

  return [
    {
      title: headerlessJoinery
        ? `Joinery item schedule — page ${pageNumber}`
        : `Recovered table — page ${pageNumber}`,
      confidence: FALLBACK_CONFIDENCE,
      method: "pdf-positional-text-fallback",
      rows: parsedRows,
    },
  ];
}
