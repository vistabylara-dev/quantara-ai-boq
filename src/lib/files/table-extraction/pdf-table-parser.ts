import { PDFParse } from "pdf-parse";
import type { ParsedTable } from "./types";
import { parsePdfGridTable } from "./pdf-table-grid-normalization";
import { parseStructuralScheduleTextFallback } from "./pdf-text-schedule-fallback";

export type PdfExtractionResult = {
  tables: ParsedTable[];
  hasTextLayer: boolean;
  /** Every text page for which no schedule table was recovered. */
  skippedTablePages: number[];
  /** Subset of skippedTablePages where pdf-parse threw the known incomplete-grid geometry error. */
  geometryFailedPages: number[];
  textFallbackPages: number[];
};

function isKnownPdfTableGeometryError(error: unknown): boolean {
  return error instanceof TypeError
    && error.message === "Cannot read properties of undefined (reading 'from')";
}

export async function parsePdfTables(buffer: Buffer): Promise<PdfExtractionResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText({ pageJoiner: "" });
    const pagesWithText = textResult.pages.filter((page) => page.text.trim().length > 0);

    if (pagesWithText.length === 0) {
      return {
        tables: [],
        hasTextLayer: false,
        skippedTablePages: [],
        geometryFailedPages: [],
        textFallbackPages: [],
      };
    }

    const tables: ParsedTable[] = [];
    const skippedTablePages: number[] = [];
    const geometryFailedPages: number[] = [];
    const textFallbackPages: number[] = [];

    for (const textPage of pagesWithText) {
      const beforePageCount = tables.length;
      let geometryFailed = false;

      try {
        const tableResult = await parser.getTable({ partial: [textPage.num] });
        for (const page of tableResult.pages) {
          page.tables.forEach((tableArray, tableIndex) => {
            const parsed = parsePdfGridTable(tableArray, page.num, tableIndex);
            if (parsed) tables.push(parsed);
          });
        }
      } catch (error) {
        if (!isKnownPdfTableGeometryError(error)) throw error;
        geometryFailed = true;
        geometryFailedPages.push(textPage.num);
      }

      if (geometryFailed || tables.length === beforePageCount) {
        const fallback = parseStructuralScheduleTextFallback(textPage.text, textPage.num);
        if (fallback.length > 0) {
          tables.push(...fallback);
          textFallbackPages.push(textPage.num);
        } else {
          // Record every page where neither vector-grid extraction nor the safe
          // structural text fallback recovered a table. geometryFailedPages
          // separately distinguishes a parser failure from a normal non-table page.
          skippedTablePages.push(textPage.num);
        }
      }
    }

    return {
      tables,
      hasTextLayer: true,
      skippedTablePages,
      geometryFailedPages,
      textFallbackPages,
    };
  } finally {
    await parser.destroy();
  }
}
