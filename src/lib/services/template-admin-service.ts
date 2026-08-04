import { prisma } from "@/lib/db/prisma";
import { NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";

/**
 * TEMPLATE-LINK-1 — read surface for the admin Template Centre. Deliberately
 * cross-tenant (every list/get here spans all companies) because this is the
 * platform owner's inspection surface, mirroring master-catalogue-admin-service.ts.
 * Mutations (draft/publish/retire) stay in template-governance-service.ts;
 * this file only ever reads.
 */

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("The Template Centre is restricted to the platform owner.");
  }
}

export async function listBoqTemplatesForAdmin(actor: PlatformActor) {
  requireOwner(actor);
  const templates = await prisma.documentTemplate.findMany({
    include: {
      company: { select: { id: true, legalName: true, tradeName: true } },
      versions: { orderBy: { versionNumber: "desc" } },
      _count: { select: { generatedDocuments: true } },
    },
    orderBy: [{ companyId: "asc" }, { name: "asc" }],
  });
  return templates.map((t) => ({
    id: t.id,
    companyId: t.companyId,
    companyName: t.company.tradeName || t.company.legalName,
    name: t.name,
    code: t.code,
    type: t.type,
    isActive: t.isActive,
    isDefault: t.isDefault,
    versionCount: t.versions.length,
    publishedVersion: t.versions.find((v) => v.status === "PUBLISHED") ?? null,
    latestVersion: t.versions[0] ?? null,
    usageCount: t._count.generatedDocuments,
  }));
}

export async function getBoqTemplateForAdmin(actor: PlatformActor, templateId: string) {
  requireOwner(actor);
  const template = await prisma.documentTemplate.findUnique({
    where: { id: templateId },
    include: {
      company: { select: { id: true, legalName: true, tradeName: true } },
      versions: { orderBy: { versionNumber: "desc" }, include: { createdByUser: { select: { fullName: true, email: true } } } },
    },
  });
  if (!template) throw new NotFoundError("Document template not found.");
  const usageCount = await prisma.generatedDocument.count({ where: { templateId } });
  return { ...template, usageCount };
}

export async function listTechnicalReportTemplatesForAdmin(actor: PlatformActor) {
  requireOwner(actor);
  const templates = await prisma.technicalReportTemplate.findMany({
    include: {
      company: { select: { id: true, legalName: true, tradeName: true } },
      versions: { orderBy: { versionNumber: "desc" } },
      _count: { select: { generatedReports: true } },
    },
    orderBy: [{ companyId: "asc" }, { name: "asc" }],
  });
  return templates.map((t) => ({
    id: t.id,
    companyId: t.companyId,
    companyName: t.company.tradeName || t.company.legalName,
    name: t.name,
    code: t.code,
    disciplineTag: t.disciplineTag,
    isActive: t.isActive,
    isDefault: t.isDefault,
    versionCount: t.versions.length,
    publishedVersion: t.versions.find((v) => v.status === "PUBLISHED") ?? null,
    latestVersion: t.versions[0] ?? null,
    usageCount: t._count.generatedReports,
  }));
}

export async function getTechnicalReportTemplateForAdmin(actor: PlatformActor, templateId: string) {
  requireOwner(actor);
  const template = await prisma.technicalReportTemplate.findUnique({
    where: { id: templateId },
    include: {
      company: { select: { id: true, legalName: true, tradeName: true } },
      versions: { orderBy: { versionNumber: "desc" }, include: { createdByUser: { select: { fullName: true, email: true } } } },
    },
  });
  if (!template) throw new NotFoundError("Technical report template not found.");
  const usageCount = await prisma.generatedTechnicalReport.count({ where: { templateId } });
  return { ...template, usageCount };
}

export async function listEmailTemplatesForAdmin(actor: PlatformActor) {
  requireOwner(actor);
  const templates = await prisma.emailTemplate.findMany({
    include: {
      company: { select: { id: true, legalName: true, tradeName: true } },
      versions: { orderBy: { versionNumber: "desc" } },
      _count: { select: { emailDispatches: true } },
    },
    orderBy: [{ companyId: "asc" }, { name: "asc" }],
  });
  return templates.map((t) => ({
    id: t.id,
    companyId: t.companyId,
    companyName: t.company.tradeName || t.company.legalName,
    name: t.name,
    code: t.code,
    category: t.category,
    isActive: t.isActive,
    isDefault: t.isDefault,
    versionCount: t.versions.length,
    publishedVersion: t.versions.find((v) => v.status === "PUBLISHED") ?? null,
    latestVersion: t.versions[0] ?? null,
    usageCount: t._count.emailDispatches,
  }));
}

export async function getEmailTemplateForAdmin(actor: PlatformActor, templateId: string) {
  requireOwner(actor);
  const template = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
    include: {
      company: { select: { id: true, legalName: true, tradeName: true } },
      versions: { orderBy: { versionNumber: "desc" }, include: { createdByUser: { select: { fullName: true, email: true } } } },
    },
  });
  if (!template) throw new NotFoundError("Email template not found.");
  const usageCount = await prisma.emailDispatch.count({ where: { emailTemplateId: templateId } });
  return { ...template, usageCount };
}
