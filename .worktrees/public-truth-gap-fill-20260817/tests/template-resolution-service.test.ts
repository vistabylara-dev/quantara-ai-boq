import { DocumentTemplateType, PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { NotFoundError } from "../src/lib/errors/app-error";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { createTemplate } from "../src/lib/repositories/document-template-repository";
import { createReportTemplate } from "../src/lib/repositories/report-template-repository";
import { createEmailTemplate, setEmailTemplateDefault } from "../src/lib/repositories/email-template-repository";
import { transitionEmailTemplateVersion } from "../src/lib/services/template-governance-service";
import {
  resolveDocumentTemplateVersion,
  resolveEmailTemplate,
  resolveTechnicalReportTemplateVersion,
} from "../src/lib/services/template-resolution-service";

const RUN_ID = `${Date.now()}-${process.pid}`;

describe("template resolution service (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let ownerUserId: string;
  let boqTemplateId: string;
  let reportTemplateId: string;
  let emailTemplateId: string;
  let emailTemplateCode: string;
  let defaultEmailTemplateId: string;

  function owner(): PlatformActor {
    return { userId: ownerUserId, companyId: companyAId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Res Owner", email: `${RUN_ID}-owner@example.com` };
  }

  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: { legalName: `Template Res Co A ${RUN_ID}`, tradeName: "Template Res A", email: `template-res-a-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    const companyB = await prisma.company.create({
      data: { legalName: `Template Res Co B ${RUN_ID}`, tradeName: "Template Res B", email: `template-res-b-${RUN_ID}@example.com` },
    });
    companyBId = companyB.id;
    const owner_ = await prisma.user.create({
      data: { companyId: companyAId, email: `${RUN_ID}-owner@example.com`, passwordHash: "hash", fullName: "Res Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner_.id;

    const boqTemplate = await createTemplate(companyAId, {
      name: "Res BOQ Template",
      code: `res-boq-${RUN_ID}`,
      type: DocumentTemplateType.CORPORATE_TECHNICAL,
      styleConfig: { primaryColor: "#111111" },
    });
    boqTemplateId = boqTemplate.id;

    const reportTemplate = await createReportTemplate(companyAId, {
      name: "Res Report Template",
      code: `res-report-${RUN_ID}`,
      sectionsJson: { frontMatter: [], sections: [{ sectionCode: "obs", title: "Observations", blocks: [] }] },
    });
    reportTemplateId = reportTemplate.id;

    const emailTemplate = await createEmailTemplate(companyAId, {
      name: "Res Email Template",
      code: `res-email-${RUN_ID}`,
      category: "BOQ",
      subject: "Proposal ready",
      bodyHtml: "<p>Proposal ready</p>",
      bodyText: "Proposal ready",
    });
    emailTemplateId = emailTemplate.id;
    emailTemplateCode = emailTemplate.code;
    await setEmailTemplateDefault(companyAId, emailTemplate.id);
    defaultEmailTemplateId = emailTemplate.id;
  });

  afterAll(async () => {
    await prisma.emailTemplateVersion.deleteMany({ where: { emailTemplateId } });
    await prisma.emailTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.technicalReportTemplateVersion.deleteMany({ where: { technicalReportTemplateId: reportTemplateId } });
    await prisma.technicalReportTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.documentTemplateVersion.deleteMany({ where: { documentTemplateId: boqTemplateId } });
    await prisma.documentTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  describe("BOQ document templates — falls back, never blocks generation", () => {
    it("resolves the published version's config when one exists", async () => {
      const resolved = await resolveDocumentTemplateVersion({ companyId: companyAId, templateId: boqTemplateId });
      expect(resolved.versionId).not.toBeNull();
      expect(resolved.versionNumber).toBe(1);
      expect((resolved.styleConfigJson as { primaryColor?: string }).primaryColor).toBe("#111111");
    });

    it("falls back to the template's own live config when no published version exists, rather than blocking", async () => {
      const versions = await prisma.documentTemplateVersion.findMany({ where: { documentTemplateId: boqTemplateId } });
      await prisma.documentTemplateVersion.updateMany({ where: { id: { in: versions.map((v) => v.id) } }, data: { status: "RETIRED" } });

      const resolved = await resolveDocumentTemplateVersion({ companyId: companyAId, templateId: boqTemplateId });
      expect(resolved.versionId).toBeNull();
      expect(resolved.versionNumber).toBeNull();
      expect((resolved.styleConfigJson as { primaryColor?: string }).primaryColor).toBe("#111111");

      // restore for other tests / cross-tenant checks below
      await prisma.documentTemplateVersion.updateMany({ where: { id: { in: versions.map((v) => v.id) } }, data: { status: "PUBLISHED" } });
    });

    it("throws NotFoundError for a cross-tenant templateId", async () => {
      await expect(resolveDocumentTemplateVersion({ companyId: companyBId, templateId: boqTemplateId })).rejects.toThrow(NotFoundError);
    });
  });

  describe("technical report templates — falls back, never blocks report creation", () => {
    it("resolves the published version's sections when one exists", async () => {
      const resolved = await resolveTechnicalReportTemplateVersion({ companyId: companyAId, templateId: reportTemplateId });
      expect(resolved.versionId).not.toBeNull();
      expect(resolved.versionNumber).toBe(1);
    });

    it("falls back to the template's own live sectionsJson when no published version exists", async () => {
      const versions = await prisma.technicalReportTemplateVersion.findMany({ where: { technicalReportTemplateId: reportTemplateId } });
      await prisma.technicalReportTemplateVersion.updateMany({ where: { id: { in: versions.map((v) => v.id) } }, data: { status: "RETIRED" } });

      const resolved = await resolveTechnicalReportTemplateVersion({ companyId: companyAId, templateId: reportTemplateId });
      expect(resolved.versionId).toBeNull();
      expect(resolved.versionNumber).toBeNull();

      await prisma.technicalReportTemplateVersion.updateMany({ where: { id: { in: versions.map((v) => v.id) } }, data: { status: "PUBLISHED" } });
    });

    it("throws NotFoundError for a cross-tenant templateId", async () => {
      await expect(resolveTechnicalReportTemplateVersion({ companyId: companyBId, templateId: reportTemplateId })).rejects.toThrow(NotFoundError);
    });
  });

  describe("email templates — hard-blocks rather than silently using an unpublished template", () => {
    it("resolves by explicit templateId", async () => {
      const resolved = await resolveEmailTemplate({ companyId: companyAId, category: "BOQ", templateId: emailTemplateId });
      expect(resolved.versionNumber).toBe(1);
      expect(resolved.subject).toBe("Proposal ready");
    });

    it("resolves by stable code", async () => {
      const resolved = await resolveEmailTemplate({ companyId: companyAId, category: "BOQ", code: emailTemplateCode });
      expect(resolved.templateId).toBe(emailTemplateId);
    });

    it("resolves the company default when neither templateId nor code is given", async () => {
      const resolved = await resolveEmailTemplate({ companyId: companyAId, category: "BOQ" });
      expect(resolved.templateId).toBe(defaultEmailTemplateId);
    });

    it("throws NotFoundError for a cross-tenant templateId", async () => {
      await expect(resolveEmailTemplate({ companyId: companyBId, category: "BOQ", templateId: emailTemplateId })).rejects.toThrow(NotFoundError);
    });

    it("throws WRONG_TEMPLATE_CATEGORY when the explicit templateId is a different category", async () => {
      await expect(resolveEmailTemplate({ companyId: companyAId, category: "TECHNICAL_REPORT", templateId: emailTemplateId })).rejects.toMatchObject({ code: "WRONG_TEMPLATE_CATEGORY" });
    });

    it("hard-blocks with TEMPLATE_NOT_PUBLISHED when the template has no published version — never sends a malformed email", async () => {
      const versions = await prisma.emailTemplateVersion.findMany({ where: { emailTemplateId } });
      await prisma.emailTemplateVersion.updateMany({ where: { id: { in: versions.map((v) => v.id) } }, data: { status: "RETIRED" } });

      await expect(resolveEmailTemplate({ companyId: companyAId, category: "BOQ", templateId: emailTemplateId })).rejects.toMatchObject({ code: "TEMPLATE_NOT_PUBLISHED" });

      // restore for later assertions in this suite / other files sharing the fixture
      await prisma.emailTemplateVersion.updateMany({ where: { id: versions[0]!.id }, data: { status: "PUBLISHED" } });
    });

    it("republishing (via governance) resolves the new version's content, not the retired one", async () => {
      const draft = await prisma.emailTemplateVersion.create({
        data: { emailTemplateId, versionNumber: 99, status: "APPROVED", subject: "Re-published subject", bodyHtml: "<p>x</p>", bodyText: "x", effectiveDate: null },
      });
      await transitionEmailTemplateVersion(owner(), draft.id, "PUBLISHED");

      const resolved = await resolveEmailTemplate({ companyId: companyAId, category: "BOQ", templateId: emailTemplateId });
      expect(resolved.subject).toBe("Re-published subject");
      expect(resolved.versionNumber).toBe(99);
    });
  });
});
