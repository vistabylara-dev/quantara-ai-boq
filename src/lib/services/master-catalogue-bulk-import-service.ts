import { MasterCatalogueImportStatus, MasterClassificationSystem, MasterItemVersionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { parseCsv } from "@/lib/imports/csv-parser";
import { computeChecksum } from "@/lib/files/file-security";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import { createHierarchyNode, getHierarchyNodeByCode } from "@/lib/repositories/master-hierarchy-repository";

/**
 * CATALOGUE-CLOSE — discipline-agnostic sibling of hvac-master-import-service.ts
 * (left untouched — already shipped and tested). The staged discipline CSVs
 * outside HVAC use the same 14-column shape but at least four different
 * composite-specification encodings (see the CATALOGUE-CLOSE audit), so the
 * one part that must stay per-discipline is `parseSpecification`. Everything
 * else — row validation, category/hierarchy resolution, idempotent
 * insert/update, version creation, classification upsert, batch tracking —
 * is identical across disciplines and lives here once.
 */

const REQUIRED_COLUMNS = ["itemCode", "category", "description", "unit"] as const;
const MAX_ROWS = 10_000;
const MAX_STORED_ROW_DETAIL = 1000;

export type ParsedSpecification = {
  /** Longer descriptive sentence — used as fullDescription. Falls back to the row's own `description` column if empty. */
  fullDescription: string;
  specificationTemplate: string;
  subcategory: string | null;
  classifications: { system: MasterClassificationSystem; code: string; label?: string; isPrimary?: boolean }[];
  warnings: string[];
};

export type BulkImportProfile = {
  /** Must already exist in MasterDiscipline (one of the 9 seeded disciplines) — never created here. */
  disciplineKey: string;
  /** Hierarchy node this discipline's CATEGORY nodes attach under, e.g. "construction.plumbing". Created idempotently under hierarchyIndustryCode if missing. */
  hierarchyDisciplineCode: string;
  hierarchyDisciplineName: string;
  hierarchyIndustryCode: string;
  hierarchyIndustryName: string;
  parseSpecification: (raw: string) => ParsedSpecification;
};

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Master catalogue bulk import is restricted to the platform owner.");
  }
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "item";
}

type ParsedRow = { rowNumber: number; itemCode: string; category: string; description: string; unit: string; specification: string };
type RowOutcome = "insert" | "update" | "unchanged" | "rejected";
type RowResult = { rowNumber: number; itemCode: string; outcome: RowOutcome; reason?: string; warnings?: string[] };

function parseRows(csvText: string): { rows: ParsedRow[]; malformed: RowResult[] } {
  const parsed = parseCsv(csvText);
  if (parsed.length === 0) throw new AppError("EMPTY_FILE", "The uploaded file has no rows.", 400);
  const [headers, ...dataRows] = parsed;
  if (dataRows.length > MAX_ROWS) throw new AppError("TOO_MANY_ROWS", `This import exceeds the ${MAX_ROWS}-row limit.`, 400);

  const columnIndex = new Map(headers.map((header, index) => [header.trim(), index]));
  for (const column of REQUIRED_COLUMNS) {
    if (!columnIndex.has(column)) throw new AppError("MISSING_COLUMN", `Required column "${column}" is missing from this file.`, 400);
  }

  const rows: ParsedRow[] = [];
  const malformed: RowResult[] = [];
  const seenInFile = new Set<string>();

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const get = (key: string) => (columnIndex.has(key) ? (cells[columnIndex.get(key)!] ?? "").trim() : "");
    const itemCode = get("itemCode");
    const category = get("category");
    const description = get("description");
    const unit = get("unit");

    if (!itemCode || !category || !description || !unit) {
      malformed.push({ rowNumber, itemCode: itemCode || "(missing)", outcome: "rejected", reason: "Missing one of itemCode, category, description, unit." });
      return;
    }
    if (seenInFile.has(itemCode)) {
      malformed.push({ rowNumber, itemCode, outcome: "rejected", reason: "Duplicate itemCode within this file." });
      return;
    }
    seenInFile.add(itemCode);

    rows.push({ rowNumber, itemCode, category, description, unit, specification: get("specification") });
  });

  return { rows, malformed };
}

type HierarchyContext = { disciplineId: string; disciplineNodeId: string };

async function requireHierarchyChain(profile: BulkImportProfile): Promise<HierarchyContext> {
  const discipline = await prisma.masterDiscipline.findUnique({ where: { key: profile.disciplineKey } });
  if (!discipline) throw new AppError("DISCIPLINE_NOT_READY", `MasterDiscipline "${profile.disciplineKey}" does not exist.`, 409);

  const existingDisciplineNode = await getHierarchyNodeByCode(profile.hierarchyDisciplineCode);
  let disciplineNodeId = existingDisciplineNode?.id;
  if (!disciplineNodeId) {
    const existingIndustryNode = await getHierarchyNodeByCode(profile.hierarchyIndustryCode);
    const industryNodeId = existingIndustryNode?.id ?? (await createHierarchyNode({ code: profile.hierarchyIndustryCode, name: profile.hierarchyIndustryName, nodeType: "INDUSTRY", sortOrder: 0 })).id;
    disciplineNodeId = (await createHierarchyNode({ code: profile.hierarchyDisciplineCode, name: profile.hierarchyDisciplineName, nodeType: "DISCIPLINE", parentId: industryNodeId, sortOrder: 0 })).id;
  }

  return { disciplineId: discipline.id, disciplineNodeId };
}

async function resolveCategoryAndHierarchy(ctx: HierarchyContext, profile: BulkImportProfile, categoryName: string, subcategory: string | null, write: boolean): Promise<{ categoryId: string; hierarchyNodeId: string } | null> {
  const categoryKey = slugify(categoryName);
  let category = await prisma.masterCategory.findFirst({ where: { disciplineId: ctx.disciplineId, key: categoryKey } });
  if (!category) {
    if (!write) return null;
    category = await prisma.masterCategory.create({ data: { disciplineId: ctx.disciplineId, key: categoryKey, name: categoryName, path: categoryKey, depth: 0 } });
  }

  const categoryNodeCode = `${profile.hierarchyDisciplineCode}.${categoryKey}`;
  const existingCategoryNode = await getHierarchyNodeByCode(categoryNodeCode);
  let categoryNodeId = existingCategoryNode?.id;
  if (!categoryNodeId) {
    if (!write) return { categoryId: category.id, hierarchyNodeId: "" };
    const created = await createHierarchyNode({ code: categoryNodeCode, name: categoryName, nodeType: "CATEGORY", parentId: ctx.disciplineNodeId, sortOrder: 0 });
    categoryNodeId = created.id;
  }

  if (!subcategory) return { categoryId: category.id, hierarchyNodeId: categoryNodeId };

  const subcategoryKey = slugify(subcategory);
  const subcategoryNodeCode = `${categoryNodeCode}.${subcategoryKey}`;
  const existingSubcategoryNode = await getHierarchyNodeByCode(subcategoryNodeCode);
  let subcategoryNodeId = existingSubcategoryNode?.id;
  if (!subcategoryNodeId) {
    if (!write) return { categoryId: category.id, hierarchyNodeId: "" };
    const created = await createHierarchyNode({ code: subcategoryNodeCode, name: subcategory, nodeType: "SUBCATEGORY", parentId: categoryNodeId, sortOrder: 0 });
    subcategoryNodeId = created.id;
  }

  return { categoryId: category.id, hierarchyNodeId: subcategoryNodeId };
}

type EvaluateResult = {
  results: RowResult[];
  inserted: number;
  updated: number;
  unchanged: number;
  categoriesCreated: number;
  hierarchyNodesCreated: number;
  versionsCreated: number;
  classificationsCreated: number;
  warningRowCount: number;
};

async function evaluate(owner: PlatformActor, ctx: HierarchyContext, profile: BulkImportProfile, rows: ParsedRow[], write: boolean, sourceBatchId?: string): Promise<EvaluateResult> {
  const results: RowResult[] = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let categoriesCreated = 0;
  let hierarchyNodesCreated = 0;
  let versionsCreated = 0;
  let classificationsCreated = 0;
  let warningRowCount = 0;

  const resolutionCache = new Map<string, { categoryId: string; hierarchyNodeId: string } | null>();

  // Bulk pre-fetch existing items by itemCode to avoid one findUnique per row (this dataset can run into the tens of thousands of rows).
  const existingByCode = new Map<string, Awaited<ReturnType<typeof prisma.masterItem.findMany>>[number]>();
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => r.itemCode);
    const found = await prisma.masterItem.findMany({ where: { disciplineId: ctx.disciplineId, itemCode: { in: chunk } } });
    for (const item of found) existingByCode.set(item.itemCode, item);
  }

  for (const row of rows) {
    const parsedSpec = profile.parseSpecification(row.specification);
    const warnings = [...parsedSpec.warnings];
    if (warnings.length > 0) warningRowCount += 1;

    const cacheKey = `${row.category}::${parsedSpec.subcategory ?? ""}`;
    let resolution = resolutionCache.get(cacheKey);
    if (resolution === undefined) {
      const categoryCountBefore = write ? await prisma.masterCategory.count({ where: { disciplineId: ctx.disciplineId } }) : 0;
      const nodeCountBefore = write ? await prisma.masterHierarchyNode.count() : 0;
      resolution = await resolveCategoryAndHierarchy(ctx, profile, row.category, parsedSpec.subcategory, write);
      resolutionCache.set(cacheKey, resolution);
      if (write && resolution) {
        const categoryCountAfter = await prisma.masterCategory.count({ where: { disciplineId: ctx.disciplineId } });
        const nodeCountAfter = await prisma.masterHierarchyNode.count();
        categoriesCreated += categoryCountAfter - categoryCountBefore;
        hierarchyNodesCreated += nodeCountAfter - nodeCountBefore;
      }
    }

    const fullDescription = parsedSpec.fullDescription || row.description;
    const specificationTemplate = parsedSpec.specificationTemplate;

    const existing = existingByCode.get(row.itemCode);

    if (!existing) {
      inserted += 1;
      results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "insert", warnings });
      if (write) {
        const created = await prisma.masterItem.create({
          data: {
            disciplineId: ctx.disciplineId,
            categoryId: resolution!.categoryId,
            hierarchyNodeId: resolution!.hierarchyNodeId || null,
            itemCode: row.itemCode,
            name: row.description,
            shortDescription: row.description,
            fullDescription,
            defaultUnit: row.unit,
            isPremium: true,
            sourceBatchId,
          },
        });

        await prisma.masterItemVersion.create({
          data: {
            masterItemId: created.id,
            versionNumber: 1,
            status: MasterItemVersionStatus.PUBLISHED,
            effectiveDate: new Date(),
            changeSummary: `Imported from validated ${profile.disciplineKey} master dataset${sourceBatchId ? ` (batch ${sourceBatchId})` : ""}.`,
            name: row.description,
            shortDescription: row.description,
            fullDescription,
            specificationTemplate,
            primaryUnit: row.unit,
            createdByUserId: owner.userId,
          },
        });
        versionsCreated += 1;

        for (const classification of parsedSpec.classifications) {
          await prisma.masterItemClassification.create({
            data: { masterItemId: created.id, system: classification.system, code: classification.code, label: classification.label ?? "", isPrimary: classification.isPrimary ?? false, source: `${profile.disciplineKey}-master-import` },
          });
          classificationsCreated += 1;
        }
      }
      continue;
    }

    const latestVersion = await prisma.masterItemVersion.findFirst({ where: { masterItemId: existing.id }, orderBy: { versionNumber: "desc" } });
    const categoryChanged = resolution ? existing.categoryId !== resolution.categoryId : false;
    const nameChanged = existing.name !== row.description || existing.shortDescription !== row.description || existing.fullDescription !== fullDescription || existing.defaultUnit !== row.unit;
    const versionContentChanged = !latestVersion || latestVersion.name !== row.description || latestVersion.specificationTemplate !== specificationTemplate || latestVersion.primaryUnit !== row.unit;

    const existingClassifications = await prisma.masterItemClassification.findMany({ where: { masterItemId: existing.id } });
    const missingClassifications = parsedSpec.classifications.filter((c) => !existingClassifications.some((e) => e.system === c.system && e.code === c.code));

    const changed = categoryChanged || nameChanged || versionContentChanged || missingClassifications.length > 0;

    if (!changed) {
      unchanged += 1;
      results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "unchanged", warnings });
      continue;
    }

    updated += 1;
    results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "update", warnings });
    if (write) {
      if (categoryChanged || nameChanged) {
        await prisma.masterItem.update({
          where: { id: existing.id },
          data: {
            categoryId: resolution!.categoryId,
            hierarchyNodeId: resolution!.hierarchyNodeId || existing.hierarchyNodeId,
            name: row.description,
            shortDescription: row.description,
            fullDescription,
            defaultUnit: row.unit,
            version: { increment: 1 },
          },
        });
      }
      if (versionContentChanged) {
        await prisma.masterItemVersion.create({
          data: {
            masterItemId: existing.id,
            versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
            status: MasterItemVersionStatus.PUBLISHED,
            effectiveDate: new Date(),
            changeSummary: `Re-imported: source row changed${sourceBatchId ? ` (batch ${sourceBatchId})` : ""}.`,
            name: row.description,
            shortDescription: row.description,
            fullDescription,
            specificationTemplate,
            primaryUnit: row.unit,
            createdByUserId: owner.userId,
          },
        });
        versionsCreated += 1;
      }
      for (const classification of missingClassifications) {
        await prisma.masterItemClassification.upsert({
          where: { masterItemId_system_code: { masterItemId: existing.id, system: classification.system, code: classification.code } },
          create: { masterItemId: existing.id, system: classification.system, code: classification.code, label: classification.label ?? "", isPrimary: classification.isPrimary ?? false, source: `${profile.disciplineKey}-master-import` },
          update: {},
        });
        classificationsCreated += 1;
      }
    }
  }

  return { results, inserted, updated, unchanged, categoriesCreated, hierarchyNodesCreated, versionsCreated, classificationsCreated, warningRowCount };
}

function toBatchDTO(batch: {
  id: string; disciplineId: string; uploadedFileName: string; checksum: string; status: MasterCatalogueImportStatus;
  totalRows: number; insertedCount: number; updatedCount: number; unchangedCount: number; rejectedCount: number;
  validationReportJson: Prisma.JsonValue; executedAt: Date | null; rolledBackAt: Date | null; createdAt: Date;
}) {
  const report = (batch.validationReportJson as { rows?: RowResult[]; summary?: Record<string, number> } | null) ?? {};
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
    rows: report.rows ?? [],
    summary: report.summary ?? {},
    executedAt: batch.executedAt?.toISOString() ?? null,
    rolledBackAt: batch.rolledBackAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
  };
}

export type BulkImportInput = { uploadedFileName: string; csvText: string };

export async function dryRunBulkImport(owner: PlatformActor, profile: BulkImportProfile, input: BulkImportInput) {
  requireOwner(owner);
  const ctx = await requireHierarchyChain(profile);

  const { rows, malformed } = parseRows(input.csvText);
  const evaluated = await evaluate(owner, ctx, profile, rows, false);
  const allResults = [...evaluated.results, ...malformed].sort((a, b) => a.rowNumber - b.rowNumber);
  const checksum = computeChecksum(Buffer.from(input.csvText, "utf-8"));

  const summary = {
    totalRows: rows.length + malformed.length,
    validRows: rows.length,
    rejectedRows: malformed.length,
    warningRows: evaluated.warningRowCount,
    inserted: evaluated.inserted,
    updated: evaluated.updated,
    unchanged: evaluated.unchanged,
  };

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_CATALOGUE_BULK_IMPORT_DRY_RUN",
    targetType: "MasterDiscipline",
    targetId: ctx.disciplineId,
    metadata: { disciplineKey: profile.disciplineKey, uploadedFileName: input.uploadedFileName, checksum, ...summary },
  });

  return { disciplineId: ctx.disciplineId, uploadedFileName: input.uploadedFileName, checksum, ...summary, rows: allResults.slice(0, MAX_STORED_ROW_DETAIL) };
}

export async function executeBulkImport(owner: PlatformActor, profile: BulkImportProfile, input: BulkImportInput) {
  requireOwner(owner);
  const ctx = await requireHierarchyChain(profile);

  const { rows, malformed } = parseRows(input.csvText);
  const checksum = computeChecksum(Buffer.from(input.csvText, "utf-8"));

  const batch = await prisma.masterCatalogueImportBatch.create({
    data: {
      actorUserId: owner.userId,
      disciplineId: ctx.disciplineId,
      uploadedFileName: input.uploadedFileName,
      checksum,
      status: MasterCatalogueImportStatus.EXECUTED,
      totalRows: rows.length + malformed.length,
    },
  });

  const evaluated = await evaluate(owner, ctx, profile, rows, true, batch.id);
  const allResults = [...evaluated.results, ...malformed].sort((a, b) => a.rowNumber - b.rowNumber);

  const summary = {
    totalRows: rows.length + malformed.length,
    validRows: rows.length,
    rejectedRows: malformed.length,
    warningRows: evaluated.warningRowCount,
    inserted: evaluated.inserted,
    updated: evaluated.updated,
    unchanged: evaluated.unchanged,
    categoriesCreated: evaluated.categoriesCreated,
    hierarchyNodesCreated: evaluated.hierarchyNodesCreated,
    versionsCreated: evaluated.versionsCreated,
    classificationsCreated: evaluated.classificationsCreated,
  };

  const updatedBatch = await prisma.masterCatalogueImportBatch.update({
    where: { id: batch.id },
    data: {
      insertedCount: evaluated.inserted,
      updatedCount: evaluated.updated,
      unchangedCount: evaluated.unchanged,
      rejectedCount: malformed.length,
      validationReportJson: { rows: allResults.slice(0, MAX_STORED_ROW_DETAIL), summary },
      executedAt: new Date(),
    },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_CATALOGUE_BULK_IMPORT_EXECUTED",
    targetType: "MasterCatalogueImportBatch",
    targetId: batch.id,
    metadata: { disciplineKey: profile.disciplineKey, uploadedFileName: input.uploadedFileName, checksum, ...summary },
  });

  return toBatchDTO(updatedBatch);
}

export async function getBulkImportBatch(owner: PlatformActor, batchId: string) {
  requireOwner(owner);
  const batch = await prisma.masterCatalogueImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("Import batch not found.");
  return toBatchDTO(batch);
}
