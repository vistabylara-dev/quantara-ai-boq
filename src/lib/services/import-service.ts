import { ImportJobStatus, ImportRowStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { parseCsv } from "@/lib/imports/csv-parser";
import { parseXlsx } from "@/lib/imports/xlsx-parser";
import { createLibraryItem } from "@/lib/repositories/company-library-repository";
import { createBOQItem, getBOQ, listProjectBOQs } from "@/lib/repositories/boq-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";

const MAX_ROWS = 2_000;

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
  fileContentBase64: string;
  sourceType: "CSV" | "XLSX";
  destinationType: "COMPANY_LIBRARY" | "RATE_CATALOGUE" | "DRAFT_BOQ" | "STAGING_REVIEW";
  mappingTemplateId?: string;
};

/** Upload -> parse only. Nothing is imported until mapping, validation, row approval, and an explicit execute call. */
export async function createImportJob(actor: CurrentActor, input: CreateImportJobInput) {
  requireCapability(actor, "imports:manage");

  if (input.projectId) await getProjectRecord(actor.companyId, input.projectId);

  const buffer = Buffer.from(input.fileContentBase64, "base64");
  const rows = input.sourceType === "CSV" ? parseCsv(buffer.toString("utf-8")) : await parseXlsx(buffer);
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

/** Validates every mapped row, flags duplicates as warnings (never auto-merged), and updates the job's row-status counts. */
export async function validateImportJob(actor: CurrentActor, importJobId: string) {
  requireCapability(actor, "imports:manage");
  const job = await getJobRecord(actor.companyId, importJobId);
  const requiredFields = REQUIRED_FIELDS_BY_DESTINATION[job.destinationType] ?? [];

  const rows = await prisma.importRow.findMany({ where: { companyId: actor.companyId, importJobId }, orderBy: { rowNumber: "asc" } });
  const existingLibraryCodes = new Set((await prisma.companyLibraryItem.findMany({ where: { companyId: actor.companyId }, select: { companyItemCode: true } })).map((r) => r.companyItemCode.toLowerCase()));
  const existingCatalogueCodes = new Set((await prisma.rateCatalogueItem.findMany({ where: { companyId: actor.companyId }, select: { itemCode: true } })).map((r) => r.itemCode.toLowerCase()));
  const seenInBatch = new Set<string>();

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const normalized = (row.normalizedDataJson as Record<string, string> | null) ?? {};
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const field of requiredFields) {
        if (!normalized[field]?.trim()) errors.push(`Column mapped to "${field}" is required and missing on this row.`);
      }
      if (normalized.quantity !== undefined && normalized.quantity.trim() && Number.isNaN(Number(normalized.quantity))) {
        errors.push("Quantity is not a valid number.");
      }
      if (normalized.cost !== undefined && normalized.cost.trim() && Number.isNaN(Number(normalized.cost))) {
        errors.push("Cost is not a valid number.");
      }

      const code = normalized.itemCode?.trim().toLowerCase();
      if (code) {
        if (job.destinationType === "COMPANY_LIBRARY" && existingLibraryCodes.has(code)) warnings.push("An existing company library item already uses this item code.");
        if (job.destinationType === "RATE_CATALOGUE" && existingCatalogueCodes.has(code)) warnings.push("An existing rate catalogue item already uses this item code.");
        if (seenInBatch.has(code)) warnings.push("Duplicate item code within this import file.");
        seenInBatch.add(code);
      }

      const status = errors.length > 0 ? ImportRowStatus.ERROR : warnings.length > 0 ? ImportRowStatus.WARNING : ImportRowStatus.VALID;
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

  return getImportJobForCompany(actor, importJobId);
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

async function executeCompanyLibraryRow(actor: CurrentActor, normalized: Record<string, string>) {
  return createLibraryItem(
    actor.companyId,
    {
      companyItemCode: normalized.itemCode,
      name: normalized.description,
      description: normalized.specification ?? "",
      unit: normalized.unit,
      defaultCost: normalized.cost ? Number(normalized.cost) : 0,
      defaultMargin: normalized.margin ? Number(normalized.margin) : 0,
      defaultSellingRate: normalized.sellingRate ? Number(normalized.sellingRate) : 0,
      sourceType: "IMPORTED",
    },
    actor.userId,
  );
}

async function executeRateCatalogueRow(actor: CurrentActor, normalized: Record<string, string>) {
  const industry = await prisma.companyIndustryEngine.findFirst({ where: { companyId: actor.companyId, enabled: true }, include: { industryEngine: true } });
  if (!industry) throw new AppError("NO_INDUSTRY_AVAILABLE", "No enabled industry is available to attach this catalogue rate to.", 409);

  const cost = normalized.cost ? Number(normalized.cost) : 0;
  return prisma.rateCatalogueItem.create({
    data: {
      companyId: actor.companyId,
      industryEngineId: industry.industryEngineId,
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

  let imported = 0;
  for (const row of approvedRows) {
    const normalized = (row.normalizedDataJson as Record<string, string> | null) ?? {};
    try {
      let destinationEntityId: string | null = null;
      if (job.destinationType === "COMPANY_LIBRARY") {
        const created = await executeCompanyLibraryRow(actor, normalized);
        destinationEntityId = created.id;
      } else if (job.destinationType === "RATE_CATALOGUE") {
        const created = await executeRateCatalogueRow(actor, normalized);
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

export async function listImportMappingTemplates(actor: CurrentActor) {
  const rows = await prisma.importMappingTemplate.findMany({ where: { companyId: actor.companyId }, orderBy: { name: "asc" } });
  return rows.map((row) => ({ id: row.id, name: row.name, sourceType: row.sourceType, destinationType: row.destinationType, mappingJson: row.mappingJson }));
}
