import {
  ExtractedEntityStatus,
  ExtractedEntityType,
  ExtractionMethod,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  mapFurnitureCandidateTable,
  type FurnitureCandidateDiscipline,
  type FurniturePartCandidate,
  type FurnitureSourceKind,
  type FurnitureSourceTable,
} from "@/lib/furniture/candidate-mapper";
import { getFurnitureProjectDiscipline } from "@/lib/furniture/project-discipline";
import {
  furnitureOrderItemCandidateEnvelope,
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
  mapFurnitureOrderItemCandidates,
  type FurnitureOrderItemCandidate,
} from "@/lib/furniture/order-item-mapper";
import {
  FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  FURNITURE_JOINERY_INDUSTRY_KEY,
} from "@/lib/furniture/types";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { hasReviewedTableDerivedCandidates } from "@/lib/repositories/extracted-entity-repository";
import {
  listExtractedTablesForFile,
  type ExtractedTableRecord,
} from "@/lib/repositories/extracted-table-repository";
import { getProjectFileRecord } from "@/lib/repositories/project-file-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";

export { FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND } from "@/lib/furniture/types";

export type FurnitureCandidateGenerationResult = {
  status: "generated" | "skipped";
  reason?: string;
  tablesConsidered: number;
  rowsConsidered: number;
  candidatesCreated: number;
};

export type FurnitureCandidateGenerationInput = {
  companyId: string;
  projectId: string;
  projectFileId: string;
  extractionJobId?: string | null;
};

function resolveSourceKind(extension: string): FurnitureSourceKind {
  if (extension.toLowerCase() === "xlsx") return "WORKBOOK";
  if (extension.toLowerCase() === "pdf") return "PDF_TABLE";
  return "EXTRACTED_TABLE";
}

function normalizedColumnKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
}

function hasPartHierarchyColumns(table: FurnitureSourceTable): boolean {
  const keys = new Set(table.rows.flatMap((row) => row.cells.map((cell) => normalizedColumnKey(cell.columnKey))));
  return keys.has("room") && (
    keys.has("part")
    || keys.has("cabinet_unit")
    || keys.has("cabinet_assembly")
    || keys.has("unit_assembly")
  );
}

function toSourceTable(
  table: ExtractedTableRecord,
  pageNumberById: ReadonlyMap<string, number>,
  tableIndex: number,
): FurnitureSourceTable {
  const logicalTableName = table.sheetName ?? table.title ?? table.tableType;
  return {
    sourceTableId: table.id,
    sourceTableKey: `${logicalTableName}:${tableIndex}`,
    sheetName: table.sheetName ?? undefined,
    title: table.title ?? undefined,
    pageNumber: table.drawingPageId ? pageNumberById.get(table.drawingPageId) : undefined,
    confidence: table.confidence.toNumber(),
    method: ExtractionMethod.TABLE_PARSER,
    rows: table.rows.map((row, rowIndex) => ({
      sourceRowId: row.id,
      sourceRowKey: `${row.rowNumber}:${rowIndex}`,
      rowNumber: row.rowNumber,
      confidence: row.confidence.toNumber(),
      cells: row.cells.map((cell) => ({
        columnKey: cell.columnKey,
        rawValue: cell.rawValue ?? "",
        ...(cell.normalizedValue !== null ? { normalizedValue: cell.normalizedValue } : {}),
        ...(cell.sourceCellReference !== null ? { sourceCellReference: cell.sourceCellReference } : {}),
      })),
    })),
  };
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readCandidateId(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  const candidate = envelope.candidate;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const candidateRecord = candidate as Record<string, unknown>;
  const candidateId = envelope.kind === FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND
    ? candidateRecord.candidateId
    : envelope.kind === FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND
      ? candidateRecord.id
      : null;
  return typeof candidateId === "string" ? candidateId : null;
}

function candidateData(
  input: FurnitureCandidateGenerationInput,
  projectId: string,
  projectFileId: string,
  drawingPageId: string | null,
  fileName: string,
  table: ExtractedTableRecord,
  candidate: FurniturePartCandidate,
): Prisma.ExtractedEntityUncheckedCreateInput {
  const sourceReference = [
    fileName,
    candidate.evidence.sheetName
      ?? (candidate.evidence.pageNumber ? `page ${candidate.evidence.pageNumber}` : table.title ?? table.tableType),
    `row ${candidate.evidence.rowNumber}`,
  ].join(" · ");
  const sourceText = Object.entries(candidate.evidence.rawCells)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ")
    .slice(0, 4000);

  return {
    companyId: input.companyId,
    projectId,
    projectFileId,
    drawingPageId,
    extractionJobId: input.extractionJobId ?? null,
    entityType: ExtractedEntityType.FURNITURE,
    categoryKey: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
    label: candidate.part,
    normalizedLabel: [candidate.room, candidate.elevationReference, candidate.assembly, candidate.part]
      .join(" / ")
      .toLowerCase(),
    quantity: candidate.quantity,
    unit: candidate.quantity === null ? null : "pcs",
    confidence: Math.max(0, Math.min(100, candidate.evidence.confidence ?? 0)),
    extractionMethod: ExtractionMethod.TABLE_PARSER,
    sourceText,
    sourceReference,
    technicalDataJson: asJson({
      kind: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
      candidate,
    }),
    status: ExtractedEntityStatus.NEEDS_REVIEW,
  };
}

function orderCandidateData(
  input: FurnitureCandidateGenerationInput,
  projectId: string,
  projectFileId: string,
  drawingPageId: string | null,
  fileName: string,
  candidate: FurnitureOrderItemCandidate,
): Prisma.ExtractedEntityUncheckedCreateInput {
  const location = candidate.evidence.sheetName
    ?? (candidate.evidence.pageNumber === null ? "Source table" : `page ${candidate.evidence.pageNumber}`);
  return {
    companyId: input.companyId,
    projectId,
    projectFileId,
    drawingPageId,
    extractionJobId: input.extractionJobId ?? null,
    entityType: ExtractedEntityType.FURNITURE,
    categoryKey: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
    label: candidate.description,
    normalizedLabel: candidate.description.toLowerCase().trim(),
    quantity: candidate.quantity,
    unit: candidate.unit,
    confidence: Math.max(0, Math.min(100, candidate.evidence.confidence ?? 0)),
    extractionMethod: ExtractionMethod.TABLE_PARSER,
    sourceText: Object.entries(candidate.evidence.rawCells)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; ")
      .slice(0, 4000),
    sourceReference: [fileName, location, `row ${candidate.evidence.rowNumber}`].join(" · "),
    technicalDataJson: asJson(furnitureOrderItemCandidateEnvelope(candidate)),
    status: ExtractedEntityStatus.NEEDS_REVIEW,
  };
}

/**
 * Maps already-stored structured rows for the combined furniture industry.
 * It never reads the source again and never calls an AI/provider. Repeated
 * calls update the same deterministic, still-unreviewed candidate keys and
 * create only missing keys. Reviewed candidates cause a fail-safe no-op.
 */
export async function generateFurnitureCandidatesFromStructuredTables(
  input: FurnitureCandidateGenerationInput,
): Promise<FurnitureCandidateGenerationResult> {
  const project = await getProjectRecord(input.companyId, input.projectId);
  if (project.industryEngine.key !== FURNITURE_JOINERY_INDUSTRY_KEY) {
    throw new AppError(
      "FURNITURE_PROJECT_REQUIRED",
      "Furniture candidate mapping is available only for Furniture, Joinery & Cabinetry projects.",
      400,
    );
  }

  const file = await getProjectFileRecord(input.companyId, input.projectFileId);
  if (file.projectId !== project.id) {
    throw new AppError("FILE_PROJECT_MISMATCH", "This file does not belong to the specified project.", 400);
  }

  if (await hasReviewedTableDerivedCandidates(input.companyId, file.id)) {
    return {
      status: "skipped",
      reason: "Reviewed furniture candidates already exist for this file; generation was skipped to preserve professional review.",
      tablesConsidered: 0,
      rowsConsidered: 0,
      candidatesCreated: 0,
    };
  }

  const tables = await listExtractedTablesForFile(input.companyId, file.id);
  if (tables.length === 0) {
    return { status: "generated", tablesConsidered: 0, rowsConsidered: 0, candidatesCreated: 0 };
  }

  const drawingPageIds = tables.map((table) => table.drawingPageId).filter((id): id is string => Boolean(id));
  const drawingPages = drawingPageIds.length > 0
    ? await prisma.drawingPage.findMany({
        where: { companyId: input.companyId, projectFileId: file.id, id: { in: drawingPageIds } },
        select: { id: true, pageNumber: true },
      })
    : [];
  const pageNumberById = new Map(drawingPages.map((page) => [page.id, page.pageNumber]));
  const discipline = await getFurnitureProjectDiscipline(input.companyId, project.id);
  const sourceKind = resolveSourceKind(file.extension);
  const mappedTables = tables.map((table, tableIndex) => {
    const sourceTable = toSourceTable(table, pageNumberById, tableIndex);
    const orderResult = mapFurnitureOrderItemCandidates(sourceTable, {
      sourceFileId: file.id,
      sourceFileName: file.originalName,
      sourceKind,
    });
    if (!hasPartHierarchyColumns(sourceTable) && orderResult.items.length > 0) {
      return { kind: "ORDER_ITEMS" as const, table, result: orderResult };
    }
    return { kind: "PARTS" as const, table, result: mapFurnitureCandidateTable(sourceTable, {
      industryEnabled: true,
      discipline: discipline as FurnitureCandidateDiscipline,
      sourceKind,
      sourceFileName: file.originalName,
      sourceFileId: file.id,
      frontEdgeOrientationAssumption: null,
    }) };
  });
  const rowsConsidered = tables.reduce((sum, table) => sum + table.rows.length, 0);

  let candidatesCreated = 0;

  const reviewedInsideLock = await prisma.$transaction(async (tx) => {
    // Serialize this one tenant/file candidate set without mutating the file
    // row or adding schema. This closes the read-then-create race between a
    // worker completion and a user-triggered prepare retry.
    const lockKey = `furniture-candidates:${input.companyId}:${file.id}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const existing = await tx.extractedEntity.findMany({
      where: {
        companyId: input.companyId,
        projectFileId: file.id,
        categoryKey: {
          in: [
            FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
            FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
          ],
        },
        extractionMethod: ExtractionMethod.TABLE_PARSER,
      },
      select: { id: true, status: true, technicalDataJson: true },
    });
    const existingByCandidateId = new Map<string, string>();
    for (const entity of existing) {
      const candidateId = readCandidateId(entity.technicalDataJson);
      if (!candidateId) continue;
      if (existingByCandidateId.has(candidateId)) {
        throw new AppError(
          "FURNITURE_CANDIDATE_INTEGRITY_ERROR",
          "Duplicate furniture candidate keys were detected. Generation stopped without adding more rows.",
          409,
        );
      }
      existingByCandidateId.set(candidateId, entity.id);
    }

    // The optimistic guard above avoids unnecessary table work, while this
    // in-lock guard closes the race where a reviewer changes a candidate
    // between that first read and this serialized generation transaction.
    if (existing.some((entity) => (
      entity.status !== ExtractedEntityStatus.EXTRACTED
      && entity.status !== ExtractedEntityStatus.NEEDS_REVIEW
    ))) {
      return true;
    }

    async function persistCandidateData(
      candidateId: string,
      data: Prisma.ExtractedEntityUncheckedCreateInput,
    ): Promise<void> {
      const existingId = existingByCandidateId.get(candidateId);
      if (existingId) {
        const { companyId: _companyId, projectId: _projectId, projectFileId: _projectFileId, ...updateData } = data;
        await tx.extractedEntity.updateMany({
          where: {
            id: existingId,
            companyId: input.companyId,
            projectFileId: file.id,
            status: { in: [ExtractedEntityStatus.EXTRACTED, ExtractedEntityStatus.NEEDS_REVIEW] },
          },
          data: updateData,
        });
      } else {
        const created = await tx.extractedEntity.create({ data });
        existingByCandidateId.set(candidateId, created.id);
        candidatesCreated += 1;
      }
    }

    for (const mapped of mappedTables) {
      if (mapped.kind === "ORDER_ITEMS") {
        for (const candidate of mapped.result.items) {
          await persistCandidateData(candidate.id, orderCandidateData(
            input,
            project.id,
            file.id,
            mapped.table.drawingPageId ?? null,
            file.originalName,
            candidate,
          ));
        }
        continue;
      }
      if (mapped.result.status !== "mapped") continue;
      for (const candidate of mapped.result.candidates) {
        await persistCandidateData(candidate.candidateId, candidateData(
          input,
          project.id,
          file.id,
          mapped.table.drawingPageId ?? null,
          file.originalName,
          mapped.table,
          candidate,
        ));
      }
    }

    await createAuditLog(input.companyId, {
      entityType: "ProjectFile",
      entityId: file.id,
      action: "FURNITURE_SOURCE_CANDIDATES_GENERATED",
      payload: {
        projectId: project.id,
        projectFileId: file.id,
        extractionJobId: input.extractionJobId ?? null,
        discipline,
        tablesConsidered: tables.length,
        rowsConsidered,
        candidatesCreated,
      },
    }, tx);

    return false;
  });

  if (reviewedInsideLock) {
    return {
      status: "skipped",
      reason: "Reviewed furniture candidates already exist for this file; generation was skipped to preserve professional review.",
      tablesConsidered: 0,
      rowsConsidered: 0,
      candidatesCreated: 0,
    };
  }

  return {
    status: "generated",
    tablesConsidered: tables.length,
    rowsConsidered,
    candidatesCreated,
  };
}
