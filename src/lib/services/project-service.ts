import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError } from "@/lib/errors/app-error";
import { createProjectBOQ } from "@/lib/repositories/boq-repository";
import { getClient } from "@/lib/repositories/client-repository";
import { getEnabledIndustry } from "@/lib/repositories/industry-repository";
import { canCreateProject, recordProjectCreated } from "@/lib/entitlements/entitlement-service";
import {
  createProject,
  projectReferenceExists,
  type ProjectWriteInput,
} from "@/lib/repositories/project-repository";

export type CreateProjectWithBoqInput = ProjectWriteInput;

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
  await getEnabledIndustry(actor.companyId, input.industryEngineId);
  if (await projectReferenceExists(actor.companyId, input.reference)) {
    throw new ConflictError("PROJECT_REFERENCE_EXISTS", "A project with this reference already exists.");
  }
  const projectCheck = await canCreateProject(actor.companyId);
  if (!projectCheck.allowed) {
    throw new AppError("PROJECT_LIMIT_REACHED", projectCheck.reason ?? "Project limit reached.", 403);
  }

  const result = await prisma.$transaction(async (tx) => {
    const project = await createProject(actor.companyId, input, tx);
    const boq = await createProjectBOQ(actor.companyId, project.databaseId, undefined, tx);
    return { project, boq };
  });
  await recordProjectCreated(actor.companyId);
  return result;
}
