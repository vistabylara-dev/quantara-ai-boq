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

/** File types this engine can actually parse today — kept in sync with the routes that enqueue it. */
export const TABLE_EXTRACTABLE_EXTENSIONS = ["csv", "xlsx", "pdf"] as const;

/** Was hardcoded to the local-filesystem adapter — see preprocessing-handler.ts for the same production fix. */
let cachedStorageAdapter: DocumentStorageAdapter | null = null;
function getProjectFileStorageAdapter(): DocumentStorageAdapter {
  if (!cachedStorageAdapter) {
    cachedStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "project-files" });
  }
  return cachedStorageAdapter;
}

extractionJobQueue.registerHandler(ExtractionEngineType.TABLE_EXTRACTION, async (job, ctx) => {
  const file = await prisma.projectFile.findUniqueOrThrow({ where: { id: job.projectFileId } });

  // A reviewed row (legacy per-row review path) OR a reviewed TABLE_PARSER candidate (the
  // structured source → review-candidate bridge) both mean this file's tables must not be
  // silently replaced — a reviewed candidate's source table/row must never disappear under it.
  if ((await hasReviewedRows(job.companyId, job.projectFileId)) || (await hasReviewedTableDerivedCandidates(job.companyId, job.projectFileId))) {
    return { status: ExtractionJobStatus.COMPLETED, resultSummary: { skipped: true, reason: "Reviewed rows or review candidates already exist for this file; re-extraction was skipped to avoid discarding confirmed work." } };
  }

  await ctx.updateProgress(20, "reading file");
  const buffer = await getProjectFileStorageAdapter().getObject(file.storageKey);

  let parsedTables: ParsedTable[];
  let noTextLayerMessage: string | null = null;

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

  await ctx.updateProgress(60, "storing extracted tables");

  if (parsedTables.length === 0) {
    return { resultSummary: { tablesFound: 0, message: "No tabular structure was found in this file." } };
  }

  const tableType = inferTableType(file.classification);
  const createdTableIds = await replaceExtractedTablesForFile(job.companyId, job.projectFileId, parsedTables, tableType);

  // PDF-derived tables are a best-effort heuristic (no real layout coordinates) — never let them land as auto-confirmable; force review regardless of confidence.
  const status = file.extension === "pdf" ? ExtractionJobStatus.NEEDS_REVIEW : ExtractionJobStatus.COMPLETED;

  await ctx.updateProgress(80, "generating review candidates");
  // job.projectId is always the canonical project UUID (every enqueue call resolves it before
  // creating the job), so this always resolves immediately — never fails on a fresh table set.
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
      ...(bridgeResult.status === "skipped"
        ? { candidateGenerationSkipped: true, candidateGenerationSkippedReason: bridgeResult.reason }
        : {}),
    },
  };
});
