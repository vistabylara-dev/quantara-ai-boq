import { MasterCatalogueImportStatus, MasterItemStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { parseCsv } from "@/lib/imports/csv-parser";
import { computeChecksum } from "@/lib/files/file-security";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import { listMasterItems, toMasterItemDTO } from "@/lib/repositories/master-item-repository";

/**
 * ADMIN-CONTROL-1 section 5 — platform-owner-only bulk import into the
 * tenant-less MasterItem/MasterDiscipline catalogue. Deliberately separate
 * from import-service.ts (company-scoped ImportJob/ImportRow, a different
 * tenancy model — see the migration's model doc comment). Required CSV
 * columns: itemCode, category, name, shortDescription, fullDescription,
 * defaultUnit, isPremium (true/false, defaults to true if blank).
 */

const MASTER_CATALOGUE_COLUMNS = ["itemCode", "category", "name", "shortDescription", "fullDescription", "defaultUnit", "isPremium"] as const;
const MAX_ROWS = 5_000;
const MAX_STORED_ROW_DETAIL = 500;

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Master catalogue administration is restricted to the platform owner.");
  }
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "item";
}

type ParsedRow = {
  rowNumber: number;
  itemCode: string;
  category: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  defaultUnit: string;
  isPremium: boolean;
};

type RowOutcome = "insert" | "update" | "unchanged" | "rejected";
type RowResult = { rowNumber: number; itemCode: string; outcome: RowOutcome; reason?: string };

function parseRows(csvText: string): { headers: string[]; rows: ParsedRow[]; malformed: RowResult[] } {
  const parsed = parseCsv(csvText);
  if (parsed.length === 0) throw new AppError("EMPTY_FILE", "The uploaded file has no rows.", 400);
  const [headers, ...dataRows] = parsed;
  if (dataRows.length > MAX_ROWS) throw new AppError("TOO_MANY_ROWS", `This import exceeds the ${MAX_ROWS}-row limit.`, 400);

  const columnIndex = new Map(headers.map((header, index) => [header.trim(), index]));
  const rows: ParsedRow[] = [];
  const malformed: RowResult[] = [];

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const get = (key: string) => (columnIndex.has(key) ? (cells[columnIndex.get(key)!] ?? "").trim() : "");
    const itemCode = get("itemCode");
    const name = get("name");
    const category = get("category");
    const defaultUnit = get("defaultUnit");

    if (!itemCode || !name || !category || !defaultUnit) {
      malformed.push({ rowNumber, itemCode: itemCode || "(missing)", outcome: "rejected", reason: "Missing one of itemCode, category, name, defaultUnit." });
      return;
    }

    rows.push({
      rowNumber,
      itemCode,
      category,
      name,
      shortDescription: get("shortDescription"),
      fullDescription: get("fullDescription"),
      defaultUnit,
      isPremium: get("isPremium").toLowerCase() !== "false",
    });
  });

  return { headers, rows, malformed };
}

async function resolveCategoryId(disciplineId: string, categoryName: string, write: boolean): Promise<string | null> {
  const key = slugify(categoryName);
  const existing = await prisma.masterCategory.findFirst({ where: { disciplineId, key } });
  if (existing) return existing.id;
  if (!write) return null; // dry run — category would be created, but we don't create it yet
  const created = await prisma.masterCategory.create({
    data: { disciplineId, key, name: categoryName, path: key, depth: 0 },
  });
  return created.id;
}

async function evaluate(disciplineId: string, rows: ParsedRow[], write: boolean, sourceBatchId?: string): Promise<{ results: RowResult[]; inserted: number; updated: number; unchanged: number }> {
  const results: RowResult[] = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const categoryCache = new Map<string, string | null>();

  for (const row of rows) {
    let categoryId = categoryCache.get(row.category);
    if (categoryId === undefined) {
      categoryId = await resolveCategoryId(disciplineId, row.category, write);
      categoryCache.set(row.category, categoryId);
    }

    const existing = await prisma.masterItem.findUnique({ where: { disciplineId_itemCode: { disciplineId, itemCode: row.itemCode } } });

    if (!existing) {
      inserted += 1;
      results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "insert" });
      if (write) {
        if (!categoryId) categoryId = await resolveCategoryId(disciplineId, row.category, true);
        await prisma.masterItem.create({
          data: {
            disciplineId,
            categoryId: categoryId!,
            itemCode: row.itemCode,
            name: row.name,
            shortDescription: row.shortDescription,
            fullDescription: row.fullDescription,
            defaultUnit: row.defaultUnit,
            isPremium: row.isPremium,
            sourceBatchId,
          },
        });
      }
      continue;
    }

    const changed = existing.name !== row.name || existing.shortDescription !== row.shortDescription || existing.fullDescription !== row.fullDescription || existing.defaultUnit !== row.defaultUnit || existing.isPremium !== row.isPremium;

    if (!changed) {
      unchanged += 1;
      results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "unchanged" });
      continue;
    }

    updated += 1;
    results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "update" });
    if (write) {
      await prisma.masterItem.update({
        where: { id: existing.id },
        data: { name: row.name, shortDescription: row.shortDescription, fullDescription: row.fullDescription, defaultUnit: row.defaultUnit, isPremium: row.isPremium, version: { increment: 1 } },
      });
    }
  }

  return { results, inserted, updated, unchanged };
}

function toBatchDTO(batch: {
  id: string; disciplineId: string; uploadedFileName: string; checksum: string; status: MasterCatalogueImportStatus;
  totalRows: number; insertedCount: number; updatedCount: number; unchangedCount: number; rejectedCount: number;
  validationReportJson: Prisma.JsonValue; executedAt: Date | null; rolledBackAt: Date | null; createdAt: Date;
}) {
  return {
    id: batch.id,
    disciplineId: batch.disciplineId,
    uploadedFileName: batch.uploadedFileName,
    checksum: batch.checksum,
    status: batch.status,
    totalRows: batch.totalRows,
    insertedCount: batch.insertedCount,
    updatedCount: batch.updatedCount,
    unchangedCount: batch.unchangedCount,
    rejectedCount: batch.rejectedCount,
    rows: (batch.validationReportJson as { rows?: RowResult[] } | null)?.rows ?? [],
    executedAt: batch.executedAt?.toISOString() ?? null,
    rolledBackAt: batch.rolledBackAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
  };
}

export type MasterCatalogueDryRunInput = { disciplineId: string; uploadedFileName: string; csvText: string };

export async function dryRunMasterCatalogueImport(owner: PlatformActor, input: MasterCatalogueDryRunInput) {
  requireOwner(owner);
  const discipline = await prisma.masterDiscipline.findUnique({ where: { id: input.disciplineId } });
  if (!discipline) throw new NotFoundError("Master discipline not found.");

  const { rows, malformed } = parseRows(input.csvText);
  const { results, inserted, updated, unchanged } = await evaluate(input.disciplineId, rows, false);
  const allResults = [...results, ...malformed].sort((a, b) => a.rowNumber - b.rowNumber);
  const checksum = computeChecksum(Buffer.from(input.csvText, "utf-8"));

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_CATALOGUE_DRY_RUN",
    targetType: "MasterDiscipline",
    targetId: input.disciplineId,
    metadata: { uploadedFileName: input.uploadedFileName, checksum, totalRows: rows.length + malformed.length, inserted, updated, unchanged, rejected: malformed.length },
  });

  return {
    disciplineId: input.disciplineId,
    uploadedFileName: input.uploadedFileName,
    checksum,
    totalRows: rows.length + malformed.length,
    insertedCount: inserted,
    updatedCount: updated,
    unchangedCount: unchanged,
    rejectedCount: malformed.length,
    rows: allResults.slice(0, MAX_STORED_ROW_DETAIL),
  };
}

export async function executeMasterCatalogueImport(owner: PlatformActor, input: MasterCatalogueDryRunInput) {
  requireOwner(owner);
  const discipline = await prisma.masterDiscipline.findUnique({ where: { id: input.disciplineId } });
  if (!discipline) throw new NotFoundError("Master discipline not found.");

  const { rows, malformed } = parseRows(input.csvText);
  const checksum = computeChecksum(Buffer.from(input.csvText, "utf-8"));

  const batch = await prisma.masterCatalogueImportBatch.create({
    data: {
      actorUserId: owner.userId,
      disciplineId: input.disciplineId,
      uploadedFileName: input.uploadedFileName,
      checksum,
      status: MasterCatalogueImportStatus.EXECUTED,
      totalRows: rows.length + malformed.length,
    },
  });

  const { results, inserted, updated, unchanged } = await evaluate(input.disciplineId, rows, true, batch.id);
  const allResults = [...results, ...malformed].sort((a, b) => a.rowNumber - b.rowNumber);

  const updatedBatch = await prisma.masterCatalogueImportBatch.update({
    where: { id: batch.id },
    data: {
      insertedCount: inserted,
      updatedCount: updated,
      unchangedCount: unchanged,
      rejectedCount: malformed.length,
      validationReportJson: { rows: allResults.slice(0, MAX_STORED_ROW_DETAIL) },
      executedAt: new Date(),
    },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_CATALOGUE_IMPORT_EXECUTED",
    targetType: "MasterCatalogueImportBatch",
    targetId: batch.id,
    metadata: { disciplineId: input.disciplineId, uploadedFileName: input.uploadedFileName, checksum, inserted, updated, unchanged, rejected: malformed.length },
  });

  return toBatchDTO(updatedBatch);
}

export async function listMasterCatalogueImportBatches(owner: PlatformActor) {
  requireOwner(owner);
  const batches = await prisma.masterCatalogueImportBatch.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return batches.map(toBatchDTO);
}

export async function getMasterCatalogueImportBatch(owner: PlatformActor, batchId: string) {
  requireOwner(owner);
  const batch = await prisma.masterCatalogueImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("Import batch not found.");
  return toBatchDTO(batch);
}

/**
 * Rollback only ever removes items this exact batch *inserted* — updates
 * are not reverted (no prior-version snapshot is stored), matching the
 * spec's own "where supported" qualifier. A batch that contains any updated
 * rows is still rollback-able for its inserted rows; the response reports
 * exactly what was (and wasn't) undone.
 */
export async function rollbackMasterCatalogueImportBatch(owner: PlatformActor, batchId: string) {
  requireOwner(owner);
  const batch = await prisma.masterCatalogueImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("Import batch not found.");
  if (batch.status === MasterCatalogueImportStatus.ROLLED_BACK) {
    throw new AppError("ALREADY_ROLLED_BACK", "This batch has already been rolled back.", 409);
  }
  if (batch.status !== MasterCatalogueImportStatus.EXECUTED) {
    throw new AppError("NOT_EXECUTED", "Only an executed batch can be rolled back.", 409);
  }

  const deleted = await prisma.masterItem.deleteMany({ where: { sourceBatchId: batch.id } });
  const rolledBack = await prisma.masterCatalogueImportBatch.update({
    where: { id: batch.id },
    data: { status: MasterCatalogueImportStatus.ROLLED_BACK, rolledBackAt: new Date() },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_CATALOGUE_IMPORT_ROLLED_BACK",
    targetType: "MasterCatalogueImportBatch",
    targetId: batch.id,
    metadata: { deletedInsertedItems: deleted.count, note: "Updated rows from this batch were not reverted — no prior-version snapshot is stored." },
  });

  return { ...toBatchDTO(rolledBack), deletedInsertedItems: deleted.count };
}

export async function searchMasterCatalogueAdmin(owner: PlatformActor, filters: { disciplineId?: string; categoryId?: string; hierarchyNodeId?: string; manufacturerId?: string; regionScope?: "UAE" | "GCC" | "INTERNATIONAL" | "COUNTRY_SPECIFIC"; search?: string; page?: number; pageSize?: number }) {
  requireOwner(owner);
  return listMasterItems(filters);
}

export async function setMasterItemStatus(owner: PlatformActor, itemId: string, status: "ACTIVE" | "DEPRECATED" | "ARCHIVED") {
  requireOwner(owner);
  const existing = await prisma.masterItem.findUnique({ where: { id: itemId } });
  if (!existing) throw new NotFoundError("Master item not found.");

  const updated = await prisma.masterItem.update({ where: { id: itemId }, data: { status: status as MasterItemStatus } });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: status === "ACTIVE" ? "MASTER_ITEM_ACTIVATED" : "MASTER_ITEM_DEACTIVATED",
    targetType: "MasterItem",
    targetId: itemId,
    metadata: { previousStatus: existing.status, newStatus: status, itemCode: existing.itemCode },
  });

  return toMasterItemDTO(updated);
}
