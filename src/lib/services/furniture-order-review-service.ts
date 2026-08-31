import { ExtractedEntityStatus, Prisma } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import {
  furnitureOrderItemCandidateEnvelope,
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
  type FurnitureOrderItemCandidate,
  type FurnitureOrderItemIssue,
} from "@/lib/furniture/order-item-mapper";
import type { FurnitureOrderCategory } from "@/lib/furniture/calculations";
import { FURNITURE_JOINERY_INDUSTRY_KEY } from "@/lib/furniture/types";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";

const FURNITURE_ORDER_REVIEW_SCHEMA_VERSION = 1 as const;

export type FurnitureOrderItemCorrection = {
  description?: string;
  quantity?: number | null;
  unit?: string | null;
  category?: FurnitureOrderCategory;
  suppliedByOthers?: boolean;
  notes?: string | null;
  reason: string;
};

export type FurnitureOrderItemReviewView = {
  id: string;
  projectId: string;
  projectFileId: string;
  status: ExtractedEntityStatus;
  candidate: FurnitureOrderItemCandidate;
  correction: Prisma.JsonValue | null;
  confirmedAt: string | null;
};

function parseCandidate(value: Prisma.JsonValue | null): FurnitureOrderItemCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("FURNITURE_ORDER_ITEM_INVALID", "The furniture order item data is invalid.", 409);
  }
  const envelope = value as Record<string, unknown>;
  const candidate = envelope.candidate;
  if (
    envelope.kind !== FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND
    || !candidate
    || typeof candidate !== "object"
    || Array.isArray(candidate)
  ) {
    throw new AppError("FURNITURE_ORDER_ITEM_INVALID", "The furniture order item data is invalid.", 409);
  }
  const record = candidate as Partial<FurnitureOrderItemCandidate>;
  if (
    typeof record.id !== "string"
    || typeof record.description !== "string"
    || !record.evidence
    || !Array.isArray(record.issues)
  ) {
    throw new AppError("FURNITURE_ORDER_ITEM_INVALID", "The furniture order item data is invalid.", 409);
  }
  return record as FurnitureOrderItemCandidate;
}

function toView(entity: {
  id: string;
  projectId: string;
  projectFileId: string;
  status: ExtractedEntityStatus;
  technicalDataJson: Prisma.JsonValue | null;
  correctionJson: Prisma.JsonValue | null;
  confirmedAt: Date | null;
}): FurnitureOrderItemReviewView {
  return {
    id: entity.id,
    projectId: entity.projectId,
    projectFileId: entity.projectFileId,
    status: entity.status,
    candidate: parseCandidate(entity.technicalDataJson),
    correction: entity.correctionJson,
    confirmedAt: entity.confirmedAt?.toISOString() ?? null,
  };
}

async function requireFurnitureProject(companyId: string, projectIdentifier: string) {
  const project = await getProjectRecord(companyId, projectIdentifier);
  if (project.industryEngine.key !== FURNITURE_JOINERY_INDUSTRY_KEY) {
    throw new AppError(
      "FURNITURE_PROJECT_REQUIRED",
      "This operation is available only for Furniture, Joinery & Cabinetry projects.",
      400,
    );
  }
  return project;
}

function issue(
  code: FurnitureOrderItemIssue["code"],
  field: FurnitureOrderItemIssue["field"],
  severity: FurnitureOrderItemIssue["severity"],
  message: string,
): FurnitureOrderItemIssue {
  return { code, field, severity, message, evidenceReferences: [] };
}

function deriveIssues(candidate: FurnitureOrderItemCandidate): FurnitureOrderItemIssue[] {
  const issues: FurnitureOrderItemIssue[] = [];
  if (candidate.quantity === null) {
    issues.push(issue("MISSING_QUANTITY", "quantity", "BLOCKING", "A numeric order quantity is required."));
  } else if (!Number.isFinite(candidate.quantity) || candidate.quantity <= 0) {
    issues.push(issue("INVALID_QUANTITY", "quantity", "BLOCKING", "Order quantity must be greater than zero."));
  }
  if (!candidate.unit?.trim()) {
    issues.push(issue("MISSING_UNIT", "unit", "BLOCKING", "Enter the ordering unit before approval."));
  }
  if (candidate.category === "UNCLASSIFIED") {
    issues.push(issue("CATEGORY_REQUIRES_REVIEW", "category", "BLOCKING", "Select an explicit order category before approval."));
  }
  return issues;
}

function correctedCandidate(
  original: FurnitureOrderItemCandidate,
  correction: FurnitureOrderItemCorrection,
): FurnitureOrderItemCandidate {
  const suppliedByOthers = correction.suppliedByOthers ?? original.suppliedByOthers;
  const requestedCategory = correction.category
    ?? (correction.suppliedByOthers === false && original.category === "SUPPLIED_BY_OTHERS"
      ? "HARDWARE"
      : original.category);
  const category = suppliedByOthers ? "SUPPLIED_BY_OTHERS" : requestedCategory;
  const quantity = correction.quantity !== undefined ? correction.quantity : original.quantity;
  const candidate: FurnitureOrderItemCandidate = {
    ...original,
    description: correction.description?.trim() ?? original.description,
    quantity,
    quantityText: correction.quantity !== undefined
      ? (quantity === null ? "" : String(quantity))
      : original.quantityText,
    unit: correction.unit !== undefined ? correction.unit : original.unit,
    category,
    suppliedByOthers: category === "SUPPLIED_BY_OTHERS" ? true : suppliedByOthers,
    notes: correction.notes !== undefined ? correction.notes : original.notes,
    issues: [],
    verificationStatus: "CORRECTED",
  };
  candidate.issues = deriveIssues(candidate);
  candidate.verificationStatus = candidate.issues.some((entry) => entry.severity === "BLOCKING")
    ? "BLOCKED"
    : "CORRECTED";
  return candidate;
}

function envelope(candidate: FurnitureOrderItemCandidate): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(furnitureOrderItemCandidateEnvelope(candidate))) as Prisma.InputJsonValue;
}

export async function listFurnitureOrderItemCandidates(
  actor: CurrentActor,
  projectIdentifier: string,
): Promise<FurnitureOrderItemReviewView[]> {
  requireCapability(actor, "verification:manage");
  const project = await requireFurnitureProject(actor.companyId, projectIdentifier);
  const rows = await prisma.extractedEntity.findMany({
    where: {
      companyId: actor.companyId,
      projectId: project.id,
      categoryKey: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toView);
}

export async function correctFurnitureOrderItemCandidate(
  actor: CurrentActor,
  projectIdentifier: string,
  candidateId: string,
  correction: FurnitureOrderItemCorrection,
): Promise<FurnitureOrderItemReviewView> {
  requireCapability(actor, "verification:manage");
  const project = await requireFurnitureProject(actor.companyId, projectIdentifier);
  const reason = correction.reason.trim();
  if (!reason) throw new AppError("CORRECTION_REASON_REQUIRED", "A correction reason is required.", 400);
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.extractedEntity.findFirst({
      where: {
        id: candidateId,
        companyId: actor.companyId,
        projectId: project.id,
        categoryKey: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
      },
    });
    if (!current) throw new NotFoundError("Furniture order item not found.");
    if (current.status === ExtractedEntityStatus.CONFIRMED || current.status === ExtractedEntityStatus.IMPORTED) {
      throw new AppError("FURNITURE_VALUES_LOCKED", "Approved furniture order values are locked.", 409);
    }
    if (current.status === ExtractedEntityStatus.REJECTED) {
      throw new AppError("ENTITY_ALREADY_FINALIZED", "This furniture order item has already been rejected.", 409);
    }
    const original = parseCandidate(current.technicalDataJson);
    const corrected = correctedCandidate(original, correction);
    const now = new Date();
    const claimed = await tx.extractedEntity.updateMany({
      where: {
        id: current.id,
        companyId: actor.companyId,
        projectId: project.id,
        status: {
          in: [
            ExtractedEntityStatus.EXTRACTED,
            ExtractedEntityStatus.NEEDS_REVIEW,
            ExtractedEntityStatus.CORRECTED,
          ],
        },
      },
      data: {
        label: corrected.description,
        quantity: corrected.quantity,
        unit: corrected.unit,
        technicalDataJson: envelope(corrected),
        status: ExtractedEntityStatus.CORRECTED,
        confirmedByUserId: null,
        confirmedAt: null,
        correctionJson: {
          schemaVersion: FURNITURE_ORDER_REVIEW_SCHEMA_VERSION,
          previous: current.correctionJson ?? null,
          original,
          corrected,
          reason,
          correctedByUserId: actor.userId,
          correctedAt: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError("ENTITY_REVIEW_CONFLICT", "This furniture order item changed while it was being corrected.", 409);
    }
    await createAuditLog(actor.companyId, {
      entityType: "ExtractedEntity",
      entityId: current.id,
      action: "FURNITURE_ORDER_ITEM_CORRECTED",
      payload: { candidateId: corrected.id, reason, issuesRemaining: corrected.issues.length },
    }, tx);
    return tx.extractedEntity.findFirstOrThrow({ where: { id: current.id, companyId: actor.companyId } });
  });
  return toView(updated);
}

export async function approveFurnitureOrderItemCandidate(
  actor: CurrentActor,
  projectIdentifier: string,
  candidateId: string,
  acknowledgedIssueCodes: string[] = [],
): Promise<FurnitureOrderItemReviewView> {
  requireCapability(actor, "verification:manage");
  const project = await requireFurnitureProject(actor.companyId, projectIdentifier);
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.extractedEntity.findFirst({
      where: {
        id: candidateId,
        companyId: actor.companyId,
        projectId: project.id,
        categoryKey: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
      },
    });
    if (!current) throw new NotFoundError("Furniture order item not found.");
    if (current.status === ExtractedEntityStatus.CONFIRMED) return current;
    if (current.status === ExtractedEntityStatus.IMPORTED || current.status === ExtractedEntityStatus.REJECTED) {
      throw new AppError("ENTITY_ALREADY_FINALIZED", "This furniture order item has already been finalized.", 409);
    }
    const candidate = parseCandidate(current.technicalDataJson);
    const issues = deriveIssues(candidate);
    const blocking = issues.filter((entry) => entry.severity === "BLOCKING");
    if (blocking.length > 0) {
      throw new AppError(
        "FURNITURE_ORDER_VERIFICATION_BLOCKED",
        "Resolve missing or invalid quantity, unit, and category values before approval.",
        409,
        { issues: blocking.map((entry) => entry.code) },
      );
    }
    const unacknowledged = issues.filter(
      (entry) => entry.severity === "REVIEW" && !acknowledgedIssueCodes.includes(entry.code),
    );
    if (unacknowledged.length > 0) {
      throw new AppError(
        "FURNITURE_ISSUES_REQUIRE_ACKNOWLEDGEMENT",
        "Acknowledge the remaining order-item verification notes before approval.",
        409,
        { issues: unacknowledged.map((entry) => entry.code) },
      );
    }
    const approved: FurnitureOrderItemCandidate = {
      ...candidate,
      issues,
      verificationStatus: "APPROVED_LOCKED",
    };
    const now = new Date();
    const claimed = await tx.extractedEntity.updateMany({
      where: {
        id: current.id,
        companyId: actor.companyId,
        projectId: project.id,
        status: {
          in: [
            ExtractedEntityStatus.EXTRACTED,
            ExtractedEntityStatus.NEEDS_REVIEW,
            ExtractedEntityStatus.CORRECTED,
          ],
        },
      },
      data: {
        technicalDataJson: envelope(approved),
        status: ExtractedEntityStatus.CONFIRMED,
        confirmedByUserId: actor.userId,
        confirmedAt: now,
        correctionJson: {
          schemaVersion: FURNITURE_ORDER_REVIEW_SCHEMA_VERSION,
          previous: current.correctionJson ?? null,
          approvedCandidate: approved,
          acknowledgedIssueCodes,
          approvedByUserId: actor.userId,
          approvedAt: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError("ENTITY_REVIEW_CONFLICT", "This furniture order item changed while it was being approved.", 409);
    }
    await createAuditLog(actor.companyId, {
      entityType: "ExtractedEntity",
      entityId: current.id,
      action: "FURNITURE_ORDER_ITEM_APPROVED_AND_LOCKED",
      payload: { candidateId: approved.id, acknowledgedIssueCodes },
    }, tx);
    return tx.extractedEntity.findFirstOrThrow({ where: { id: current.id, companyId: actor.companyId } });
  });
  return toView(updated);
}
