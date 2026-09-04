import { BOQStatus, PlanType, ProjectStatus } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { getEffectiveEntitlements } from "@/lib/entitlements/effective-entitlement-service";
import { ConflictError } from "@/lib/errors/app-error";
import {
  archiveProject,
  getProjectRecord,
} from "@/lib/repositories/project-repository";

/**
 * Releases an unused project slot without allowing completed BOQ value to be
 * recycled through a limited plan. The project is retained as archived audit
 * evidence instead of being hard-deleted.
 */
export async function deleteUnusedProject(
  actor: CurrentActor,
  identifier: string,
) {
  requireCapability(actor, "projects:archive");

  const project = await getProjectRecord(actor.companyId, identifier);
  const [boqItemCount, progressedBoqCount, entitlements] = await Promise.all([
    prisma.bOQItem.count({
      where: {
        companyId: actor.companyId,
        section: { boq: { projectId: project.id } },
      },
    }),
    prisma.bOQ.count({
      where: {
        companyId: actor.companyId,
        projectId: project.id,
        OR: [
          { isLocked: true },
          { verifiedAt: { not: null } },
          { status: { not: BOQStatus.DRAFT } },
        ],
      },
    }),
    getEffectiveEntitlements(actor),
  ]);

  if (
    boqItemCount > 0
    || progressedBoqCount > 0
    || project.status !== ProjectStatus.DRAFT
  ) {
    throw new ConflictError(
      "PROJECT_BOQ_ALREADY_GENERATED",
      "This project cannot be deleted because its BOQ has already been generated or progressed.",
    );
  }

  // Trial/free customers may correct one mistaken empty project, but cannot
  // repeatedly recycle the single-project allowance.
  if (
    entitlements.maxProjects !== null
    && (entitlements.isTrial || entitlements.planType === PlanType.FREE)
  ) {
    const archivedProjectCount = await prisma.project.count({
      where: { companyId: actor.companyId, status: ProjectStatus.ARCHIVED },
    });
    if (archivedProjectCount > 0) {
      throw new ConflictError(
        "EMPTY_PROJECT_REPLACEMENT_LIMIT_REACHED",
        "The free empty-project replacement has already been used. Upgrade to create another project.",
      );
    }
  }

  return archiveProject(actor.companyId, project.id);
}
