import { ImportJobStatus, ImportRowStatus, RateProvenanceSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { RETIRED_COMBINED_INDUSTRY_KEY } from "@/lib/repositories/industry-repository";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { parseCsv } from "@/lib/imports/csv-parser";
import { parseXlsx } from "@/lib/imports/xlsx-parser";
import { createLibraryItem } from "@/lib/repositories/company-library-repository";
import { createBOQItem, getBOQ, listProjectBOQs } from "@/lib/repositories/boq-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { looksLikePdf, looksLikeZip } from "@/lib/validation/file-signatures";

// Raised from 2,000: real category files are running ~4,000+ rows each, and the old cap rejected
// the whole upload outright with no way around it. 10,000 leaves headroom above that while still
// bounding the per-row loops in validateImportJob/executeImportJob (each row is its own awaited
// Prisma call, not batched) — if uploads start regularly approaching this new ceiling, those loops
// should be batched before raising it further, since that's what would actually time out first.
const MAX_ROWS = 10_000;

/**
 * Maps a keyword that might appear in an uploaded file's name to the taxonomy key it should
 * resolve to. Two separate taxonomies exist in this codebase with inconsistent key naming —
 * MasterDiscipline (prisma/seed-data/master-data.ts, e.g. "mechanical" covers HVAC) for
 * CompanyLibraryItem, and IndustryEngine (prisma/seed.ts, e.g. "hvac") for RateCatalogueItem — so
 * two maps are kept deliberately separate rather than guessed from one shared list. Sorted
 * longest-keyword-first when matched so "fire-fighting" isn't shadowed by a shorter partial hit.
 */
const FILENAME_TO_MASTER_DISCIPLINE_KEY: [string, string][] = [
  ["fire-fighting", "fire-fighting"],
  ["firefighting", "fire-fighting"],
  ["interior-fit-out", "interior-fit-out"],
  ["interior-fitout", "interior-fit-out"],
  ["fitout", "interior-fit-out"],
  ["landscaping", "landscaping"],
  ["construction", "construction"],
  ["furniture", "furniture"],
  ["electrical", "electrical"],
  ["plumbing", "plumbing"],
  ["mechanical", "mechanical"],
  ["joinery", "joinery"],
  ["hvac", "mechanical"],
];

const FILENAME_TO_INDUSTRY_ENGINE_KEY: [string, string][] = [
  ["interior-fit-out", "interior-fitout"],
  ["interior-fitout", "interior-fitout"],
  ["fitout", "interior-fitout"],
  ["fire-fighting", "firefighting"],
  ["firefighting", "firefighting"],
  ["construction", "construction"],
  ["furniture", "furniture"],
  ["electrical", "electrical"],
  ["plumbing", "plumbing"],
  ["landscaping", "landscaping"],
  ["joinery", "joinery"],
  ["hvac", "hvac"],
  ["mep", "mep"],
];

function matchKeywordKey(fileName: string, map: [string, string][]): string | null {
  const lower = fileName.toLowerCase();
  const sorted = [...map].sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, key] of sorted) {
    if (lower.includes(keyword)) return key;
  }
  return null;
}

/** Resolves the MasterDiscipline to attach a COMPANY_LIBRARY import's items to, from a keyword in
 * the uploaded file's name (e.g. "hvac-company-library-import.csv" -> "mechanical"). Returns null
 * if nothing matches or the discipline doesn't exist in this deployment — callers leave
 * disciplineId unset in that case rather than guessing. */
async function resolveDisciplineIdFromFilename(fileName: string): Promise<string | null> {
  const key = matchKeywordKey(fileName, FILENAME_TO_MASTER_DISCIPLINE_KEY);
  if (!key) return null;
  const discipline = await prisma.masterDiscipline.findUnique({ where: { key } });
  return discipline?.id ?? null;
}

/** Resolves the IndustryEngine to attach a RATE_CATALOGUE import's items to, from a keyword in the
 * uploaded file's name. Only returns an ID if that industry is already enabled for this company —
 * silently turning on an industry the company hasn't enabled would be a scope change, not just a
 * data-mapping shortcut. Falls back to null so the caller keeps its existing "any enabled
 * industry" behavior. */
async function resolveIndustryEngineIdFromFilename(companyId: string, fileName: string): Promise<string | null> {
  const key = matchKeywordKey(fileName, FILENAME_TO_INDUSTRY_ENGINE_KEY);
  if (!key) return null;
  const match = await prisma.companyIndustryEngine.findFirst({ where: { companyId, enabled: true, industryEngine: { key } } });
  return match?.industryEngineId ?? null;
}

/** Normalized field keys a mapping can target — deliberately flat, matching spec section 21's column list. */
export const IMPORT_FIELD_KEYS = [
  "itemCode",
  "discipline",
  "category",
  "description",
  "specification",
  "quantity",
  "unit",
  "supplier",
  "cost",
  "margin",
  "sellingRate",
  "manufacturer",
  "brand",
  "model",
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELD_KEYS)[number];

function toJobDTO(row: Awaited<ReturnType<typeof getJobRecord>>) {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    uploadedFileName: row.uploadedFileName,
    headers: (row.headersJson as string[] | null) ?? [],
    mappingTemplateId: row.mappingTemplateId,
    sourceType: row.sourceType,
    destinationType: row.destinationType,
    status: row.status,
    totalRows: row.totalRows,
    validRows: row.validRows,
    warningRows: row.warningRows,
    errorRows: row.errorRows,
    importedRows: row.importedRows,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
  };
}

async function getJobRecord(companyId: string, importJobId: string) {
  const row = await prisma.importJob.findFirst({ where: { id: importJobId, companyId } });
  if (!row) throw new NotFoundError("Import job not found.");
  return row;
}

function toRowDTO(row: {
  id: string; rowNumber: number; rawDataJson: unknown; normalizedDataJson: unknown;
  validationErrorsJson: unknown; validationWarningsJson: unknown; status: ImportRowStatus; destinationEntityId: string | null;
}) {
  return {
    id: row.id,
    rowNumber: row.rowNumber,
    rawData: row.rawDataJson,
    normalizedData: row.normalizedDataJson,
    validationErrors: row.validationErrorsJson,
    validationWarnings: row.validationWarningsJson,
    status: row.status,
    destinationEntityId: row.destinationEntityId,
  };
}

export type CreateImportJobInput = {
  projectId?: string;
  uploadedFileName: string;
  buffer: Buffer;
  sourceType: "CSV" | "XLSX";
  destinationType: "COMPANY_LIBRARY" | "RATE_CATALOGUE" | "DRAFT_BOQ" | "STAGING_REVIEW";
  mappingTemplateId?: string;
};

/**
 * Import is a spreadsheet-only workflow (CSV/XLSX quantity/catalogue data) — it must never hand a
 * drawing or any other binary document to the XLSX/CSV parser. `sourceType` above is entirely
 * client-supplied (derived from the filename in the browser, not verified), so a mislabeled or
 * misrouted upload — e.g. a PDF sent here because a dashboard link pointed at /imports instead of
 * the project drawing uploader — would otherwise reach the XLSX parser and surface a confusing,
 * wrong "This XLSX file couldn't be read" error for a file that was never a spreadsheet. Checking
 * the real byte signature before parsing catches that class of mistake at the source, with an
 * error message that actually describes what went wrong.
 */
function assertLooksLikeSpreadsheet(buffer: Buffer, sourceType: "CSV" | "XLSX"): void {
  if (looksLikePdf(buffer)) {
    throw new AppError(
      "IMPORT_FILE_NOT_SPREADSHEET",
      "This file is a PDF, not a spreadsheet. Import only accepts CSV/XLSX data files — to upload a drawing, use Upload Drawing on the project's Drawings page instead.",
      400,
    );
  }
  if (sourceType === "XLSX" && !looksLikeZip(buffer)) {
    throw new AppError(
      "IMPORT_FILE_NOT_SPREADSHEET",
      "This file does not appear to be a valid XLSX spreadsheet. Export/save it as .xlsx or .csv and try again.",
      400,
    );
  }
}

/** Upload -> parse only. Nothing is imported until mapping, validation, row approval, and an explicit execute call. */
export async function createImportJob(actor: CurrentActor, input: CreateImportJobInput) {
  requireCapability(actor, "imports:manage");

  if (input.projectId) await getProjectRecord(actor.companyId, input.projectId);

  const buffer = input.buffer;
  assertLooksLikeSpreadsheet(buffer, input.sourceType);
  let rows: string[][];
  if (input.sourceType === "CSV") {
    rows = parseCsv(buffer.toString("utf-8"));
  } else {
    try {
      rows = await parseXlsx(buffer);
    } catch (error) {
      // exceljs (the underlying XLSX parser) has a known crash on workbooks that contain a
      // native Excel structured Table (Insert > Table / "Format as Table") — it throws deep
      // inside its own model-building code, unrelated to anything in this app. That used to
      // surface as an opaque "unexpected server error" with no way to tell what went wrong.
      // Surfacing it as a specific, actionable error here instead of letting it fall through to
      // the generic 500 handler.
      console.error("[imports] XLSX parse failed", error);
      throw new AppError(
        "XLSX_PARSE_FAILED",
        "This XLSX file couldn't be read. If it contains a formatted Excel Table (select it, then Table Design → Convert to Range in Excel, or Insert → Table was used to build it), that's the likely cause — convert it to a plain range and re-save, or export/save the file as CSV and upload that instead.",
        400,
      );
    }
  }
  if (rows.length === 0) throw new AppError("EMPTY_FILE", "No rows were found in the uploaded file.", 400);
  if (rows.length - 1 > MAX_ROWS) throw new AppError("TOO_MANY_ROWS", `This import exceeds the ${MAX_ROWS}-row limit.`, 400);

  const [headers, ...dataRows] = rows;

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.importJob.create({
      data: {
        companyId: actor.companyId,
        projectId: input.projectId,
        uploadedFileName: input.uploadedFileName,
        headersJson: headers,
        mappingTemplateId: input.mappingTemplateId,
        sourceType: input.sourceType,
        destinationType: input.destinationType,
        status: ImportJobStatus.PENDING,
        totalRows: dataRows.length,
        createdByUserId: actor.userId,
      },
    });
    await tx.importRow.createMany({
      data: dataRows.map((cells, index) => ({
        companyId: actor.companyId,
        importJobId: created.id,
        rowNumber: index + 1,
        rawDataJson: Object.fromEntries(headers.map((header, columnIndex) => [header || `column_${columnIndex + 1}`, cells[columnIndex] ?? ""])),
        status: ImportRowStatus.PENDING,
      })),
    });
    await createAuditLog(actor.companyId, { entityType: "ImportJob", entityId: created.id, action: "IMPORT_JOB_CREATED", payload: { rows: dataRows.length, sourceType: input.sourceType, destinationType: input.destinationType } }, tx);
    return created;
  });

  return toJobDTO(job);
}

export async function getImportJobForCompany(actor: CurrentActor, importJobId: string) {
  const job = await getJobRecord(actor.companyId, importJobId);
  const rows = await prisma.importRow.findMany({ where: { companyId: actor.companyId, importJobId }, orderBy: { rowNumber: "asc" }, take: 500 });
  return { job: toJobDTO(job), rows: rows.map(toRowDTO) };
}

export async function listImportJobsForCompany(actor: CurrentActor) {
  const rows = await prisma.importJob.findMany({ where: { companyId: actor.companyId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map(toJobDTO);
}

export type UpdateMappingInput = { mappingJson: Record<string, string | null>; saveAsTemplateName?: string };

export async function updateImportMapping(actor: CurrentActor, importJobId: string, input: UpdateMappingInput) {
  requireCapability(actor, "imports:manage");
  const job = await getJobRecord(actor.companyId, importJobId);

  const rows = await prisma.importRow.findMany({ where: { companyId: actor.companyId, importJobId }, orderBy: { rowNumber: "asc" } });
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const raw = row.rawDataJson as Record<string, string>;
      const normalized: Record<string, string> = {};
      for (const [fieldKey, sourceColumn] of Object.entries(input.mappingJson)) {
        if (!sourceColumn) continue;
        normalized[fieldKey] = raw[sourceColumn] ?? "";
      }
      await tx.importRow.update({ where: { id: row.id, companyId: actor.companyId }, data: { normalizedDataJson: normalized, status: ImportRowStatus.PENDING } });
    }
    await tx.importJob.update({ where: { id: job.id, companyId: actor.companyId }, data: { status: ImportJobStatus.PENDING } });

    if (input.saveAsTemplateName) {
      await tx.importMappingTemplate.upsert({
        where: { companyId_name: { companyId: actor.companyId, name: input.saveAsTemplateName } },
        update: { mappingJson: input.mappingJson, sourceType: job.sourceType, destinationType: job.destinationType },
        create: {
          companyId: actor.companyId,
          name: input.saveAsTemplateName,
          sourceType: job.sourceType,
          destinationType: job.destinationType,
          mappingJson: input.mappingJson,
          createdByUserId: actor.userId,
        },
      });
      await createAuditLog(actor.companyId, { entityType: "ImportMappingTemplate", entityId: job.id, action: "IMPORT_MAPPING_SAVED", payload: { name: input.saveAsTemplateName } }, tx);
    }
  });

  return getImportJobForCompany(actor, importJobId);
}

const REQUIRED_FIELDS_BY_DESTINATION: Record<string, ImportFieldKey[]> = {
  COMPANY_LIBRARY: ["itemCode", "description", "unit"],
  RATE_CATALOGUE: ["itemCode", "description", "unit", "cost"],
  DRAFT_BOQ: ["itemCode", "description", "quantity", "unit"],
  STAGING_REVIEW: [],
};

/**
 * Evaluates one row's normalized data. A missing required field is deliberately a WARNING, not an
 * ERROR: ERROR rows have no checkbox in the review table and can never be approved, which used to
 * hard-block an entire row over one empty cell with no way to proceed except re-uploading a fixed
 * file. WARNING rows stay selectable/approvable as-is (imported with that field blank/defaulted)
 * or can be fixed in place via updateImportRow before approving. Only genuinely malformed data
 * (a cost/quantity that isn't a number) stays a hard ERROR, since there's no sane default for that.
 *
 * A duplicate item code (matches an existing record, or repeats an earlier row in this same file)
 * is auto-REJECTED rather than flagged as a reviewable warning — per an explicit product decision,
 * duplicates are skipped automatically with no manual step, and the existing record is never
 * touched, overwritten, or deleted. The first occurrence of a code within a batch is not treated
 * as a duplicate of itself; only repeats after it are skipped.
 */
function evaluateNormalizedRow(
  normalized: Record<string, string>,
  requiredFields: ImportFieldKey[],
  destinationType: string,
  existingLibraryCodes: Set<string>,
  existingCatalogueCodes: Set<string>,
  seenInBatch: Set<string>,
): { status: ImportRowStatus; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isDuplicate = false;

  for (const field of requiredFields) {
    if (!normalized[field]?.trim()) {
      warnings.push(`Column mapped to "${field}" is required but missing on this row — edit the row to fill it in, or approve anyway to import it blank.`);
    }
  }
  if (normalized.quantity !== undefined && normalized.quantity.trim() && Number.isNaN(Number(normalized.quantity))) {
    errors.push("Quantity is not a valid number.");
  }
  if (normalized.cost !== undefined && normalized.cost.trim() && Number.isNaN(Number(normalized.cost))) {
    errors.push("Cost is not a valid number.");
  }

  const code = normalized.itemCode?.trim().toLowerCase();
  if (code) {
    if (destinationType === "COMPANY_LIBRARY" && existingLibraryCodes.has(code)) {
      warnings.push("Skipped automatically — an existing company library item already uses this item code. That item was not changed.");
      isDuplicate = true;
    }
    if (destinationType === "RATE_CATALOGUE" && existingCatalogueCodes.has(code)) {
      warnings.push("Skipped automatically — an existing rate catalogue item already uses this item code. That item was not changed.");
      isDuplicate = true;
    }
    if (seenInBatch.has(code)) {
      warnings.push("Skipped automatically — duplicate item code within this import file.");
      isDuplicate = true;
    }
    seenInBatch.add(code);
  }

  const status = errors.length > 0
    ? ImportRowStatus.ERROR
    : isDuplicate
      ? ImportRowStatus.REJECTED
      : warnings.length > 0
        ? ImportRowStatus.WARNING
        : ImportRowStatus.VALID;

  return { status, errors, warnings };
}

/** Shared by the initial validate pass and by updateImportRow after a manual edit — re-runs
 * against every row in the job (not just the changed one) so duplicate-item-code detection across
 * the batch stays correct. */
async function revalidateAllRows(actor: CurrentActor, job: Awaited<ReturnType<typeof getJobRecord>>) {
  const requiredFields = REQUIRED_FIELDS_BY_DESTINATION[job.destinationType] ?? [];
  const rows = await prisma.importRow.findMany({ where: { companyId: actor.companyId, importJobId: job.id }, orderBy: { rowNumber: "asc" } });
  const existingLibraryCodes = new Set((await prisma.companyLibraryItem.findMany({ where: { companyId: actor.companyId }, select: { companyItemCode: true } })).map((r) => r.companyItemCode.toLowerCase()));
  const existingCatalogueCodes = new Set((await prisma.rateCatalogueItem.findMany({ where: { companyId: actor.companyId }, select: { itemCode: true } })).map((r) => r.itemCode.toLowerCase()));
  const seenInBatch = new Set<string>();

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const normalized = (row.normalizedDataJson as Record<string, string> | null) ?? {};
      const { status, errors, warnings } = evaluateNormalizedRow(normalized, requiredFields, job.destinationType, existingLibraryCodes, existingCatalogueCodes, seenInBatch);
      if (status === ImportRowStatus.ERROR) errorCount += 1;
      else if (status === ImportRowStatus.WARNING) warningCount += 1;
      else validCount += 1;

      await tx.importRow.update({
        where: { id: row.id, companyId: actor.companyId },
        data: { status, validationErrorsJson: errors, validationWarningsJson: warnings },
      });
    }

    await tx.importJob.update({
      where: { id: job.id, companyId: actor.companyId },
      data: { status: ImportJobStatus.VALIDATED, validRows: validCount, warningRows: warningCount, errorRows: errorCount },
    });
    await createAuditLog(actor.companyId, { entityType: "ImportJob", entityId: job.id, action: "IMPORT_JOB_VALIDATED", payload: { validCount, warningCount, errorCount } }, tx);
  });

  return getImportJobForCompany(actor, job.id);
}

/** Validates every mapped row, flags duplicates and missing-required-field gaps as warnings (never auto-merged or auto-blocked), and updates the job's row-status counts. */
export async function validateImportJob(actor: CurrentActor, importJobId: string) {
  requireCapability(actor, "imports:manage");
  const job = await getJobRecord(actor.companyId, importJobId);
  return revalidateAllRows(actor, job);
}

export type UpdateImportRowInput = { normalizedDataJson: Record<string, string> };

/**
 * Lets a reviewer patch in values the source file was missing, or correct a bad mapping, without
 * re-uploading the whole file. Merges the patch into the row's existing normalized data, then
 * re-validates the whole job so status/counts stay consistent.
 */
export async function updateImportRow(actor: CurrentActor, importJobId: string, rowId: string, input: UpdateImportRowInput) {
  requireCapability(actor, "imports:manage");
  const job = await getJobRecord(actor.companyId, importJobId);

  const target = await prisma.importRow.findFirst({ where: { id: rowId, companyId: actor.companyId, importJobId } });
  if (!target) throw new NotFoundError("Import row not found.");

  const currentNormalized = (target.normalizedDataJson as Record<string, string> | null) ?? {};
  const patchedNormalized = { ...currentNormalized, ...input.normalizedDataJson };
  await prisma.importRow.update({ where: { id: rowId, companyId: actor.companyId }, data: { normalizedDataJson: patchedNormalized, status: ImportRowStatus.PENDING } });
  await createAuditLog(actor.companyId, { entityType: "ImportRow", entityId: rowId, action: "IMPORT_ROW_EDITED", payload: { fields: Object.keys(input.normalizedDataJson) } });

  return revalidateAllRows(actor, job);
}

export type RowActionInput = { rowIds: string[]; action: "CREATE_NEW" | "SKIP" | "REJECT" };

/** Explicit per-row review step — nothing is imported without this (spec section 20: "Do not auto-import without review"). */
export async function actOnImportRows(actor: CurrentActor, importJobId: string, input: RowActionInput) {
  requireCapability(actor, "imports:manage");
  await getJobRecord(actor.companyId, importJobId);

  const nextStatus = input.action === "CREATE_NEW" ? ImportRowStatus.APPROVED : ImportRowStatus.REJECTED;
  await prisma.importRow.updateMany({
    where: { companyId: actor.companyId, importJobId, id: { in: input.rowIds }, status: { in: [ImportRowStatus.VALID, ImportRowStatus.WARNING] } },
    data: { status: nextStatus },
  });
  await createAuditLog(actor.companyId, { entityType: "ImportJob", entityId: importJobId, action: "IMPORT_ROWS_REVIEWED", payload: { count: input.rowIds.length, action: input.action } });

  return getImportJobForCompany(actor, importJobId);
}

async function executeCompanyLibraryRow(actor: CurrentActor, normalized: Record<string, string>, disciplineId: string | null) {
  return createLibraryItem(
    actor.companyId,
    {
      companyItemCode: normalized.itemCode,
      name: normalized.description,
      description: normalized.specification ?? "",
      disciplineId,
      unit: normalized.unit,
      defaultCost: normalized.cost ? Number(normalized.cost) : 0,
      defaultMargin: normalized.margin ? Number(normalized.margin) : 0,
      defaultSellingRate: normalized.sellingRate ? Number(normalized.sellingRate) : 0,
      sourceType: "IMPORTED",
    },
    actor.userId,
  );
}

async function executeRateCatalogueRow(actor: CurrentActor, normalized: Record<string, string>, resolvedIndustryEngineId: string | null) {
  let industryEngineId = resolvedIndustryEngineId;
  if (!industryEngineId) {
    const industry = await prisma.companyIndustryEngine.findFirst({
      where: {
        companyId: actor.companyId,
        enabled: true,
        industryEngine: { key: { not: RETIRED_COMBINED_INDUSTRY_KEY } },
      },
      include: { industryEngine: true },
    });
    if (!industry) throw new AppError("NO_INDUSTRY_AVAILABLE", "No enabled industry is available to attach this catalogue rate to.", 409);
    industryEngineId = industry.industryEngineId;
  }

  const cost = normalized.cost ? Number(normalized.cost) : 0;
  return prisma.rateCatalogueItem.create({
    data: {
      companyId: actor.companyId,
      industryEngineId,
      itemCode: normalized.itemCode,
      category: normalized.category || "Imported",
      description: normalized.description,
      specification: normalized.specification,
      unit: normalized.unit,
      manufacturer: normalized.manufacturer,
      brand: normalized.brand,
      model: normalized.model,
      baseCost: cost,
      sellingRate: normalized.sellingRate ? Number(normalized.sellingRate) : cost,
      defaultMargin: normalized.margin ? Number(normalized.margin) : 0,
      effectiveDate: new Date(),
    },
  });
}

async function resolveDraftBoqSection(companyId: string, projectId: string) {
  const boqs = await listProjectBOQs(companyId, projectId);
  const draftBoq = boqs.find((boq) => boq.status !== "locked" && boq.status !== "approved") ?? boqs[0];
  if (!draftBoq) throw new AppError("NO_DRAFT_BOQ", "This project has no BOQ to import into.", 409);
  const full = await getBOQ(companyId, draftBoq.id);
  const section = full.sections[0];
  if (!section) throw new AppError("NO_SECTIONS", "The target BOQ has no sections to import into.", 409);
  return section;
}

async function executeDraftBoqRow(actor: CurrentActor, projectId: string, normalized: Record<string, string>, itemNumber: number) {
  const section = await resolveDraftBoqSection(actor.companyId, projectId);
  const { item } = await createBOQItem(actor.companyId, section.id, {
    itemNumber,
    itemCode: normalized.itemCode,
    category: normalized.category || "Imported",
    description: normalized.description,
    specification: normalized.specification ?? "",
    quantity: normalized.quantity,
    unit: normalized.unit,
    unitCost: normalized.cost ? Number(normalized.cost) : 0,
    marginPercentage: normalized.margin ? Number(normalized.margin) : 0,
    sortOrder: itemNumber,
  }, undefined, {
    integrityActor: { userId: actor.userId, name: actor.fullName },
    initialRateSource: RateProvenanceSource.IMPORT,
  });
  return item;
}

/** Only APPROVED rows are ever written to their destination — everything else stays inert. */
export async function executeImportJob(actor: CurrentActor, importJobId: string) {
  requireCapability(actor, "imports:manage");
  const job = await getJobRecord(actor.companyId, importJobId);
  if (job.destinationType === "DRAFT_BOQ" && !job.projectId) {
    throw new AppError("PROJECT_REQUIRED", "This import job has no target project for its draft BOQ.", 409);
  }

  const approvedRows = await prisma.importRow.findMany({
    where: { companyId: actor.companyId, importJobId, status: ImportRowStatus.APPROVED },
    orderBy: { rowNumber: "asc" },
  });

  // Resolved once per job (not per row) from the uploaded file's name — e.g. an upload named
  // "hvac-company-library-import.csv" lands its items under the Mechanical discipline
  // automatically instead of everyone having to map a "discipline" column by hand.
  const resolvedDisciplineId = job.destinationType === "COMPANY_LIBRARY" ? await resolveDisciplineIdFromFilename(job.uploadedFileName) : null;
  const resolvedIndustryEngineId = job.destinationType === "RATE_CATALOGUE" ? await resolveIndustryEngineIdFromFilename(actor.companyId, job.uploadedFileName) : null;

  let imported = 0;
  for (const row of approvedRows) {
    const normalized = (row.normalizedDataJson as Record<string, string> | null) ?? {};
    try {
      let destinationEntityId: string | null = null;
      if (job.destinationType === "COMPANY_LIBRARY") {
        const created = await executeCompanyLibraryRow(actor, normalized, resolvedDisciplineId);
        destinationEntityId = created.id;
      } else if (job.destinationType === "RATE_CATALOGUE") {
        const created = await executeRateCatalogueRow(actor, normalized, resolvedIndustryEngineId);
        destinationEntityId = created.id;
      } else if (job.destinationType === "DRAFT_BOQ") {
        const created = await executeDraftBoqRow(actor, job.projectId!, normalized, row.rowNumber);
        destinationEntityId = created.id;
      }
      await prisma.importRow.update({ where: { id: row.id, companyId: actor.companyId }, data: { status: ImportRowStatus.IMPORTED, destinationEntityId } });
      imported += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed for this row.";
      await prisma.importRow.update({ where: { id: row.id, companyId: actor.companyId }, data: { status: ImportRowStatus.ERROR, validationErrorsJson: [message.slice(0, 300)] } });
    }
  }

  await prisma.importJob.update({
    where: { id: job.id, companyId: actor.companyId },
    data: { status: ImportJobStatus.COMPLETED, importedRows: { increment: imported }, completedAt: new Date() },
  });
  await createAuditLog(actor.companyId, { entityType: "ImportJob", entityId: job.id, action: "IMPORT_JOB_EXECUTED", payload: { imported } });

  return getImportJobForCompany(actor, importJobId);
}

/**
 * Deletes the import job and its staged rows (ImportRow cascades via the FK in schema.prisma).
 * This only removes the job's own audit/staging trail — it never touches CompanyLibraryItem or
 * RateCatalogueItem rows that were already created by a prior execute, since those records have
 * no cascading relation back to ImportJob (only a plain destinationEntityId reference). Safe to
 * call on a job in any status: a bad upload before you've mapped/validated it, or a completed job
 * you just want to clear off the list.
 */
export async function deleteImportJob(actor: CurrentActor, importJobId: string) {
  requireCapability(actor, "imports:manage");
  const job = await getJobRecord(actor.companyId, importJobId);

  await prisma.importJob.delete({ where: { id: job.id, companyId: actor.companyId } });
  await createAuditLog(actor.companyId, { entityType: "ImportJob", entityId: job.id, action: "IMPORT_JOB_DELETED", payload: { uploadedFileName: job.uploadedFileName, status: job.status } });

  return { id: job.id };
}

export async function listImportMappingTemplates(actor: CurrentActor) {
  const rows = await prisma.importMappingTemplate.findMany({ where: { companyId: actor.companyId }, orderBy: { name: "asc" } });
  return rows.map((row) => ({ id: row.id, name: row.name, sourceType: row.sourceType, destinationType: row.destinationType, mappingJson: row.mappingJson }));
}
