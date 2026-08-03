import { ExtractionEngineType, ExtractionJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import { localProjectFileStorageAdapter } from "@/lib/storage/local-project-file-storage-adapter";
import { hasReviewedRows, replaceExtractedTablesForFile } from "@/lib/repositories/extracted-table-repository";
import { parseCsvTables } from "./table-extraction/csv-table-parser";
import { parseXlsxTables } from "./table-extraction/xlsx-table-parser";
import { parsePdfTables } from "./table-extraction/pdf-table-parser";
import { inferTableType } from "./table-extraction/infer-table-type";
import type { ParsedTable } from "./table-extraction/types";

/** File types this engine can actually parse today — kept in sync with the routes that enqueue it. */
export const TABLE_EXTRACTABLE_EXTENSIONS = ["csv", "xlsx", "pdf"] as const;

extractionJobQueue.registerHandler(ExtractionEngineType.TABLE_EXTRACTION, async (job, ctx) => {
  const file = await prisma.projectFile.findUniqueOrThrow({ where: { id: job.projectFileId } });

  if (await hasReviewedRows(job.companyId, job.projectFileId)) {
    return { status: ExtractionJobStatus.COMPLETED, resultSummary: { skipped: true, reason: "Reviewed rows already exist for this file; re-extraction was skipped to avoid discarding confirmed work." } };
  }

  await ctx.updateProgress(20, "reading file");
  const buffer = await localProjectFileStorageAdapter.getObject(file.storageKey);

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

  return {
    status,
    resultSummary: {
      tablesFound: parsedTables.length,
      extractedTableIds: createdTableIds,
      rowsFound: parsedTables.reduce((sum, table) => sum + table.rows.length, 0),
      method: parsedTables[0]?.method,
    },
  };
});
