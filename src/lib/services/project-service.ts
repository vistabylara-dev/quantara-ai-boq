import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError } from "@/lib/errors/app-error";
import { createProjectBOQ } from "@/lib/repositories/boq-repository";
import { getClient } from "@/lib/repositories/client-repository";
import { getEnabledIndustry } from "@/lib/repositories/industry-repository";
import { recordProjectCreated } from "@/lib/entitlements/entitlement-service";
import { canCreateProjectEffective } from "@/lib/entitlements/effective-entitlement-service";
import {
  createProject,
  projectReferenceExists,
  type ProjectWriteInput,
} from "@/lib/repositories/project-repository";
import {
  FURNITURE_JOINERY_INDUSTRY_KEY,
  FurnitureDiscipline,
  isFurnitureDiscipline,
} from "@/lib/furniture/types";
import { recordInitialFurnitureProjectDiscipline } from "@/lib/furniture/project-discipline";

export type CreateProjectWithBoqInput = ProjectWriteInput & {
  discipline?: FurnitureDiscipline;
};

function resolveFurnitureDiscipline(
  industryKey: string,
  discipline: unknown,
): FurnitureDiscipline | null {
  if (industryKey !== FURNITURE_JOINERY_INDUSTRY_KEY) {
    if (discipline !== undefined) {
      throw new AppError(
        "FURNITURE_DISCIPLINE_NOT_APPLICABLE",
        "A furniture discipline can only be selected for Furniture, Joinery & Cabinetry projects.",
        400,
        { discipline: ["Remove the furniture discipline for this industry."] },
      );
    }
    return null;
  }
  if (!isFurnitureDiscipline(discipline)) {
    throw new AppError(
      "FURNITURE_DISCIPLINE_REQUIRED",
      "Select Furniture or Joinery & Cabinetry before creating this project.",
      400,
      { discipline: ["Select Furniture or Joinery & Cabinetry."] },
    );
  }
  return discipline;
}

/**
 * Creates a project and its default R01 BOQ (with industry-specific default
 * sections) as a single atomic operation. If BOQ or section creation fails,
 * the project creation rolls back too — no orphan projects, no orphan BOQs.
 */
export async function createProjectWithDefaultBoq(actor: CurrentActor, input: CreateProjectWithBoqInput) {
  requireCapability(actor, "projects:create");

  if (!input.clientId) {
    throw new AppError(
      "CLIENT_REQUIRED",
      "Select an existing client or create one before creating a project.",
      400,
      { clientId: ["A client is required."] },
    );
  }

  // Validate company boundaries before opening the write transaction.
  await getClient(actor.companyId, input.clientId);
  const industry = await getEnabledIndustry(actor.companyId, input.industryEngineId);
  const furnitureDiscipline = resolveFurnitureDiscipline(industry.key, input.discipline);
  if (await projectReferenceExists(actor.companyId, input.reference)) {
    throw new ConflictError("PROJECT_REFERENCE_EXISTS", "A project with this reference already exists.");
  }
  const projectCheck = await canCreateProjectEffective(actor);
  if (!projectCheck.allowed) {
    throw new AppError("PROJECT_LIMIT_REACHED", projectCheck.reason ?? "Project limit reached.", 403);
  }

  const result = await prisma.$transaction(async (tx) => {
    const project = await createProject(actor.companyId, input, tx);
    if (furnitureDiscipline) {
      await recordInitialFurnitureProjectDiscipline(
        actor.companyId,
        project.databaseId,
        furnitureDiscipline,
        tx,
        actor.fullName,
      );
    }
    const boq = await createProjectBOQ(actor.companyId, project.databaseId, undefined, tx);
    return { project, boq };
  });
  await recordProjectCreated(actor.companyId);
  return result;
}
