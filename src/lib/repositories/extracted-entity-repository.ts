import type { ExtractedEntity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export function toExtractedEntityDTO(row: ExtractedEntity) {
  return {
    id: row.id,
    projectId: row.projectId,
    projectFileId: row.projectFileId,
    entityType: row.entityType,
    categoryKey: row.categoryKey,
    label: row.label,
    quantity: row.quantity?.toNumber() ?? null,
    unit: row.unit,
    confidence: row.confidence.toNumber(),
    extractionMethod: row.extractionMethod,
    sourceText: row.sourceText,
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
  quantity?: number;
  unit?: string;
  confidence: number;
  extractionMethod: ExtractedEntity["extractionMethod"];
  sourceText?: string;
};

export async function createExtractedEntity(companyId: string, input: CreateExtractedEntityInput): Promise<ExtractedEntity> {
  return prisma.extractedEntity.create({
    data: {
      companyId,
      projectId: input.projectId,
      projectFileId: input.projectFileId,
      entityType: input.entityType,
      label: input.label,
      normalizedLabel: input.label.toLowerCase().trim(),
      quantity: input.quantity,
      unit: input.unit,
      confidence: input.confidence,
      extractionMethod: input.extractionMethod,
      sourceText: input.sourceText,
      status: "EXTRACTED",
    },
  });
}

export type DbClient = typeof prisma | Prisma.TransactionClient;
