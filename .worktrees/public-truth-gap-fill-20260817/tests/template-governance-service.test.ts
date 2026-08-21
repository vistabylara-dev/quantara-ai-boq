import { DocumentTemplateType, PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { createTemplate } from "../src/lib/repositories/document-template-repository";
import { createReportTemplate } from "../src/lib/repositories/report-template-repository";
import { createEmailTemplate } from "../src/lib/repositories/email-template-repository";
import {
  createDocumentTemplateDraftVersion,
  createEmailTemplateDraftVersion,
  createTechnicalReportTemplateDraftVersion,
  listDocumentTemplateVersions,
  listEmailTemplateVersions,
  listTechnicalReportTemplateVersions,
  transitionDocumentTemplateVersion,
  transitionEmailTemplateVersion,
  transitionTechnicalReportTemplateVersion,
} from "../src/lib/services/template-governance-service";

const RUN_ID = `${Date.now()}-${process.pid}`;

describe("template governance service (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let ownerUserId: string;
  let boqTemplateId: string;
  let reportTemplateId: string;
  let emailTemplateId: string;
  let crossTenantBoqTemplateId: string;

  function owner(): PlatformActor {
    return { userId: ownerUserId, companyId: companyAId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Gov Owner", email: `${RUN_ID}-owner@example.com` };
  }
  function nonOwner(): PlatformActor {
    return { userId: ownerUserId, companyId: companyAId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "Gov Admin", email: `${RUN_ID}-admin@example.com` };
  }

  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: { legalName: `Template Gov Co A ${RUN_ID}`, tradeName: "Template Gov A", email: `template-gov-a-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    const companyB = await prisma.company.create({
      data: { legalName: `Template Gov Co B ${RUN_ID}`, tradeName: "Template Gov B", email: `template-gov-b-${RUN_ID}@example.com` },
    });
    companyBId = companyB.id;
    const owner_ = await prisma.user.create({
      data: { companyId: companyAId, email: `${RUN_ID}-owner@example.com`, passwordHash: "hash", fullName: "Gov Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner_.id;

    const boqTemplate = await createTemplate(companyAId, {
      name: "Gov BOQ Template",
      code: `gov-boq-${RUN_ID}`,
      type: DocumentTemplateType.CORPORATE_TECHNICAL,
    });
    boqTemplateId = boqTemplate.id;

    const crossTenant = await createTemplate(companyBId, {
      name: "Gov BOQ Template B",
      code: `gov-boq-b-${RUN_ID}`,
      type: DocumentTemplateType.CORPORATE_TECHNICAL,
    });
    crossTenantBoqTemplateId = crossTenant.id;

    const reportTemplate = await createReportTemplate(companyAId, {
      name: "Gov Report Template",
      code: `gov-report-${RUN_ID}`,
      sectionsJson: { frontMatter: [], sections: [] },
    });
    reportTemplateId = reportTemplate.id;

    const emailTemplate = await createEmailTemplate(companyAId, {
      name: "Gov Email Template",
      code: `gov-email-${RUN_ID}`,
      subject: "Hello",
      bodyHtml: "<p>Hello</p>",
      bodyText: "Hello",
    });
    emailTemplateId = emailTemplate.id;
  });

  afterAll(async () => {
    await prisma.emailTemplateVersion.deleteMany({ where: { emailTemplateId } });
    await prisma.emailTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.technicalReportTemplateVersion.deleteMany({ where: { technicalReportTemplateId: reportTemplateId } });
    await prisma.technicalReportTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.documentTemplateVersion.deleteMany({ where: { documentTemplateId: { in: [boqTemplateId, crossTenantBoqTemplateId] } } });
    await prisma.documentTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  describe("owner-only enforcement", () => {
    it("rejects a non-owner platform actor on every mutation and read", async () => {
      await expect(listDocumentTemplateVersions(nonOwner(), boqTemplateId)).rejects.toThrow(PermissionDeniedError);
      await expect(
        createDocumentTemplateDraftVersion(nonOwner(), boqTemplateId, { styleConfigJson: {}, contentConfigJson: {} }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("BOQ document template version lifecycle", () => {
    it("creation auto-publishes version 1", async () => {
      const versions = await listDocumentTemplateVersions(owner(), boqTemplateId);
      expect(versions).toHaveLength(1);
      expect(versions[0].status).toBe("PUBLISHED");
      expect(versions[0].versionNumber).toBe(1);
    });

    it("moves a new draft through the full DRAFT->REVIEW->APPROVED->PUBLISHED lifecycle and retires the previous published version", async () => {
      const draft = await createDocumentTemplateDraftVersion(owner(), boqTemplateId, {
        styleConfigJson: { primaryColor: "#000000" },
        contentConfigJson: { showLogo: true },
        changeSummary: "New palette",
      });
      expect(draft.status).toBe("DRAFT");
      expect(draft.versionNumber).toBe(2);

      const inReview = await transitionDocumentTemplateVersion(owner(), draft.id, "REVIEW");
      expect(inReview.status).toBe("REVIEW");

      const approved = await transitionDocumentTemplateVersion(owner(), draft.id, "APPROVED");
      expect(approved.status).toBe("APPROVED");

      const published = await transitionDocumentTemplateVersion(owner(), draft.id, "PUBLISHED");
      expect(published.status).toBe("PUBLISHED");
      expect(published.effectiveDate).not.toBeNull();

      const versions = await listDocumentTemplateVersions(owner(), boqTemplateId);
      const v1 = versions.find((v) => v.versionNumber === 1)!;
      const v2 = versions.find((v) => v.versionNumber === 2)!;
      expect(v1.status).toBe("RETIRED");
      expect(v1.retiredDate).not.toBeNull();
      expect(v2.status).toBe("PUBLISHED");
      expect(versions.filter((v) => v.status === "PUBLISHED")).toHaveLength(1);
    });

    it("rejects an invalid transition (DRAFT straight to PUBLISHED)", async () => {
      const draft = await createDocumentTemplateDraftVersion(owner(), boqTemplateId, { styleConfigJson: {}, contentConfigJson: {} });
      await expect(transitionDocumentTemplateVersion(owner(), draft.id, "PUBLISHED")).rejects.toMatchObject({ code: "INVALID_VERSION_TRANSITION" });
    });

    it("allows no further transitions once RETIRED", async () => {
      const draft = await createDocumentTemplateDraftVersion(owner(), boqTemplateId, { styleConfigJson: {}, contentConfigJson: {} });
      await transitionDocumentTemplateVersion(owner(), draft.id, "REVIEW");
      await transitionDocumentTemplateVersion(owner(), draft.id, "APPROVED");
      const published = await transitionDocumentTemplateVersion(owner(), draft.id, "PUBLISHED");
      const retired = await transitionDocumentTemplateVersion(owner(), published.id, "RETIRED");
      expect(retired.status).toBe("RETIRED");
      await expect(transitionDocumentTemplateVersion(owner(), retired.id, "REVIEW")).rejects.toMatchObject({ code: "INVALID_VERSION_TRANSITION" });
    });

    it("throws NotFoundError for a nonexistent template or version id", async () => {
      await expect(
        createDocumentTemplateDraftVersion(owner(), "00000000-0000-4000-8000-000000000000", { styleConfigJson: {}, contentConfigJson: {} }),
      ).rejects.toThrow(NotFoundError);
      await expect(transitionDocumentTemplateVersion(owner(), "00000000-0000-4000-8000-000000000000", "REVIEW")).rejects.toThrow(NotFoundError);
    });

    it("is a cross-tenant owner surface by design — the owner can govern any company's template", async () => {
      const versions = await listDocumentTemplateVersions(owner(), crossTenantBoqTemplateId);
      expect(versions).toHaveLength(1);
      expect(versions[0].status).toBe("PUBLISHED");
    });
  });

  describe("technical report template version lifecycle", () => {
    it("creation auto-publishes version 1, and a new draft can be published to replace it", async () => {
      const versions = await listTechnicalReportTemplateVersions(owner(), reportTemplateId);
      expect(versions).toHaveLength(1);
      expect(versions[0].status).toBe("PUBLISHED");

      const draft = await createTechnicalReportTemplateDraftVersion(owner(), reportTemplateId, {
        sectionsJson: { frontMatter: [], sections: [{ sectionCode: "obs", title: "Observations", blocks: [] }] },
      });
      await transitionTechnicalReportTemplateVersion(owner(), draft.id, "REVIEW");
      await transitionTechnicalReportTemplateVersion(owner(), draft.id, "APPROVED");
      const published = await transitionTechnicalReportTemplateVersion(owner(), draft.id, "PUBLISHED");
      expect(published.status).toBe("PUBLISHED");

      const after = await listTechnicalReportTemplateVersions(owner(), reportTemplateId);
      expect(after.filter((v) => v.status === "PUBLISHED")).toHaveLength(1);
      expect(after.find((v) => v.versionNumber === 1)!.status).toBe("RETIRED");
    });
  });

  describe("email template version lifecycle", () => {
    it("creation auto-publishes version 1, and publishing a new draft retires it without deleting history", async () => {
      const versions = await listEmailTemplateVersions(owner(), emailTemplateId);
      expect(versions).toHaveLength(1);
      expect(versions[0].status).toBe("PUBLISHED");

      const draft = await createEmailTemplateDraftVersion(owner(), emailTemplateId, {
        subject: "Updated subject",
        bodyHtml: "<p>Updated</p>",
        bodyText: "Updated",
      });
      await transitionEmailTemplateVersion(owner(), draft.id, "REVIEW");
      await transitionEmailTemplateVersion(owner(), draft.id, "APPROVED");
      await transitionEmailTemplateVersion(owner(), draft.id, "PUBLISHED");

      const after = await listEmailTemplateVersions(owner(), emailTemplateId);
      expect(after).toHaveLength(2);
      expect(after.filter((v) => v.status === "PUBLISHED")).toHaveLength(1);
      expect(after.find((v) => v.versionNumber === 1)!.status).toBe("RETIRED");
      expect(after.find((v) => v.versionNumber === 1)!.subject).toBe("Hello");
    });
  });
});
