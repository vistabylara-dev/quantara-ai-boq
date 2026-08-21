import { BOQStatus, PlatformRole, Prisma } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { prisma } from "@/lib/db/prisma";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getBOQ } from "@/lib/repositories/boq-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const project = await getProjectRecord(actor.companyId, projectId);

    const createdId = await prisma.$transaction(async (tx) => {
      const latest = await tx.bOQ.findFirst({
        where: {
          companyId: actor.companyId,
          projectId: project.id,
        },
        orderBy: { revisionNumber: "desc" },
        select: {
          revisionNumber: true,
          taxRate: true,
          discountPercentage: true,
        },
      });

      const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
      const created = await tx.bOQ.create({
        data: {
          companyId: actor.companyId,
          projectId: project.id,
          title: "Admin Sample BOQ",
          revisionNumber,
          status: BOQStatus.DRAFT,
          isLocked: false,
          approvedByName: null,
          discountPercentage: latest?.discountPercentage ?? new Prisma.Decimal(0),
          taxRate: latest?.taxRate ?? project.taxRate,
          sections: {
            create: [{
              companyId: actor.companyId,
              code: "ADMIN-SAMPLE",
              title: "Admin Sample",
              description: "Admin-only isolated one-item acceptance BOQ. Existing project BOQ items are not copied or changed.",
              sortOrder: 1,
            }],
          },
        },
      });

      await tx.project.update({
        where: { id: project.id, companyId: actor.companyId },
        data: { currentRevisionNumber: revisionNumber },
      });

      await createAuditLog(actor.companyId, {
        entityType: "BOQ",
        entityId: created.id,
        action: "ADMIN_SAMPLE_BOQ_CREATED",
        actorName: actor.fullName,
        payload: {
          projectId: project.id,
          revisionNumber,
          sourceRevisionNumber: latest?.revisionNumber ?? null,
          existingItemsCopied: false,
        },
      }, tx);

      return created.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return apiSuccess(await getBOQ(actor.companyId, createdId), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
