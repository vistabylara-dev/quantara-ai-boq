import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import {
  createExtractedEntity,
  getExtractedEntityRecord,
  listExtractedEntities,
  toExtractedEntityDTO,
  type CreateExtractedEntityInput,
} from "@/lib/repositories/extracted-entity-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";

export async function manuallyAddExtractedEntity(actor: CurrentActor, input: CreateExtractedEntityInput) {
  requireCapability(actor, "files:manage");
  const row = await createExtractedEntity(actor.companyId, { ...input, extractionMethod: "MANUAL" });
  await createAuditLog(actor.companyId, { entityType: "ExtractedEntity", entityId: row.id, action: "ENTITY_MANUALLY_ADDED", payload: { entityType: input.entityType, label: input.label } });
  return toExtractedEntityDTO(row);
}

export async function listEntitiesForProject(actor: CurrentActor, projectId: string, filters?: { status?: string; entityType?: string }) {
  const rows = await listExtractedEntities(actor.companyId, projectId, filters);
  return rows.map(toExtractedEntityDTO);
}

/** Human verification workflow (spec section 25): confirm/correct/reject, always preserving the original value and requiring a reason for corrections. Confirmed values are never overwritten by later reprocessing. */
export async function confirmExtractedEntity(actor: CurrentActor, entityId: string) {
  requireCapability(actor, "verification:manage");
  const entity = await getExtractedEntityRecord(actor.companyId, entityId);
  const updated = await prisma.extractedEntity.update({
    where: { id: entity.id },
    data: { status: "CONFIRMED", confirmedByUserId: actor.userId, confirmedAt: new Date() },
  });
  await createAuditLog(actor.companyId, { entityType: "ExtractedEntity", entityId, action: "ENTITY_CONFIRMED", payload: {} });
  return toExtractedEntityDTO(updated);
}

export async function correctExtractedEntity(actor: CurrentActor, entityId: string, corrections: { label?: string; quantity?: number; unit?: string; reason: string }) {
  requireCapability(actor, "verification:manage");
  const entity = await getExtractedEntityRecord(actor.companyId, entityId);

  if (entity.status === "CONFIRMED" || entity.status === "IMPORTED") {
    throw new AppError("ENTITY_ALREADY_FINALIZED", "This entity has already been confirmed or imported and cannot be silently corrected further without a new review cycle.", 409);
  }

  const original = { label: entity.label, quantity: entity.quantity?.toNumber() ?? null, unit: entity.unit };
  const updated = await prisma.extractedEntity.update({
    where: { id: entity.id },
    data: {
      label: corrections.label ?? entity.label,
      quantity: corrections.quantity ?? entity.quantity,
      unit: corrections.unit ?? entity.unit,
      status: "CORRECTED",
      confirmedByUserId: actor.userId,
      confirmedAt: new Date(),
      correctionJson: { original, corrected: corrections, correctedByUserId: actor.userId, correctedAt: new Date().toISOString(), reason: corrections.reason },
    },
  });
  await createAuditLog(actor.companyId, { entityType: "ExtractedEntity", entityId, action: "ENTITY_CORRECTED", payload: { original, corrected: corrections, reason: corrections.reason } });
  return toExtractedEntityDTO(updated);
}

export async function rejectExtractedEntity(actor: CurrentActor, entityId: string, reason: string) {
  requireCapability(actor, "verification:manage");
  await getExtractedEntityRecord(actor.companyId, entityId);
  const updated = await prisma.extractedEntity.update({
    where: { id: entityId },
    data: { status: "REJECTED", rejectedByUserId: actor.userId, rejectedAt: new Date(), correctionJson: { reason } },
  });
  await createAuditLog(actor.companyId, { entityType: "ExtractedEntity", entityId, action: "ENTITY_REJECTED", payload: { reason } });
  return toExtractedEntityDTO(updated);
}
