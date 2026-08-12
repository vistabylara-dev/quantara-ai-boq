import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getProjectFileRecord } from "@/lib/repositories/project-file-repository";
import { createExtractedEntity, toExtractedEntityDTO } from "@/lib/repositories/extracted-entity-repository";
import {
  getTablePageResolution,
  recordTablePageResolutionDecision,
} from "@/lib/repositories/table-page-resolution-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — the manual-recovery path for a page none of
 * the three deterministic PDF table-recovery fallbacks (grid, structural
 * schedule regex, positional text) could safely resolve. "We did not
 * guess" is the whole point: a manually-typed row is real human input,
 * recorded as an ExtractedEntity in NEEDS_REVIEW — never auto-imported into
 * a BOQ — and the page's resolution decision is tracked separately from
 * that evidence via TablePageResolution.
 */

async function resolveOwnedFile(actor: CurrentActor, projectId: string, projectFileId: string) {
  requireCapability(actor, "files:manage");
  const project = await getProjectRecord(actor.companyId, projectId);
  const file = await getProjectFileRecord(actor.companyId, projectFileId);
  if (file.projectId !== project.id) {
    throw new AppError("FILE_PROJECT_MISMATCH", "This file does not belong to the specified project.", 400);
  }
  return { project, file };
}

export async function getPageRecoveryState(actor: CurrentActor, projectId: string, projectFileId: string, pageNumber: number) {
  await resolveOwnedFile(actor, projectId, projectFileId);
  const resolution = await getTablePageResolution(actor.companyId, projectFileId, pageNumber);
  return {
    decision: resolution?.decision ?? "UNRESOLVED",
    decidedAt: resolution?.decidedAt?.toISOString() ?? null,
  };
}

export type ManualPageRowInput = {
  itemCode: string;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
};

/**
 * Saves a manually-typed row for a page that couldn't be safely
 * reconstructed. This is SOURCE REVIEW evidence, not a BOQ item — it never
 * auto-imports. A human must still confirm it (same NEEDS_REVIEW review
 * flow as every other extracted candidate) before it can become part of a
 * real BOQ.
 */
export async function addManualPageRow(
  actor: CurrentActor,
  projectId: string,
  projectFileId: string,
  pageNumber: number,
  input: ManualPageRowInput,
) {
  const { project, file } = await resolveOwnedFile(actor, projectId, projectFileId);

  const entity = await createExtractedEntity(actor.companyId, {
    projectId: project.id,
    projectFileId: file.id,
    entityType: "SCHEDULE_ROW",
    label: input.description,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    confidence: 100,
    extractionMethod: "MANUAL",
    sourceText: input.notes ?? null,
    sourceReference: `page ${pageNumber}, manually entered`,
    technicalDataJson: { itemCode: input.itemCode, pageNumber, manualPageRecovery: true },
    status: "NEEDS_REVIEW",
  });

  await recordTablePageResolutionDecision({
    companyId: actor.companyId,
    projectId: project.id,
    projectFileId: file.id,
    pageNumber,
    decision: "MANUAL_DATA_ADDED",
    decidedByUserId: actor.userId,
  });

  await createAuditLog(actor.companyId, {
    entityType: "ExtractedEntity",
    entityId: entity.id,
    action: "MANUAL_PAGE_ROW_ADDED",
    payload: { pageNumber, itemCode: input.itemCode },
  });

  return toExtractedEntityDTO(entity);
}

/** The human looked and confirmed there's genuinely no BOQ information on this page — not a parser failure, a real "nothing here." */
export async function confirmPageHasNoBoqData(actor: CurrentActor, projectId: string, projectFileId: string, pageNumber: number) {
  const { project, file } = await resolveOwnedFile(actor, projectId, projectFileId);
  const resolution = await recordTablePageResolutionDecision({
    companyId: actor.companyId,
    projectId: project.id,
    projectFileId: file.id,
    pageNumber,
    decision: "NO_BOQ_DATA_CONFIRMED",
    decidedByUserId: actor.userId,
  });
  await createAuditLog(actor.companyId, {
    entityType: "TablePageResolution",
    entityId: resolution.id,
    action: "PAGE_CONFIRMED_NO_BOQ_DATA",
    payload: { pageNumber },
  });
  return { decision: resolution.decision, decidedAt: resolution.decidedAt?.toISOString() ?? null };
}
