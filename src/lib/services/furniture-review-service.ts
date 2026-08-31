import { ExtractedEntityStatus, Prisma } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import type {
  FurnitureCandidateIssue,
  FurnitureDimensionName,
  FurnitureEdgeBanding,
  FurniturePartCandidate,
} from "@/lib/furniture/candidate-mapper";
import {
  FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  JOINERY_INDUSTRY_KEY,
} from "@/lib/furniture/types";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";

const FURNITURE_REVIEW_SCHEMA_VERSION = 1 as const;

type FurnitureCandidateEnvelope = {
  kind: typeof FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND;
  candidate: FurniturePartCandidate;
};

export type FurnitureCandidateCorrection = {
  room?: string;
  elevationReference?: string;
  assembly?: string;
  part?: string;
  quantity?: number | null;
  dimensions?: Partial<Record<FurnitureDimensionName, number | null>>;
  materialName?: string;
  finish?: string | null;
  edgeBanding?: FurnitureEdgeBanding;
  grainDirection?: string | null;
  hardwareNotes?: string[];
  notes?: string | null;
  reason: string;
};

export type FurnitureCandidateReviewView = {
  id: string;
  projectId: string;
  projectFileId: string;
  status: ExtractedEntityStatus;
  candidate: FurniturePartCandidate;
  correction: Prisma.JsonValue | null;
  confirmedAt: string | null;
};

function parseCandidate(value: Prisma.JsonValue | null): FurniturePartCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("FURNITURE_CANDIDATE_INVALID", "The furniture candidate data is invalid.", 409);
  }
  const envelope = value as Record<string, unknown>;
  if (envelope.kind !== FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND) {
    throw new AppError("FURNITURE_CANDIDATE_INVALID", "The furniture candidate data is invalid.", 409);
  }
  const candidate = envelope.candidate;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new AppError("FURNITURE_CANDIDATE_INVALID", "The furniture candidate data is invalid.", 409);
  }
  const record = candidate as Partial<FurniturePartCandidate>;
  if (
    typeof record.candidateId !== "string"
    || typeof record.part !== "string"
    || typeof record.room !== "string"
    || !record.dimensions
    || !record.evidence
    || !Array.isArray(record.issues)
  ) {
    throw new AppError("FURNITURE_CANDIDATE_INVALID", "The furniture candidate data is invalid.", 409);
  }
  return record as FurniturePartCandidate;
}

function toView(entity: {
  id: string;
  projectId: string;
  projectFileId: string;
  status: ExtractedEntityStatus;
  technicalDataJson: Prisma.JsonValue | null;
  correctionJson: Prisma.JsonValue | null;
  confirmedAt: Date | null;
}): FurnitureCandidateReviewView {
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
  if (project.industryEngine.key !== JOINERY_INDUSTRY_KEY) {
    throw new AppError(
      "FURNITURE_PROJECT_REQUIRED",
      "This operation is available only for Joinery projects.",
      400,
    );
  }
  return project;
}

function issue(
  code: FurnitureCandidateIssue["code"],
  severity: FurnitureCandidateIssue["severity"],
  message: string,
  field?: string,
): FurnitureCandidateIssue {
  return { code, severity, message, ...(field ? { field } : {}), evidenceReferences: [] };
}

/** Re-evaluates only deterministic completeness rules after a manual edit. */
function deriveIssues(candidate: FurniturePartCandidate): FurnitureCandidateIssue[] {
  const issues: FurnitureCandidateIssue[] = [];
  if (!candidate.room.trim()) issues.push(issue("MISSING_ROOM", "BLOCKING", "Room is required.", "room"));
  if (!candidate.elevationReference.trim()) {
    issues.push(issue("MISSING_ELEVATION_REFERENCE", "BLOCKING", "Elevation or reference is required.", "elevationReference"));
  }
  if (!candidate.assembly.trim()) issues.push(issue("MISSING_ASSEMBLY", "BLOCKING", "Unit or assembly is required.", "assembly"));
  if (!candidate.part.trim()) issues.push(issue("MISSING_PART", "BLOCKING", "Part is required.", "part"));
  if (candidate.quantity === null) issues.push(issue("MISSING_QUANTITY", "BLOCKING", "Quantity is required.", "quantity"));
  if (candidate.quantity !== null && (!Number.isFinite(candidate.quantity) || candidate.quantity <= 0)) {
    issues.push(issue("INVALID_QUANTITY", "BLOCKING", "Quantity must be greater than zero.", "quantity"));
  }
  for (const dimension of ["width", "height", "thickness"] as const) {
    const reading = candidate.dimensions[dimension];
    if (reading.valueMm === null) {
      issues.push(issue("MISSING_DIMENSION", "BLOCKING", `${dimension} is required.`, dimension));
    } else if (!Number.isFinite(reading.valueMm) || reading.valueMm <= 0) {
      issues.push(issue("INVALID_DIMENSION", "BLOCKING", `${dimension} must be greater than zero.`, dimension));
    }
    if (reading.hasConflict) {
      issues.push(issue("DIMENSION_CONFLICT", "BLOCKING", `${dimension} has conflicting source readings.`, dimension));
    }
  }
  if (!candidate.material.name.trim()) {
    issues.push(issue("MISSING_MATERIAL", "BLOCKING", "Material is required.", "material"));
  }
  if (!candidate.material.finish || /\b(tbd|to be confirmed|unknown)\b/i.test(candidate.material.finish)) {
    issues.push(issue("FINISH_REQUIRES_VERIFICATION", "REVIEW", "Finish or colour requires verification.", "finish"));
  }
  if (!candidate.grainDirection) {
    issues.push(issue("GRAIN_DIRECTION_MISSING", "REVIEW", "Grain direction requires verification.", "grainDirection"));
  }
  if (candidate.edgeBanding.mode === "UNRESOLVED") {
    issues.push(issue("MISSING_EDGE_SELECTION", "REVIEW", "Select the edges that receive edge banding.", "edgeBanding"));
  }
  if (candidate.edgeBanding.orientation === "UNRESOLVED") {
    issues.push(issue("EDGE_ORIENTATION_REQUIRES_VERIFICATION", "REVIEW", "Front-edge orientation requires verification.", "edgeBanding"));
  } else if (candidate.edgeBanding.mode === "FRONT" && candidate.edgeBanding.orientation === "ASSUMED") {
    issues.push(issue(
      "EDGE_ORIENTATION_REQUIRES_VERIFICATION",
      "REVIEW",
      "The editable selected-edge interpretation requires professional verification.",
      "edgeBanding",
    ));
  }
  return issues;
}

function applyCorrection(
  original: FurniturePartCandidate,
  correction: FurnitureCandidateCorrection,
): FurniturePartCandidate {
  const candidate: FurniturePartCandidate = {
    ...original,
    room: correction.room?.trim() ?? original.room,
    elevationReference: correction.elevationReference?.trim() ?? original.elevationReference,
    assembly: correction.assembly?.trim() ?? original.assembly,
    part: correction.part?.trim() ?? original.part,
    quantity: correction.quantity !== undefined ? correction.quantity : original.quantity,
    material: {
      ...original.material,
      name: correction.materialName?.trim() ?? original.material.name,
      finish: correction.finish !== undefined ? correction.finish : original.material.finish,
    },
    edgeBanding: correction.edgeBanding ?? original.edgeBanding,
    grainDirection: correction.grainDirection !== undefined ? correction.grainDirection : original.grainDirection,
    hardwareNotes: correction.hardwareNotes ?? original.hardwareNotes,
    notes: correction.notes !== undefined ? correction.notes : original.notes,
    dimensions: { ...original.dimensions },
  };

  for (const dimension of ["width", "height", "depth", "thickness"] as const) {
    const corrected = correction.dimensions?.[dimension];
    if (corrected !== undefined) {
      candidate.dimensions[dimension] = {
        ...original.dimensions[dimension],
        valueMm: corrected,
        hasConflict: false,
      };
    }
  }
  candidate.issues = deriveIssues(candidate);
  candidate.verificationStatus = candidate.issues.some((entry) => entry.severity === "BLOCKING")
    ? "BLOCKED"
    : candidate.issues.length > 0
      ? "NEEDS_REVIEW"
      : "READY_FOR_REVIEW";
  return candidate;
}

function envelope(candidate: FurniturePartCandidate): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({
    kind: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
    candidate,
  } satisfies FurnitureCandidateEnvelope)) as Prisma.InputJsonValue;
}

export async function listFurnitureCandidates(
  actor: CurrentActor,
  projectIdentifier: string,
): Promise<FurnitureCandidateReviewView[]> {
  requireCapability(actor, "verification:manage");
  const project = await requireFurnitureProject(actor.companyId, projectIdentifier);
  const rows = await prisma.extractedEntity.findMany({
    where: {
      companyId: actor.companyId,
      projectId: project.id,
      categoryKey: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toView);
}

export async function correctFurnitureCandidate(
  actor: CurrentActor,
  projectIdentifier: string,
  candidateId: string,
  correction: FurnitureCandidateCorrection,
): Promise<FurnitureCandidateReviewView> {
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
        categoryKey: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
      },
    });
    if (!current) throw new NotFoundError("Furniture candidate not found.");
    if (current.status === ExtractedEntityStatus.CONFIRMED || current.status === ExtractedEntityStatus.IMPORTED) {
      throw new AppError("FURNITURE_VALUES_LOCKED", "Approved furniture values are locked and cannot be changed.", 409);
    }
    if (current.status === ExtractedEntityStatus.REJECTED) {
      throw new AppError("ENTITY_ALREADY_FINALIZED", "This furniture candidate has already been rejected.", 409);
    }

    const original = parseCandidate(current.technicalDataJson);
    const corrected = applyCorrection(original, correction);
    const claimed = await tx.extractedEntity.updateMany({
      where: {
        id: current.id,
        companyId: actor.companyId,
        projectId: project.id,
        status: { in: [ExtractedEntityStatus.EXTRACTED, ExtractedEntityStatus.NEEDS_REVIEW, ExtractedEntityStatus.CORRECTED] },
      },
      data: {
        label: corrected.part,
        quantity: corrected.quantity,
        unit: corrected.quantity === null ? null : "pcs",
        technicalDataJson: envelope(corrected),
        // Preserve that a professional correction occurred so extraction
        // retries fail closed instead of replacing the corrected values.
        // Approval remains a separate explicit action below.
        status: ExtractedEntityStatus.CORRECTED,
        confirmedByUserId: null,
        confirmedAt: null,
        correctionJson: {
          schemaVersion: FURNITURE_REVIEW_SCHEMA_VERSION,
          previous: current.correctionJson ?? null,
          original,
          corrected,
          reason,
          correctedByUserId: actor.userId,
          correctedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError("ENTITY_REVIEW_CONFLICT", "This furniture candidate changed while it was being corrected.", 409);
    }
    await createAuditLog(actor.companyId, {
      entityType: "ExtractedEntity",
      entityId: current.id,
      action: "FURNITURE_CANDIDATE_CORRECTED",
      payload: { candidateId: corrected.candidateId, reason, issuesRemaining: corrected.issues.length },
    }, tx);
    return tx.extractedEntity.findFirstOrThrow({ where: { id: current.id, companyId: actor.companyId } });
  });
  return toView(updated);
}

export async function approveFurnitureCandidate(
  actor: CurrentActor,
  projectIdentifier: string,
  candidateId: string,
  acknowledgedIssueCodes: string[] = [],
): Promise<FurnitureCandidateReviewView> {
  requireCapability(actor, "verification:manage");
  const project = await requireFurnitureProject(actor.companyId, projectIdentifier);
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.extractedEntity.findFirst({
      where: {
        id: candidateId,
        companyId: actor.companyId,
        projectId: project.id,
        categoryKey: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
      },
    });
    if (!current) throw new NotFoundError("Furniture candidate not found.");
    if (current.status === ExtractedEntityStatus.CONFIRMED) return current;
    if (current.status === ExtractedEntityStatus.IMPORTED || current.status === ExtractedEntityStatus.REJECTED) {
      throw new AppError("ENTITY_ALREADY_FINALIZED", "This furniture candidate has already been finalized.", 409);
    }
    const candidate = parseCandidate(current.technicalDataJson);
    const currentIssues = deriveIssues(candidate);
    const blocking = currentIssues.filter((entry) => entry.severity === "BLOCKING");
    if (blocking.length > 0) {
      throw new AppError(
        "FURNITURE_VERIFICATION_BLOCKED",
        "Resolve missing or conflicting required values before approval.",
        409,
        { issues: blocking.map((entry) => entry.code) },
      );
    }
    const unacknowledged = currentIssues.filter(
      (entry) => entry.severity === "REVIEW" && !acknowledgedIssueCodes.includes(entry.code),
    );
    if (unacknowledged.length > 0) {
      throw new AppError(
        "FURNITURE_ISSUES_REQUIRE_ACKNOWLEDGEMENT",
        "Acknowledge the remaining verification items before approval.",
        409,
        { issues: unacknowledged.map((entry) => entry.code) },
      );
    }
    const approved: FurniturePartCandidate = {
      ...candidate,
      issues: currentIssues,
      verificationStatus: "APPROVED_LOCKED",
    };
    const now = new Date();
    const claimed = await tx.extractedEntity.updateMany({
      where: {
        id: current.id,
        companyId: actor.companyId,
        projectId: project.id,
        status: { in: [ExtractedEntityStatus.EXTRACTED, ExtractedEntityStatus.NEEDS_REVIEW, ExtractedEntityStatus.CORRECTED] },
      },
      data: {
        technicalDataJson: envelope(approved),
        status: ExtractedEntityStatus.CONFIRMED,
        confirmedByUserId: actor.userId,
        confirmedAt: now,
        correctionJson: {
          schemaVersion: FURNITURE_REVIEW_SCHEMA_VERSION,
          previous: current.correctionJson ?? null,
          approvedCandidate: approved,
          acknowledgedIssueCodes,
          approvedByUserId: actor.userId,
          approvedAt: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError("ENTITY_REVIEW_CONFLICT", "This furniture candidate changed while it was being approved.", 409);
    }
    await createAuditLog(actor.companyId, {
      entityType: "ExtractedEntity",
      entityId: current.id,
      action: "FURNITURE_DIMENSIONS_APPROVED_AND_LOCKED",
      payload: {
        candidateId: candidate.candidateId,
        acknowledgedIssueCodes,
      },
    }, tx);
    return tx.extractedEntity.findFirstOrThrow({ where: { id: current.id, companyId: actor.companyId } });
  });
  return toView(updated);
}
