import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { NotFoundError } from "@/lib/errors/app-error";

export type CreateInspectionInput = {
  projectId: string;
  reportType: string;
  reference: string;
  title: string;
  description?: string;
  disciplineId?: string;
};

export async function createInspection(actor: CurrentActor, input: CreateInspectionInput) {
  requireCapability(actor, "verification:manage");
  const row = await prisma.inspection.create({
    data: {
      companyId: actor.companyId,
      projectId: input.projectId,
      disciplineId: input.disciplineId,
      reportType: input.reportType,
      reference: input.reference,
      title: input.title,
      description: input.description,
      preparedByUserId: actor.userId,
      status: "DRAFT",
    },
  });
  return row;
}

export async function listInspectionsForProject(actor: CurrentActor, projectId: string) {
  return prisma.inspection.findMany({ where: { companyId: actor.companyId, projectId }, orderBy: { createdAt: "desc" } });
}

export async function getInspectionRecord(actor: CurrentActor, inspectionId: string) {
  const row = await prisma.inspection.findFirst({ where: { id: inspectionId, companyId: actor.companyId }, include: { findings: true } });
  if (!row) throw new NotFoundError("Inspection not found.");
  return row;
}

export async function recordInspectionResponse(actor: CurrentActor, inspectionId: string, sectionKey: string, fieldKey: string, valueJson: unknown, unit?: string) {
  requireCapability(actor, "verification:manage");
  await getInspectionRecord(actor, inspectionId);
  return prisma.inspectionResponse.upsert({
    where: { inspectionId_sectionKey_fieldKey: { inspectionId, sectionKey, fieldKey } },
    update: { valueJson: valueJson as object, unit, enteredByUserId: actor.userId },
    create: { companyId: actor.companyId, inspectionId, sectionKey, fieldKey, valueJson: valueJson as object, unit, sourceType: "MANUAL", enteredByUserId: actor.userId, status: "EXTRACTED" },
  });
}
