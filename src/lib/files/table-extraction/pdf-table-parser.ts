import { PDFParse } from "pdf-parse";
import { normalizeColumnKey } from "./column-normalization";
import type { ParsedTable, ParsedTableRow } from "./types";

// Real detected grid structure (drawn table borders), not a guess — moderate confidence, but
// still always forced to NEEDS_REVIEW by the caller (no vector/DPI cross-check against the
// actual page geometry the way a true layout engine would do; spec section 6: PDF "table
// extraction where reliable" never means auto-trusted for commercial use).
const CONFIDENCE = 65;

export type PdfExtractionResult = {
  tables: ParsedTable[];
  hasTextLayer: boolean;
};

function tableArrayToParsedTable(rows: string[][], pageNumber: number, tableIndex: number): ParsedTable | null {
  if (rows.length < 2) return null;
  const [headerRow, ...dataRows] = rows;
  const columnKeys = headerRow.map((header, index) => normalizeColumnKey(header, index));

  const parsedRows: ParsedTableRow[] = dataRows
    .map((row, rowIndex) => ({
      rowNumber: rowIndex + 2,
      confidence: CONFIDENCE,
      cells: columnKeys
        .map((columnKey, colIndex) => ({
          columnKey,
          rawValue: (row[colIndex] ?? "").trim(),
          sourceCellReference: `page ${pageNumber}, table ${tableIndex + 1}, row ${rowIndex + 2}`,
        }))
        .filter((cell) => cell.rawValue !== ""),
    }))
    .filter((row) => row.cells.length > 0);

  if (parsedRows.length === 0) return null;
  return {
    title: headerRow.join(" | "),
    confidence: CONFIDENCE,
    method: "pdf-whitespace-heuristic",
    rows: parsedRows,
  };
}

/**
 * Detects real bordered/grid tables in a PDF (vector line/rectangle drawing
 * operators, matched to positioned text — pdf-parse's own PDFParse.getTable()).
 * Plain text-aligned tables with no visible borders are not detected by
 * this method and are honestly reported as "no tabular structure found"
 * rather than guessed at — a whitespace-position heuristic for that case
 * proved unreliable across the PDF-generation tools available for testing
 * this and was deliberately not shipped (see pdf-table-parser.test notes).
 */
export async function parsePdfTables(buffer: Buffer): Promise<PdfExtractionResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    // pageJoiner defaults to a non-empty "-- page N of M --" marker per page, which would make
    // an otherwise-blank/textless page's concatenated text non-empty; disabling it keeps this
    // check honest.
    const textResult = await parser.getText({ pageJoiner: "" });
    const hasTextLayer = textResult.text.trim().length > 0;
    if (!hasTextLayer) {
      return { tables: [], hasTextLayer: false };
    }

    const tableResult = await parser.getTable();
    const tables: ParsedTable[] = [];
    for (const page of tableResult.pages) {
      page.tables.forEach((tableArray, tableIndex) => {
        const parsed = tableArrayToParsedTable(tableArray, page.num, tableIndex);
        if (parsed) tables.push(parsed);
      });
    }

    return { tables, hasTextLayer: true };
  } finally {
    await parser.destroy();
  }
}
