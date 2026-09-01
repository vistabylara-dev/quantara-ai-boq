import { ExtractionEngineType, ExtractionJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { hasReviewedRows, replaceExtractedTablesForFile } from "@/lib/repositories/extracted-table-repository";
import { hasReviewedTableDerivedCandidates } from "@/lib/repositories/extracted-entity-repository";
import { generateCandidatesFromStructuredTables } from "@/lib/services/source-candidate-bridge-service";
import { JOINERY_INDUSTRY_KEY } from "@/lib/furniture/types";
import {
  parseFurnitureWorkbookTables,
  UnsupportedFurnitureWorkbookError,
} from "@/lib/furniture/workbook-reader";
import { parseCsvTables } from "./table-extraction/csv-table-parser";
import { parseXlsxTables } from "./table-extraction/xlsx-table-parser";
import { parsePdfTables } from "./table-extraction/pdf-table-parser";
import { inferTableType } from "./table-extraction/infer-table-type";
import type { ParsedTable } from "./table-extraction/types";

export { TABLE_EXTRACTABLE_EXTENSIONS } from "./table-extraction/constants";

/**
 * Exact-industry dispatch only. Every other industry calls the existing XLSX
 * parser directly. A Joinery project whose workbook does not implement the
 * supported cutting-list fixture shape also falls back to that same parser.
 */
export async function parseXlsxTablesForIndustry(
  buffer: Buffer,
  industryKey: string,
): Promise<ParsedTable[]> {
  if (industryKey !== JOINERY_INDUSTRY_KEY) {
    return parseXlsxTables(buffer);
  }
  try {
    return await parseFurnitureWorkbookTables(buffer);
  } catch (error) {
    if (!(error instanceof UnsupportedFurnitureWorkbookError)) throw error;
    return parseXlsxTables(buffer);
  }
}

let cachedStorageAdapter: DocumentStorageAdapter | null = null;
function getProjectFileStorageAdapter(): DocumentStorageAdapter {
  if (!cachedStorageAdapter) {
    cachedStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "project-files" });
  }
  return cachedStorageAdapter;
}

extractionJobQueue.registerHandler(ExtractionEngineType.TABLE_EXTRACTION, async (job, ctx) => {
  const file = await prisma.projectFile.findUniqueOrThrow({
    where: { id: job.projectFileId },
    include: {
      project: {
        select: { industryEngine: { select: { key: true } } },
      },
    },
  });

  if ((await hasReviewedRows(job.companyId, job.projectFileId)) || (await hasReviewedTableDerivedCandidates(job.companyId, job.projectFileId))) {
    return { status: ExtractionJobStatus.COMPLETED, resultSummary: { skipped: true, reason: "Reviewed rows or review candidates already exist for this file; re-extraction was skipped to avoid discarding confirmed work." } };
  }

  await ctx.updateProgress(20, "reading file");
  const buffer = await getProjectFileStorageAdapter().getObject(file.storageKey);

  let parsedTables: ParsedTable[];
  let noTextLayerMessage: string | null = null;
  let skippedTablePages: number[] = [];
  let geometryFailedPages: number[] = [];
  let textFallbackPages: number[] = [];

  await ctx.updateProgress(35, file.extension === "pdf" ? "detecting schedule-table grids" : "parsing structured table");

  switch (file.extension) {
    case "csv":
      parsedTables = parseCsvTables(buffer);
      break;
    case "xlsx":
      parsedTables = await parseXlsxTablesForIndustry(buffer, file.project.industryEngine.key);
      break;
    case "pdf": {
      const result = await parsePdfTables(buffer);
      parsedTables = result.tables;
      skippedTablePages = result.skippedTablePages;
      geometryFailedPages = result.geometryFailedPages;
      textFallbackPages = result.textFallbackPages;
      if (!result.hasTextLayer) {
        noTextLayerMessage = "This PDF has no extractable text layer (likely a scanned image). OCR-based extraction is not yet available — upload a text-based PDF, or CSV/XLSX for structured extraction.";
      }
      break;
    }
    default:
      return { status: ExtractionJobStatus.NEEDS_REVIEW, resultSummary: { message: `Table extraction is not supported for .${file.extension} files.`, tablesFound: 0 } };
  }

  if (noTextLayerMessage) {
    return { status: ExtractionJobStatus.NEEDS_REVIEW, resultSummary: { message: noTextLayerMessage, tablesFound: 0 } };
  }

  if (parsedTables.length === 0 && geometryFailedPages.length > 0) {
    // CANVA-HUMAN-JOURNEY-FINAL — never lead with "could not be safely
    // reconstructed" as the primary message. Nothing was guessed; that's a
    // reason for confidence, not an apology. The friendly framing lives
    // here (not just in the UI) so every consumer of resultSummary.message
    // — including this NEEDS_REVIEW banner — gets it consistently.
    const pageCount = skippedTablePages.length;
    return {
      status: ExtractionJobStatus.NEEDS_REVIEW,
      resultSummary: {
        message:
          `Great — nothing was guessed. ${pageCount} page${pageCount === 1 ? "" : "s"} `
          + `need${pageCount === 1 ? "s" : ""} your help before we can safely turn ${pageCount === 1 ? "it" : "them"} into BOQ candidates. `
          + "Review the rendered page, type the missing information, or provide a structured CSV/XLSX schedule instead.",
        warningCode: "PDF_TABLE_GEOMETRY_UNSUPPORTED",
        tablesFound: 0,
        skippedTablePages,
        geometryFailedPages,
      },
    };
  }

  await ctx.updateProgress(60, "storing extracted tables");

  if (parsedTables.length === 0) {
    return { resultSummary: { tablesFound: 0, message: "No supported bordered schedule-table structure was found in this file." } };
  }

  const tableType = inferTableType(file.classification);
  const createdTableIds = await replaceExtractedTablesForFile(job.companyId, job.projectFileId, parsedTables, tableType);
  const status = file.extension === "pdf" ? ExtractionJobStatus.NEEDS_REVIEW : ExtractionJobStatus.COMPLETED;

  await ctx.updateProgress(80, "generating review candidates");
  const bridgeResult = await generateCandidatesFromStructuredTables({
    companyId: job.companyId,
    projectId: job.projectId,
    projectFileId: job.projectFileId,
    extractionJobId: job.id,
  });

  return {
    status,
    resultSummary: {
      tablesFound: parsedTables.length,
      extractedTableIds: createdTableIds,
      rowsFound: parsedTables.reduce((sum, table) => sum + table.rows.length, 0),
      method: parsedTables[0]?.method,
      tablesConsidered: bridgeResult.tablesConsidered,
      rowsConsidered: bridgeResult.rowsConsidered,
      candidatesCreated: bridgeResult.candidatesCreated,
      ...(skippedTablePages.length > 0
        ? { pagesWithoutRecoveredTables: skippedTablePages }
        : {}),
      ...(geometryFailedPages.length > 0
        ? {
            geometryFailedPages,
            warningCode: "PDF_TABLE_GEOMETRY_UNSUPPORTED",
            message:
              `Great — we found useful information. ${parsedTables.reduce((sum, t) => sum + t.rows.length, 0)} rows are ready to review, `
              + `and ${geometryFailedPages.length} page${geometryFailedPages.length === 1 ? "" : "s"} need${geometryFailedPages.length === 1 ? "s" : ""} your help. `
              + "Nothing uncertain was guessed.",
          }
        : {}),
      ...(textFallbackPages.length > 0
        ? {
            textFallbackPages,
            textFallbackCode: "PDF_TEXT_SCHEDULE_FALLBACK_USED",
            textFallbackMessage:
              `Schedule rows on page(s) ${textFallbackPages.join(", ")} were reconstructed from exact PDF text-layer values `
              + "after vector-grid extraction was unavailable or produced no usable table. Professional review remains required.",
          }
        : {}),
      ...(bridgeResult.status === "skipped"
        ? { candidateGenerationSkipped: true, candidateGenerationSkippedReason: bridgeResult.reason }
        : {}),
    },
  };
});
