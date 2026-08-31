import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import {
  FURNITURE_JOINERY_INDUSTRY_KEY,
  FurnitureDiscipline,
  isFurnitureDiscipline,
} from "@/lib/furniture/types";

type DisciplineDatabase = typeof prisma | Prisma.TransactionClient;

export const FURNITURE_DISCIPLINE_SELECTED_ACTION = "FURNITURE_DISCIPLINE_SELECTED" as const;
const DISCIPLINE_EVENT_SCHEMA_VERSION = 1 as const;

type FurnitureDisciplineAuditPayload = {
  schemaVersion: typeof DISCIPLINE_EVENT_SCHEMA_VERSION;
  industryKey: typeof FURNITURE_JOINERY_INDUSTRY_KEY;
  discipline: FurnitureDiscipline;
};

function parseDisciplinePayload(payload: Prisma.JsonValue): FurnitureDiscipline {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AppError(
      "FURNITURE_DISCIPLINE_INVALID",
      "The furniture project discipline record is invalid.",
      409,
    );
  }

  const candidate = payload as Record<string, unknown>;
  if (
    candidate.schemaVersion !== DISCIPLINE_EVENT_SCHEMA_VERSION
    || candidate.industryKey !== FURNITURE_JOINERY_INDUSTRY_KEY
    || !isFurnitureDiscipline(candidate.discipline)
  ) {
    throw new AppError(
      "FURNITURE_DISCIPLINE_INVALID",
      "The furniture project discipline record is invalid.",
      409,
    );
  }
  return candidate.discipline;
}

async function assertFurnitureProject(
  database: DisciplineDatabase,
  companyId: string,
  projectId: string,
) {
  const project = await database.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true, industryEngine: { select: { key: true } } },
  });
  if (!project) throw new NotFoundError("Project not found.");
  if (project.industryEngine.key !== FURNITURE_JOINERY_INDUSTRY_KEY) {
    throw new AppError(
      "FURNITURE_PROJECT_REQUIRED",
      "This operation is available only for Furniture, Joinery & Cabinetry projects.",
      400,
    );
  }
  return project;
}

/**
 * Records the immutable project discipline during the project-creation
 * transaction. Repeating the same selection is a no-op; a different second
 * selection is rejected. The project/company guard prevents a caller from
 * attaching an event to another tenant's project.
 */
export async function recordInitialFurnitureProjectDiscipline(
  companyId: string,
  projectId: string,
  discipline: FurnitureDiscipline,
  database: DisciplineDatabase,
  actorName: string,
): Promise<void> {
  await assertFurnitureProject(database, companyId, projectId);
  const existing = await database.auditLog.findMany({
    where: {
      companyId,
      entityType: "Project",
      entityId: projectId,
      action: FURNITURE_DISCIPLINE_SELECTED_ACTION,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 2,
  });

  if (existing.length > 1) {
    throw new AppError(
      "FURNITURE_DISCIPLINE_INTEGRITY_ERROR",
      "The furniture project has multiple discipline records.",
      409,
    );
  }
  if (existing[0]) {
    const recordedDiscipline = parseDisciplinePayload(existing[0].payloadJson);
    if (recordedDiscipline !== discipline) {
      throw new ConflictError(
        "FURNITURE_DISCIPLINE_IMMUTABLE",
        "The furniture project discipline is immutable after project creation.",
      );
    }
    return;
  }

  const payload: FurnitureDisciplineAuditPayload = {
    schemaVersion: DISCIPLINE_EVENT_SCHEMA_VERSION,
    industryKey: FURNITURE_JOINERY_INDUSTRY_KEY,
    discipline,
  };
  await createAuditLog(companyId, {
    entityType: "Project",
    entityId: projectId,
    action: FURNITURE_DISCIPLINE_SELECTED_ACTION,
    payload,
    actorName,
  }, database);
}

/** Reads exactly one tenant-owned immutable discipline record. */
export async function getFurnitureProjectDiscipline(
  companyId: string,
  projectId: string,
  database: DisciplineDatabase = prisma,
): Promise<FurnitureDiscipline> {
  await assertFurnitureProject(database, companyId, projectId);
  const events = await database.auditLog.findMany({
    where: {
      companyId,
      entityType: "Project",
      entityId: projectId,
      action: FURNITURE_DISCIPLINE_SELECTED_ACTION,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 2,
  });
  if (events.length === 0) {
    throw new AppError(
      "FURNITURE_DISCIPLINE_MISSING",
      "The furniture project does not have a recorded discipline.",
      409,
    );
  }
  if (events.length > 1) {
    throw new AppError(
      "FURNITURE_DISCIPLINE_INTEGRITY_ERROR",
      "The furniture project has multiple discipline records.",
      409,
    );
  }
  return parseDisciplinePayload(events[0].payloadJson);
}
