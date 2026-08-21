import { PDFParse } from "pdf-parse";
import type { ParsedTable } from "./types";
import { parsePdfGridTable } from "./pdf-table-grid-normalization";
import { parseStructuralScheduleTextFallback } from "./pdf-text-schedule-fallback";
import { parsePositionalTextFallback } from "./pdf-positional-text-fallback";

export type PdfExtractionResult = {
  tables: ParsedTable[];
  hasTextLayer: boolean;
  /** Every text page for which no schedule table was recovered. */
  skippedTablePages: number[];
  /** Subset of skippedTablePages where pdf-parse threw the known incomplete-grid geometry error. */
  geometryFailedPages: number[];
  textFallbackPages: number[];
  /** Subset of textFallbackPages recovered via the generic positional (column-band) fallback, not the FOOTING/BEAM schedule regexes. */
  positionalFallbackPages: number[];
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
        positionalFallbackPages: [],
      };
    }

    const tables: ParsedTable[] = [];
    const skippedTablePages: number[] = [];
    const geometryFailedPages: number[] = [];
    const textFallbackPages: number[] = [];
    const positionalFallbackPages: number[] = [];

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
          continue;
        }

        // Third fallback: pdf-parse's own line/cell reconstruction (real
        // PDF text-coordinate row/column clustering — see
        // pdf-positional-text-fallback.ts), tried only after both the grid
        // and the known-schedule regex fallback found nothing. A fresh
        // getText() call for just this page, since the earlier one used
        // default separators unsuitable for column detection.
        const positionalText = await parser.getText({
          partial: [textPage.num],
          pageJoiner: "",
          lineEnforce: true,
          cellSeparator: "\t",
        });
        const positionalFallback = parsePositionalTextFallback(positionalText.text, textPage.num);
        if (positionalFallback.length > 0) {
          tables.push(...positionalFallback);
          textFallbackPages.push(textPage.num);
          positionalFallbackPages.push(textPage.num);
        } else {
          // Record every page where neither vector-grid extraction nor either
          // text fallback recovered a table. geometryFailedPages separately
          // distinguishes a parser failure from a normal non-table page.
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
      positionalFallbackPages,
    };
  } finally {
    await parser.destroy();
  }
}
