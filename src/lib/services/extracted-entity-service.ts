import { prisma } from "@/lib/db/prisma";
import type { ExtractedEntity, ExtractedEntityStatus, Prisma } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import {
  createExtractedEntity,
  listExtractedEntities,
  toExtractedEntityDTO,
  type CreateExtractedEntityInput,
} from "@/lib/repositories/extracted-entity-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getProjectFileRecord } from "@/lib/repositories/project-file-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";

const REVIEWABLE_EXTRACTED_ENTITY_STATUSES: ReadonlySet<ExtractedEntityStatus> = new Set([
  "EXTRACTED",
  "NEEDS_REVIEW",
]);

/**
 * A professional review decision is a one-way transition. Starting another review cycle for a
 * finalized entity requires a separate, explicit workflow and must never happen implicitly here.
 */
function assertExtractedEntityIsReviewable(status: ExtractedEntityStatus): void {
  if (!REVIEWABLE_EXTRACTED_ENTITY_STATUSES.has(status)) {
    throw new AppError(
      "ENTITY_ALREADY_FINALIZED",
      "This entity has already received a professional decision and cannot be reviewed again without a new review cycle.",
      409,
    );
  }
}

async function getExtractedEntityInTransaction(
  tx: Prisma.TransactionClient,
  companyId: string,
  entityId: string,
): Promise<ExtractedEntity> {
  const entity = await tx.extractedEntity.findFirst({
    where: { id: entityId, companyId },
  });
  if (!entity) {
    throw new AppError("NOT_FOUND", "Extracted entity not found.", 404);
  }
  return entity;
}

async function applyExtractedEntityReviewDecision(
  tx: Prisma.TransactionClient,
  actor: CurrentActor,
  entity: ExtractedEntity,
  data: Prisma.ExtractedEntityUpdateManyMutationInput,
): Promise<ExtractedEntity> {
  assertExtractedEntityIsReviewable(entity.status);
  const claimed = await tx.extractedEntity.updateMany({
    where: {
      id: entity.id,
      companyId: actor.companyId,
      status: { in: [...REVIEWABLE_EXTRACTED_ENTITY_STATUSES] },
    },
    data,
  });

  if (claimed.count !== 1) {
    const current = await getExtractedEntityInTransaction(tx, actor.companyId, entity.id);
    assertExtractedEntityIsReviewable(current.status);
    throw new AppError("ENTITY_REVIEW_CONFLICT", "This entity could not be claimed for professional review.", 409);
  }

  return getExtractedEntityInTransaction(tx, actor.companyId, entity.id);
}

export async function manuallyAddExtractedEntity(actor: CurrentActor, input: CreateExtractedEntityInput) {
  requireCapability(actor, "files:manage");
  // input.projectId/projectFileId are caller-supplied (possibly a project slug) — resolve both
  // to canonical, tenant-owned records and prove the file actually belongs to that project
  // before persisting. A cross-company or cross-project file id must never be accepted.
  const project = await getProjectRecord(actor.companyId, input.projectId);
  const file = await getProjectFileRecord(actor.companyId, input.projectFileId);
  if (file.projectId !== project.id) {
    throw new AppError("FILE_PROJECT_MISMATCH", "This file does not belong to the specified project.", 400);
  }

  const row = await createExtractedEntity(actor.companyId, {
    ...input,
    projectId: project.id,
    projectFileId: file.id,
    extractionMethod: "MANUAL",
    status: "NEEDS_REVIEW",
  });
  await createAuditLog(actor.companyId, { entityType: "ExtractedEntity", entityId: row.id, action: "ENTITY_MANUALLY_ADDED", payload: { entityType: input.entityType, label: input.label } });
  return toExtractedEntityDTO(row);
}

export async function listEntitiesForProject(
  actor: CurrentActor,
  projectId: string,
  filters?: { status?: string; entityType?: string; ids?: string[] },
) {
  const rows = await listExtractedEntities(actor.companyId, projectId, filters);
  // PR3: additive, optional narrowing for callers that only need to resolve
  // a small, known set of entity ids (e.g. the TAYQAN work-order panel
  // resolving measurementExceptions[].relatedEntityId) without paying to
  // serialize every entity in the project — company scoping already
  // happened above via listExtractedEntities, so this is a pure narrowing,
  // never a way to reach another company's rows. Omitted entirely (default)
  // leaves every existing caller's behavior byte-identical.
  const scoped = filters?.ids && filters.ids.length > 0
    ? rows.filter((row) => filters.ids!.includes(row.id))
    : rows;
  return scoped.map(toExtractedEntityDTO);
}

/** Human verification workflow (spec section 25): confirm/correct/reject, always preserving the original value and requiring a reason for corrections. Confirmed values are never overwritten by later reprocessing. */
export async function confirmExtractedEntity(actor: CurrentActor, entityId: string) {
  requireCapability(actor, "verification:manage");
  const updated = await prisma.$transaction(async (tx) => {
    const entity = await getExtractedEntityInTransaction(tx, actor.companyId, entityId);
    const decided = await applyExtractedEntityReviewDecision(tx, actor, entity, {
      status: "CONFIRMED",
      confirmedByUserId: actor.userId,
      confirmedAt: new Date(),
    });
    await createAuditLog(actor.companyId, { entityType: "ExtractedEntity", entityId, action: "ENTITY_CONFIRMED", payload: {} }, tx);
    return decided;
  });
  return toExtractedEntityDTO(updated);
}

export async function correctExtractedEntity(actor: CurrentActor, entityId: string, corrections: { label?: string; quantity?: number; unit?: string; reason: string }) {
  requireCapability(actor, "verification:manage");
  const updated = await prisma.$transaction(async (tx) => {
    const entity = await getExtractedEntityInTransaction(tx, actor.companyId, entityId);
    const original = { label: entity.label, quantity: entity.quantity?.toNumber() ?? null, unit: entity.unit };
    const decided = await applyExtractedEntityReviewDecision(tx, actor, entity, {
      label: corrections.label ?? entity.label,
      quantity: corrections.quantity ?? entity.quantity,
      unit: corrections.unit ?? entity.unit,
      status: "CORRECTED",
      confirmedByUserId: actor.userId,
      confirmedAt: new Date(),
      correctionJson: { original, corrected: corrections, correctedByUserId: actor.userId, correctedAt: new Date().toISOString(), reason: corrections.reason },
    });
    await createAuditLog(actor.companyId, { entityType: "ExtractedEntity", entityId, action: "ENTITY_CORRECTED", payload: { original, corrected: corrections, reason: corrections.reason } }, tx);
    return decided;
  });
  return toExtractedEntityDTO(updated);
}

export async function rejectExtractedEntity(actor: CurrentActor, entityId: string, reason: string) {
  requireCapability(actor, "verification:manage");
  const updated = await prisma.$transaction(async (tx) => {
    const entity = await getExtractedEntityInTransaction(tx, actor.companyId, entityId);
    const decided = await applyExtractedEntityReviewDecision(tx, actor, entity, {
      status: "REJECTED",
      rejectedByUserId: actor.userId,
      rejectedAt: new Date(),
      correctionJson: { reason },
    });
    await createAuditLog(actor.companyId, { entityType: "ExtractedEntity", entityId, action: "ENTITY_REJECTED", payload: { reason } }, tx);
    return decided;
  });
  return toExtractedEntityDTO(updated);
}
