import { ExtractionEngineType, ExtractionJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { hasReviewedRows, replaceExtractedTablesForFile } from "@/lib/repositories/extracted-table-repository";
import { hasReviewedTableDerivedCandidates } from "@/lib/repositories/extracted-entity-repository";
import { generateCandidatesFromStructuredTables } from "@/lib/services/source-candidate-bridge-service";
import { parseCsvTables } from "./table-extraction/csv-table-parser";
import { parseXlsxTables } from "./table-extraction/xlsx-table-parser";
import { parsePdfTables } from "./table-extraction/pdf-table-parser";
import { inferTableType } from "./table-extraction/infer-table-type";
import type { ParsedTable } from "./table-extraction/types";

export { TABLE_EXTRACTABLE_EXTENSIONS } from "./table-extraction/constants";

let cachedStorageAdapter: DocumentStorageAdapter | null = null;
function getProjectFileStorageAdapter(): DocumentStorageAdapter {
  if (!cachedStorageAdapter) {
    cachedStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "project-files" });
  }
  return cachedStorageAdapter;
}

extractionJobQueue.registerHandler(ExtractionEngineType.TABLE_EXTRACTION, async (job, ctx) => {
  const file = await prisma.projectFile.findUniqueOrThrow({ where: { id: job.projectFileId } });

  if ((await hasReviewedRows(job.companyId, job.projectFileId)) || (await hasReviewedTableDerivedCandidates(job.companyId, job.projectFileId))) {
    return { status: ExtractionJobStatus.COMPLETED, resultSummary: { skipped: true, reason: "Reviewed rows or review candidates already exist for this file; re-extraction was skipped to avoid discarding confirmed work." } };
  }

  await ctx.updateProgress(20, "reading file");
  const buffer = await getProjectFileStorageAdapter().getObject(file.storageKey);

  let parsedTables: ParsedTable[];
  let noTextLayerMessage: string | null = null;
  let skippedTablePages: number[] = [];
  let textFallbackPages: number[] = [];

  await ctx.updateProgress(35, file.extension === "pdf" ? "detecting schedule-table grids" : "parsing structured table");

  switch (file.extension) {
    case "csv":
      parsedTables = parseCsvTables(buffer);
      break;
    case "xlsx":
      parsedTables = await parseXlsxTables(buffer);
      break;
    case "pdf": {
      const result = await parsePdfTables(buffer);
      parsedTables = result.tables;
      skippedTablePages = result.skippedTablePages;
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

  if (parsedTables.length === 0 && skippedTablePages.length > 0) {
    return {
      status: ExtractionJobStatus.NEEDS_REVIEW,
      resultSummary: {
        message:
          `Schedule-table grid geometry on page(s) ${skippedTablePages.join(", ")} could not be safely reconstructed. `
          + "Those pages were not converted into BOQ candidates; review the rendered pages or provide a structured CSV/XLSX schedule.",
        warningCode: "PDF_TABLE_GEOMETRY_UNSUPPORTED",
        tablesFound: 0,
        skippedTablePages,
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
        ? {
            skippedTablePages,
            warningCode: "PDF_TABLE_GEOMETRY_UNSUPPORTED",
            message:
              `Reliable tables were captured from supported pages. Page(s) ${skippedTablePages.join(", ")} contained `
              + "grid geometry that could not be safely reconstructed and had no safe structural text fallback.",
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
