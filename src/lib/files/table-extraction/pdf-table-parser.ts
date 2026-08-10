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
  /**
   * Pages whose vector grid could not be safely reconstructed by pdf-parse.
   * They are quarantined rather than failing the whole source or being
   * misreported as "no tables".
   */
  skippedTablePages: number[];
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
    method: "pdf-grid-detection",
    rows: parsedRows,
  };
}

/**
 * pdf-parse 2.4.5's vector-grid reconstruction can dereference a missing
 * bottom grid line (`.from`) when a real construction drawing contains an
 * incomplete/intersecting grid. Quarantine only this exact upstream defect;
 * every other parser/runtime error must still fail loudly.
 */
function isKnownPdfTableGeometryError(error: unknown): boolean {
  return error instanceof TypeError
    && error.message === "Cannot read properties of undefined (reading 'from')";
}

/**
 * Detects real bordered/grid tables in a PDF (vector line/rectangle drawing
 * operators, matched to positioned text — pdf-parse's PDFParse.getTable()).
 * Plain text-aligned tables with no visible borders are not detected by
 * this method and are honestly reported as "no tabular structure found"
 * rather than guessed at.
 *
 * Detection is page-scoped so one malformed drawing grid cannot erase
 * reliable tables captured from another page or fail the whole source.
 */
export async function parsePdfTables(buffer: Buffer): Promise<PdfExtractionResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText({ pageJoiner: "" });
    const pagesWithText = textResult.pages.filter((page) => page.text.trim().length > 0);
    if (pagesWithText.length === 0) {
      return { tables: [], hasTextLayer: false, skippedTablePages: [] };
    }

    const tables: ParsedTable[] = [];
    const skippedTablePages: number[] = [];

    for (const textPage of pagesWithText) {
      try {
        const tableResult = await parser.getTable({ partial: [textPage.num] });
        for (const page of tableResult.pages) {
          page.tables.forEach((tableArray, tableIndex) => {
            const parsed = tableArrayToParsedTable(tableArray, page.num, tableIndex);
            if (parsed) tables.push(parsed);
          });
        }
      } catch (error) {
        if (!isKnownPdfTableGeometryError(error)) throw error;
        skippedTablePages.push(textPage.num);
      }
    }

    return { tables, hasTextLayer: true, skippedTablePages };
  } finally {
    await parser.destroy();
  }
}
