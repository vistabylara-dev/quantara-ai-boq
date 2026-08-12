import type { ExtractedEntity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import {
  extractTableFieldEvidence,
  extractTableNumericEvidence,
  formatTableNumericEvidence,
} from "@/lib/files/table-extraction/numeric-evidence";

export function toExtractedEntityDTO(row: ExtractedEntity) {
  const tableEvidence = row.extractionMethod === "TABLE_PARSER"
    ? extractTableFieldEvidence(row.technicalDataJson)
    : [];
  const numericEvidence = row.extractionMethod === "TABLE_PARSER"
    ? extractTableNumericEvidence(row.technicalDataJson)
    : [];
  const numericEvidenceSummary = formatTableNumericEvidence(numericEvidence);
  const sourceTextParts = [
    row.sourceText?.trim() || null,
    numericEvidenceSummary
      ? `Captured numeric table fields (header → value): ${numericEvidenceSummary}`
      : null,
  ].filter((part): part is string => Boolean(part));

  return {
    id: row.id,
    projectId: row.projectId,
    projectFileId: row.projectFileId,
    drawingPageId: row.drawingPageId,
    extractionJobId: row.extractionJobId,
    entityType: row.entityType,
    categoryKey: row.categoryKey,
    label: row.label,
    quantity: row.quantity?.toNumber() ?? null,
    unit: row.unit,
    confidence: row.confidence.toNumber(),
    extractionMethod: row.extractionMethod,
    sourceText: sourceTextParts.length > 0 ? sourceTextParts.join("\n") : null,
    sourceReference: row.sourceReference,
    // Row evidence only (table/row IDs, normalized dimension keys, raw cell values) — never
    // storage keys, provider credentials, or anything else infrastructure-internal.
    technicalData: row.technicalDataJson,
    tableEvidence,
    numericEvidence,
    status: row.status,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    correction: row.correctionJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listExtractedEntities(companyId: string, projectId: string, filters?: { status?: string; entityType?: string }): Promise<ExtractedEntity[]> {
  return prisma.extractedEntity.findMany({
    where: {
      companyId,
      projectId,
      status: filters?.status as ExtractedEntity["status"] | undefined,
      entityType: filters?.entityType as ExtractedEntity["entityType"] | undefined,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getExtractedEntityRecord(companyId: string, entityId: string): Promise<ExtractedEntity> {
  const row = await prisma.extractedEntity.findFirst({ where: { id: entityId, companyId } });
  if (!row) throw new NotFoundError("Extracted entity not found.");
  return row;
}

export type CreateExtractedEntityInput = {
  projectId: string;
  projectFileId: string;
  entityType: ExtractedEntity["entityType"];
  label: string;
  quantity?: number | null;
  unit?: string | null;
  confidence: number;
  extractionMethod: ExtractedEntity["extractionMethod"];
  sourceText?: string | null;
  /** All optional fields below already exist on the Prisma model — added here for automatic
   * (bridge-generated) candidates, which need real source provenance a manual entry doesn't have. */
  drawingPageId?: string | null;
  extractionJobId?: string | null;
  sourceReference?: string | null;
  technicalDataJson?: Prisma.InputJsonValue | null;
  /** Existing manual callers keep defaulting to EXTRACTED; automatic bridge-created candidates
   * must pass NEEDS_REVIEW explicitly — nothing here defaults to a reviewed/confirmed status. */
  status?: ExtractedEntity["status"];
};

export async function createExtractedEntity(companyId: string, input: CreateExtractedEntityInput, db: DbClient = prisma): Promise<ExtractedEntity> {
  return db.extractedEntity.create({
    data: {
      companyId,
      projectId: input.projectId,
      projectFileId: input.projectFileId,
      drawingPageId: input.drawingPageId ?? null,
      extractionJobId: input.extractionJobId ?? null,
      entityType: input.entityType,
      label: input.label,
      normalizedLabel: input.label.toLowerCase().trim(),
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      confidence: input.confidence,
      extractionMethod: input.extractionMethod,
      sourceText: input.sourceText ?? null,
      sourceReference: input.sourceReference ?? null,
      technicalDataJson: input.technicalDataJson ?? undefined,
      status: input.status ?? "EXTRACTED",
    },
  });
}

/**
 * True once any TABLE_PARSER-sourced candidate for this file has left the unreviewed states
 * (EXTRACTED/NEEDS_REVIEW) — i.e. a human has confirmed/corrected/rejected/imported it. Used to
 * protect reviewed review-candidate work from being silently regenerated or having its source
 * evidence (the ExtractedTable/Row/Cell rows it points to) replaced by a later re-extraction.
 */
export async function hasReviewedTableDerivedCandidates(companyId: string, projectFileId: string, db: DbClient = prisma): Promise<boolean> {
  const count = await db.extractedEntity.count({
    where: {
      companyId,
      projectFileId,
      extractionMethod: "TABLE_PARSER",
      status: { in: ["CONFIRMED", "CORRECTED", "REJECTED", "IMPORTED"] },
    },
  });
  return count > 0;
}

export type DbClient = typeof prisma | Prisma.TransactionClient;
