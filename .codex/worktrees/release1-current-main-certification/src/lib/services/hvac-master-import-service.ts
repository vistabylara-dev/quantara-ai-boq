import { MasterCatalogueImportStatus, MasterClassificationSystem, MasterItemVersionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { parseCsv } from "@/lib/imports/csv-parser";
import { parseHvacSpecification } from "@/lib/imports/hvac-specification-parser";
import { computeChecksum } from "@/lib/files/file-security";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import { createHierarchyNode, getHierarchyNodeByCode } from "@/lib/repositories/master-hierarchy-repository";

/**
 * MASTER-SCALE-1B — additive, HVAC-source-specific sibling of
 * master-catalogue-admin-service.ts. That service's fixed 7-column schema
 * (itemCode,category,name,shortDescription,fullDescription,defaultUnit,
 * isPremium) has no concept of the composite specification payload, deep
 * hierarchy auto-creation, version creation, or classification extraction
 * this dataset needs — rather than overload it with optional columns for one
 * dataset's shape, this is a parallel, narrower pipeline that reuses the same
 * MasterCatalogueImportBatch tracking model and MasterItem/MasterCategory/
 * MasterHierarchyNode/MasterItemVersion/MasterItemClassification tables.
 *
 * Required CSV columns: itemCode, category, description, unit. `discipline`
 * is read but not trusted as a routing key — every row is imported under the
 * "mechanical" MasterDiscipline / HVAC hierarchy chain built in
 * MASTER-BOQ-1A's backfill, since that chain must already exist (checked
 * up front — a genuine blocking conflict if missing, not silently created
 * here). `specification` is parsed via parseHvacSpecification. quantity,
 * supplier, cost, margin, sellingRate, manufacturer, brand, model are read
 * but deliberately never stored on the tenant-less master catalogue — this
 * is pricing/vendor data, which belongs to a company's own library/rate
 * catalogue, never the shared master data (see CLAUDE.md architecture rules).
 */

const REQUIRED_COLUMNS = ["itemCode", "category", "description", "unit"] as const;
const MAX_ROWS = 5_000;
const MAX_STORED_ROW_DETAIL = 1000;
const HVAC_SYSTEM_HIERARCHY_CODE = "construction.mechanical.hvac";
const IMPORT_SOURCE_LABEL = "hvac-master-import";

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("HVAC master catalogue import is restricted to the platform owner.");
  }
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "item";
}

type ParsedRow = {
  rowNumber: number;
  itemCode: string;
  category: string;
  description: string;
  unit: string;
  specification: string;
};

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

async function resolveCategoryAndHierarchy(disciplineId: string, hvacSystemNodeId: string, categoryName: string, write: boolean): Promise<{ categoryId: string; hierarchyNodeId: string } | null> {
  const key = slugify(categoryName);
  let category = await prisma.masterCategory.findFirst({ where: { disciplineId, key } });
  if (!category) {
    if (!write) return null; // dry run — would be created
    category = await prisma.masterCategory.create({ data: { disciplineId, key, name: categoryName, path: key, depth: 0 } });
  }

  const nodeCode = `${HVAC_SYSTEM_HIERARCHY_CODE}.${key}`;
  const existingNode = await getHierarchyNodeByCode(nodeCode);
  let hierarchyNodeId = existingNode?.id;
  if (!hierarchyNodeId) {
    if (!write) return { categoryId: category.id, hierarchyNodeId: "" };
    const createdNode = await createHierarchyNode({ code: nodeCode, name: categoryName, nodeType: "CATEGORY", parentId: hvacSystemNodeId, sortOrder: 0 });
    hierarchyNodeId = createdNode.id;
  }

  return { categoryId: category.id, hierarchyNodeId };
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

async function evaluate(owner: PlatformActor, disciplineId: string, hvacSystemNodeId: string, rows: ParsedRow[], write: boolean, sourceBatchId?: string): Promise<EvaluateResult> {
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

  for (const row of rows) {
    let resolution = resolutionCache.get(row.category);
    if (resolution === undefined) {
      const categoryCountBefore = write ? await prisma.masterCategory.count({ where: { disciplineId } }) : 0;
      const nodeCountBefore = write ? await prisma.masterHierarchyNode.count() : 0;
      resolution = await resolveCategoryAndHierarchy(disciplineId, hvacSystemNodeId, row.category, write);
      resolutionCache.set(row.category, resolution);
      if (write && resolution) {
        const categoryCountAfter = await prisma.masterCategory.count({ where: { disciplineId } });
        const nodeCountAfter = await prisma.masterHierarchyNode.count();
        categoriesCreated += categoryCountAfter - categoryCountBefore;
        hierarchyNodesCreated += nodeCountAfter - nodeCountBefore;
      }
    }

    const parsedSpec = parseHvacSpecification(row.specification);
    const warnings = [...parsedSpec.warnings];
    if (warnings.length > 0) warningRowCount += 1;

    const fullDescription = parsedSpec.summary || row.description;
    const specificationTemplate = parsedSpec.specificationTemplate;

    const existing = await prisma.masterItem.findUnique({ where: { disciplineId_itemCode: { disciplineId, itemCode: row.itemCode } } });

    if (!existing) {
      inserted += 1;
      results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "insert", warnings });
      if (write) {
        if (!resolution) resolution = await resolveCategoryAndHierarchy(disciplineId, hvacSystemNodeId, row.category, true);
        const created = await prisma.masterItem.create({
          data: {
            disciplineId,
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
            changeSummary: `Imported from validated HVAC master dataset${sourceBatchId ? ` (batch ${sourceBatchId})` : ""}.`,
            name: row.description,
            shortDescription: row.description,
            fullDescription,
            specificationTemplate,
            primaryUnit: row.unit,
            createdByUserId: owner.userId,
          },
        });
        versionsCreated += 1;

        if (parsedSpec.masterFormatCode) {
          await prisma.masterItemClassification.create({
            data: { masterItemId: created.id, system: MasterClassificationSystem.MASTERFORMAT_2020, code: parsedSpec.masterFormatCode, isPrimary: true, source: IMPORT_SOURCE_LABEL },
          });
          classificationsCreated += 1;
        }
        if (parsedSpec.omniClassCode) {
          await prisma.masterItemClassification.create({
            data: { masterItemId: created.id, system: MasterClassificationSystem.OMNICLASS, code: parsedSpec.omniClassCode, label: parsedSpec.omniClassLabel, source: IMPORT_SOURCE_LABEL },
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
    const hasMasterFormat = existingClassifications.some((c) => c.system === MasterClassificationSystem.MASTERFORMAT_2020 && c.code === parsedSpec.masterFormatCode);
    const hasOmniClass = existingClassifications.some((c) => c.system === MasterClassificationSystem.OMNICLASS && c.code === parsedSpec.omniClassCode);
    const classificationChanged = (parsedSpec.masterFormatCode && !hasMasterFormat) || (parsedSpec.omniClassCode && !hasOmniClass);

    const changed = categoryChanged || nameChanged || versionContentChanged || classificationChanged;

    if (!changed) {
      unchanged += 1;
      results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "unchanged", warnings });
      continue;
    }

    updated += 1;
    results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "update", warnings });
    if (write) {
      if (!resolution) resolution = await resolveCategoryAndHierarchy(disciplineId, hvacSystemNodeId, row.category, true);
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
      if (parsedSpec.masterFormatCode && !hasMasterFormat) {
        await prisma.masterItemClassification.upsert({
          where: { masterItemId_system_code: { masterItemId: existing.id, system: MasterClassificationSystem.MASTERFORMAT_2020, code: parsedSpec.masterFormatCode } },
          create: { masterItemId: existing.id, system: MasterClassificationSystem.MASTERFORMAT_2020, code: parsedSpec.masterFormatCode, isPrimary: true, source: IMPORT_SOURCE_LABEL },
          update: {},
        });
        classificationsCreated += 1;
      }
      if (parsedSpec.omniClassCode && !hasOmniClass) {
        await prisma.masterItemClassification.upsert({
          where: { masterItemId_system_code: { masterItemId: existing.id, system: MasterClassificationSystem.OMNICLASS, code: parsedSpec.omniClassCode } },
          create: { masterItemId: existing.id, system: MasterClassificationSystem.OMNICLASS, code: parsedSpec.omniClassCode, label: parsedSpec.omniClassLabel, source: IMPORT_SOURCE_LABEL },
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

async function requireHvacHierarchyChain(): Promise<{ disciplineId: string; hvacSystemNodeId: string }> {
  const discipline = await prisma.masterDiscipline.findUnique({ where: { key: "mechanical" } });
  if (!discipline) throw new AppError("HIERARCHY_NOT_READY", "The 'mechanical' MasterDiscipline does not exist — run the MASTER-BOQ-1A hierarchy backfill first.", 409);
  const hvacNode = await getHierarchyNodeByCode(HVAC_SYSTEM_HIERARCHY_CODE);
  if (!hvacNode) throw new AppError("HIERARCHY_NOT_READY", `Hierarchy node "${HVAC_SYSTEM_HIERARCHY_CODE}" does not exist — run the MASTER-BOQ-1A hierarchy backfill first.`, 409);
  return { disciplineId: discipline.id, hvacSystemNodeId: hvacNode.id };
}

export type HvacMasterImportInput = { uploadedFileName: string; csvText: string };

export async function dryRunHvacMasterImport(owner: PlatformActor, input: HvacMasterImportInput) {
  requireOwner(owner);
  const { disciplineId, hvacSystemNodeId } = await requireHvacHierarchyChain();

  const { rows, malformed } = parseRows(input.csvText);
  const evaluated = await evaluate(owner, disciplineId, hvacSystemNodeId, rows, false);
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
    action: "HVAC_MASTER_IMPORT_DRY_RUN",
    targetType: "MasterDiscipline",
    targetId: disciplineId,
    metadata: { uploadedFileName: input.uploadedFileName, checksum, ...summary },
  });

  return { disciplineId, uploadedFileName: input.uploadedFileName, checksum, ...summary, rows: allResults.slice(0, MAX_STORED_ROW_DETAIL) };
}

export async function executeHvacMasterImport(owner: PlatformActor, input: HvacMasterImportInput) {
  requireOwner(owner);
  const { disciplineId, hvacSystemNodeId } = await requireHvacHierarchyChain();

  const { rows, malformed } = parseRows(input.csvText);
  const checksum = computeChecksum(Buffer.from(input.csvText, "utf-8"));

  const batch = await prisma.masterCatalogueImportBatch.create({
    data: {
      actorUserId: owner.userId,
      disciplineId,
      uploadedFileName: input.uploadedFileName,
      checksum,
      status: MasterCatalogueImportStatus.EXECUTED,
      totalRows: rows.length + malformed.length,
    },
  });

  const evaluated = await evaluate(owner, disciplineId, hvacSystemNodeId, rows, true, batch.id);
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
    action: "HVAC_MASTER_IMPORT_EXECUTED",
    targetType: "MasterCatalogueImportBatch",
    targetId: batch.id,
    metadata: { uploadedFileName: input.uploadedFileName, checksum, ...summary },
  });

  return toBatchDTO(updatedBatch);
}

export async function getHvacMasterImportBatch(owner: PlatformActor, batchId: string) {
  requireOwner(owner);
  const batch = await prisma.masterCatalogueImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("Import batch not found.");
  return toBatchDTO(batch);
}
