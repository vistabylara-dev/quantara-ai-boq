import { TemplateVersionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";

/**
 * TEMPLATE-LINK-1 — the shared DRAFT->REVIEW->APPROVED->PUBLISHED->RETIRED
 * lifecycle for all three template-version tables (DocumentTemplateVersion,
 * TechnicalReportTemplateVersion, EmailTemplateVersion), mirroring the exact
 * transition rules master-item-governance-service.ts already established for
 * MasterItemVersion. Publishing a version retires the previously-published
 * one instead of overwriting it — every already-generated document, sent
 * email, and locked BOQ keeps pointing at the version it actually used.
 *
 * Platform-owner only, matching every other governance surface in this repo.
 * A company's own template rows are exactly the same as any other company's
 * from this service's point of view — cross-tenant is fine here because this
 * is explicitly the owner's administrative surface, not a customer one.
 */

const ALLOWED_TRANSITIONS: Record<TemplateVersionStatus, TemplateVersionStatus[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["PUBLISHED", "REVIEW"],
  PUBLISHED: ["RETIRED"],
  RETIRED: [],
};

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Template governance is restricted to the platform owner.");
  }
}

function assertTransition(current: TemplateVersionStatus, next: TemplateVersionStatus): void {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new AppError("INVALID_VERSION_TRANSITION", `Cannot move a ${current} version to ${next}.`, 409);
  }
}

// ---------------------------------------------------------------------------
// BOQ document templates
// ---------------------------------------------------------------------------

export async function createDocumentTemplateDraftVersion(owner: PlatformActor, documentTemplateId: string, input: { styleConfigJson: unknown; contentConfigJson: unknown; changeSummary?: string }) {
  requireOwner(owner);
  const template = await prisma.documentTemplate.findUnique({ where: { id: documentTemplateId } });
  if (!template) throw new NotFoundError("Document template not found.");
  const latest = await prisma.documentTemplateVersion.findFirst({ where: { documentTemplateId }, orderBy: { versionNumber: "desc" } });

  const created = await prisma.documentTemplateVersion.create({
    data: {
      documentTemplateId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      status: "DRAFT",
      styleConfigJson: input.styleConfigJson as never,
      contentConfigJson: input.contentConfigJson as never,
      changeSummary: input.changeSummary ?? "",
      createdByUserId: owner.userId,
    },
  });

  await recordPlatformActionAudit({ actorUserId: owner.userId, actorPlatformRole: owner.platformRole, action: "TEMPLATE_VERSION_CREATED", targetType: "DocumentTemplateVersion", targetId: created.id, metadata: { documentTemplateId, versionNumber: created.versionNumber } });
  return created;
}

export async function transitionDocumentTemplateVersion(owner: PlatformActor, versionId: string, nextStatus: TemplateVersionStatus) {
  requireOwner(owner);
  const version = await prisma.documentTemplateVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new NotFoundError("Document template version not found.");
  assertTransition(version.status, nextStatus);

  const updated = await prisma.$transaction(async (tx) => {
    if (nextStatus === "PUBLISHED") {
      const currentlyPublished = await tx.documentTemplateVersion.findFirst({ where: { documentTemplateId: version.documentTemplateId, status: "PUBLISHED" } });
      if (currentlyPublished) await tx.documentTemplateVersion.update({ where: { id: currentlyPublished.id }, data: { status: "RETIRED", retiredDate: new Date() } });
      return tx.documentTemplateVersion.update({ where: { id: versionId }, data: { status: "PUBLISHED", effectiveDate: new Date() } });
    }
    if (nextStatus === "RETIRED") return tx.documentTemplateVersion.update({ where: { id: versionId }, data: { status: "RETIRED", retiredDate: new Date() } });
    return tx.documentTemplateVersion.update({ where: { id: versionId }, data: { status: nextStatus } });
  });

  await recordPlatformActionAudit({ actorUserId: owner.userId, actorPlatformRole: owner.platformRole, action: `TEMPLATE_VERSION_${nextStatus}`, targetType: "DocumentTemplateVersion", targetId: versionId, metadata: { documentTemplateId: version.documentTemplateId } });
  return updated;
}

export async function listDocumentTemplateVersions(owner: PlatformActor, documentTemplateId: string) {
  requireOwner(owner);
  return prisma.documentTemplateVersion.findMany({ where: { documentTemplateId }, orderBy: { versionNumber: "desc" } });
}

// ---------------------------------------------------------------------------
// Technical report templates
// ---------------------------------------------------------------------------

export async function createTechnicalReportTemplateDraftVersion(owner: PlatformActor, technicalReportTemplateId: string, input: { sectionsJson: unknown; changeSummary?: string }) {
  requireOwner(owner);
  const template = await prisma.technicalReportTemplate.findUnique({ where: { id: technicalReportTemplateId } });
  if (!template) throw new NotFoundError("Technical report template not found.");
  const latest = await prisma.technicalReportTemplateVersion.findFirst({ where: { technicalReportTemplateId }, orderBy: { versionNumber: "desc" } });

  const created = await prisma.technicalReportTemplateVersion.create({
    data: {
      technicalReportTemplateId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      status: "DRAFT",
      sectionsJson: input.sectionsJson as never,
      changeSummary: input.changeSummary ?? "",
      createdByUserId: owner.userId,
    },
  });

  await recordPlatformActionAudit({ actorUserId: owner.userId, actorPlatformRole: owner.platformRole, action: "TEMPLATE_VERSION_CREATED", targetType: "TechnicalReportTemplateVersion", targetId: created.id, metadata: { technicalReportTemplateId, versionNumber: created.versionNumber } });
  return created;
}

export async function transitionTechnicalReportTemplateVersion(owner: PlatformActor, versionId: string, nextStatus: TemplateVersionStatus) {
  requireOwner(owner);
  const version = await prisma.technicalReportTemplateVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new NotFoundError("Technical report template version not found.");
  assertTransition(version.status, nextStatus);

  const updated = await prisma.$transaction(async (tx) => {
    if (nextStatus === "PUBLISHED") {
      const currentlyPublished = await tx.technicalReportTemplateVersion.findFirst({ where: { technicalReportTemplateId: version.technicalReportTemplateId, status: "PUBLISHED" } });
      if (currentlyPublished) await tx.technicalReportTemplateVersion.update({ where: { id: currentlyPublished.id }, data: { status: "RETIRED", retiredDate: new Date() } });
      return tx.technicalReportTemplateVersion.update({ where: { id: versionId }, data: { status: "PUBLISHED", effectiveDate: new Date() } });
    }
    if (nextStatus === "RETIRED") return tx.technicalReportTemplateVersion.update({ where: { id: versionId }, data: { status: "RETIRED", retiredDate: new Date() } });
    return tx.technicalReportTemplateVersion.update({ where: { id: versionId }, data: { status: nextStatus } });
  });

  await recordPlatformActionAudit({ actorUserId: owner.userId, actorPlatformRole: owner.platformRole, action: `TEMPLATE_VERSION_${nextStatus}`, targetType: "TechnicalReportTemplateVersion", targetId: versionId, metadata: { technicalReportTemplateId: version.technicalReportTemplateId } });
  return updated;
}

export async function listTechnicalReportTemplateVersions(owner: PlatformActor, technicalReportTemplateId: string) {
  requireOwner(owner);
  return prisma.technicalReportTemplateVersion.findMany({ where: { technicalReportTemplateId }, orderBy: { versionNumber: "desc" } });
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

export async function createEmailTemplateDraftVersion(owner: PlatformActor, emailTemplateId: string, input: { subject: string; bodyHtml: string; bodyText: string; changeSummary?: string }) {
  requireOwner(owner);
  const template = await prisma.emailTemplate.findUnique({ where: { id: emailTemplateId } });
  if (!template) throw new NotFoundError("Email template not found.");
  const latest = await prisma.emailTemplateVersion.findFirst({ where: { emailTemplateId }, orderBy: { versionNumber: "desc" } });

  const created = await prisma.emailTemplateVersion.create({
    data: {
      emailTemplateId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      status: "DRAFT",
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      changeSummary: input.changeSummary ?? "",
      createdByUserId: owner.userId,
    },
  });

  await recordPlatformActionAudit({ actorUserId: owner.userId, actorPlatformRole: owner.platformRole, action: "TEMPLATE_VERSION_CREATED", targetType: "EmailTemplateVersion", targetId: created.id, metadata: { emailTemplateId, versionNumber: created.versionNumber } });
  return created;
}

export async function transitionEmailTemplateVersion(owner: PlatformActor, versionId: string, nextStatus: TemplateVersionStatus) {
  requireOwner(owner);
  const version = await prisma.emailTemplateVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new NotFoundError("Email template version not found.");
  assertTransition(version.status, nextStatus);

  const updated = await prisma.$transaction(async (tx) => {
    if (nextStatus === "PUBLISHED") {
      const currentlyPublished = await tx.emailTemplateVersion.findFirst({ where: { emailTemplateId: version.emailTemplateId, status: "PUBLISHED" } });
      if (currentlyPublished) await tx.emailTemplateVersion.update({ where: { id: currentlyPublished.id }, data: { status: "RETIRED", retiredDate: new Date() } });
      return tx.emailTemplateVersion.update({ where: { id: versionId }, data: { status: "PUBLISHED", effectiveDate: new Date() } });
    }
    if (nextStatus === "RETIRED") return tx.emailTemplateVersion.update({ where: { id: versionId }, data: { status: "RETIRED", retiredDate: new Date() } });
    return tx.emailTemplateVersion.update({ where: { id: versionId }, data: { status: nextStatus } });
  });

  await recordPlatformActionAudit({ actorUserId: owner.userId, actorPlatformRole: owner.platformRole, action: `TEMPLATE_VERSION_${nextStatus}`, targetType: "EmailTemplateVersion", targetId: versionId, metadata: { emailTemplateId: version.emailTemplateId } });
  return updated;
}

export async function listEmailTemplateVersions(owner: PlatformActor, emailTemplateId: string) {
  requireOwner(owner);
  return prisma.emailTemplateVersion.findMany({ where: { emailTemplateId }, orderBy: { versionNumber: "desc" } });
}
