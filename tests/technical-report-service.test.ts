import { GeneratedDocumentType, PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { createReportTemplate } from "../src/lib/repositories/report-template-repository";
import { transitionTechnicalReportTemplateVersion, createTechnicalReportTemplateDraftVersion } from "../src/lib/services/template-governance-service";
import {
  createReportFromTemplate,
  deleteReport,
  generateReportDocument,
  getReport,
  getReportForDownload,
  listReportsForProject,
  updateReportFields,
} from "../src/lib/services/technical-report-service";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = Date.now();
const userIdByCompany = new Map<string, string>();

function actor(companyId: string, role: UserRole = UserRole.COMPANY_OWNER): CurrentActor {
  const userId = userIdByCompany.get(companyId);
  if (!userId) throw new Error(`No test user seeded for company ${companyId}`);
  return { userId, companyId, role, fullName: "Test Actor", email: "actor@example.com" };
}

async function seedTestUser(companyId: string, emailSuffix: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      companyId,
      email: `${emailSuffix}-${RUN_ID}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: "Test Actor",
      role: UserRole.COMPANY_OWNER,
      isActive: true,
    },
  });
  userIdByCompany.set(companyId, user.id);
  return user.id;
}

describe("technical report service (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let clientAId: string;
  let projectAId: string;
  let templateAId: string;
  let templateBId: string;
  const cleanupStorageKeys: string[] = [];

  function ownerPlatformActor(): PlatformActor {
    return { userId: userIdByCompany.get(companyAId)!, companyId: companyAId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "TR Owner", email: `tr-owner-${RUN_ID}@example.com` };
  }

  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: { legalName: `TR Test Co A ${RUN_ID}`, tradeName: "TR Co A", email: `tr-a-${RUN_ID}@example.com`, address: "Dubai, UAE" },
    });
    companyAId = companyA.id;
    await grantUnlimitedPlanForTests(companyAId);
    const companyB = await prisma.company.create({
      data: { legalName: `TR Test Co B ${RUN_ID}`, tradeName: "TR Co B", email: `tr-b-${RUN_ID}@example.com` },
    });
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyBId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyBId, industryEngineId: construction.id, enabled: true } });

    const client = await createClient(companyAId, { name: "TR Client", email: `tr-client-${RUN_ID}@example.com` });
    clientAId = client.id;

    await seedTestUser(companyAId, "tr-owner-a");
    await seedTestUser(companyBId, "tr-owner-b");

    const { project } = await createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: "construction",
      reference: `TR-${RUN_ID}`,
      name: "Technical Report Test Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectAId = project.databaseId;

    const templateA = await createReportTemplate(companyAId, {
      name: "Site Inspection",
      code: `tr-site-inspection-${RUN_ID}`,
      sectionsJson: {
        frontMatter: [{ type: "heading", text: "[Insert project name]" }],
        sections: [{ sectionCode: "obs", title: "Observations", blocks: [{ type: "paragraph", text: "Findings: [Insert findings]" }] }],
      },
    });
    templateAId = templateA.id;

    const templateB = await createReportTemplate(companyBId, {
      name: "Company B Report Template",
      code: `tr-company-b-${RUN_ID}`,
      sectionsJson: { frontMatter: [], sections: [] },
    });
    templateBId = templateB.id;
  });

  afterAll(async () => {
    for (const key of cleanupStorageKeys) {
      const { localDocumentStorageAdapter } = await import("../src/lib/storage/local-document-storage-adapter");
      await localDocumentStorageAdapter.deleteObject(key).catch(() => undefined);
    }
    await prisma.emailDispatch.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.technicalReportRetention.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.generatedTechnicalReport.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.technicalReportTemplateVersion.deleteMany({ where: { technicalReportTemplateId: { in: [templateAId, templateBId] } } });
    await prisma.technicalReportTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: userIdByCompany.get(companyAId) } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.client.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  describe("create from template", () => {
    it("snapshots the published version's sections and extracts real placeholders (no invented findings)", async () => {
      const report = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "Q1 Site Inspection" });
      expect(report.status).toBe("DRAFT");
      expect(report.templateVersionId).not.toBeNull();
      expect(report.templateVersionNumber).toBe(1);
      expect(report.placeholders).toEqual(expect.arrayContaining(["[Insert project name]", "[Insert findings]"]));
      expect(report.sections.sections[0].blocks[0]).toMatchObject({ text: "Findings: [Insert findings]" });
    });

    it("rejects creation from a different company's template (tenant isolation)", async () => {
      await expect(
        createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateBId, name: "Cross-tenant attempt" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("blocks a role without technical-reports:generate from creating a report", async () => {
      await expect(
        createReportFromTemplate(actor(companyAId, UserRole.DESIGNER), projectAId, { templateId: templateAId, name: "Blocked" }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("fill in and generate", () => {
    it("fills only known placeholders, generates a real DOCX, and allows download with a matching checksum", async () => {
      const report = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "Fill and generate" });
      const updated = await updateReportFields(actor(companyAId), report.id, {
        "[Insert project name]": "Marina Tower",
        "[Insert findings]": "No structural defects observed",
        "[Unknown placeholder]": "should be silently dropped",
      });
      expect(updated.fieldValues["[Insert project name]"]).toBe("Marina Tower");
      expect(updated.fieldValues["[Unknown placeholder]"]).toBeUndefined();

      const generated = await generateReportDocument(actor(companyAId), report.id, GeneratedDocumentType.DOCX);
      expect(generated.status).toBe("COMPLETED");
      expect(generated.fileName).toMatch(/\.docx$/);
      expect(generated.checksum).toBeTruthy();

      const download = await getReportForDownload(actor(companyAId), report.id);
      cleanupStorageKeys.push((await prisma.generatedTechnicalReport.findUniqueOrThrow({ where: { id: report.id } })).storageKey!);
      expect(download.buffer.byteLength).toBeGreaterThan(0);
      expect(download.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    });

    it("rejects an unsupported output type", async () => {
      const report = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "Unsupported type" });
      await expect(generateReportDocument(actor(companyAId), report.id, GeneratedDocumentType.PDF)).rejects.toMatchObject({ code: "UNSUPPORTED_REPORT_DOCUMENT_TYPE" });
    });

    it("rejects downloading a report that has not been generated yet", async () => {
      const report = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "Not generated" });
      await expect(getReportForDownload(actor(companyAId), report.id)).rejects.toMatchObject({ code: "TECHNICAL_REPORT_NOT_READY" });
    });
  });

  describe("tenant isolation and RBAC", () => {
    it("blocks a different company from reading a report by its internal id", async () => {
      const report = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "Isolation check" });
      await expect(getReport(actor(companyBId), report.id)).rejects.toThrow(NotFoundError);
    });

    it("blocks a role without documents:download from downloading a completed report", async () => {
      const report = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "RBAC download" });
      await updateReportFields(actor(companyAId), report.id, { "[Insert project name]": "X", "[Insert findings]": "Y" });
      await generateReportDocument(actor(companyAId), report.id, GeneratedDocumentType.DOCX);
      cleanupStorageKeys.push((await prisma.generatedTechnicalReport.findUniqueOrThrow({ where: { id: report.id } })).storageKey!);
      await expect(getReportForDownload(actor(companyAId, UserRole.DESIGNER), report.id)).rejects.toThrow(PermissionDeniedError);
    });

    it("lists only the requesting company's reports for a project", async () => {
      const reports = await listReportsForProject(actor(companyAId), projectAId);
      expect(reports.length).toBeGreaterThan(0);
      expect(reports.every((r) => r.companyId === companyAId)).toBe(true);
    });
  });

  describe("version traceability across publishing", () => {
    it("a report created before republishing keeps pointing at the version it was created from; a new report after republishing uses the new version", async () => {
      const before = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "Before republish" });
      expect(before.templateVersionNumber).toBe(1);

      const draft = await createTechnicalReportTemplateDraftVersion(ownerPlatformActor(), templateAId, {
        sectionsJson: { frontMatter: [], sections: [{ sectionCode: "obs2", title: "Observations v2", blocks: [] }] },
        changeSummary: "v2 for version-traceability test",
      });
      await transitionTechnicalReportTemplateVersion(ownerPlatformActor(), draft.id, "REVIEW");
      await transitionTechnicalReportTemplateVersion(ownerPlatformActor(), draft.id, "APPROVED");
      await transitionTechnicalReportTemplateVersion(ownerPlatformActor(), draft.id, "PUBLISHED");

      const after = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "After republish" });
      expect(after.templateVersionNumber).toBe(2);
      expect(after.sections.sections[0].title).toBe("Observations v2");

      const beforeReloaded = await getReport(actor(companyAId), before.id);
      expect(beforeReloaded.templateVersionNumber).toBe(1);
      expect(beforeReloaded.sections.sections[0].title).toBe("Observations");
    });
  });

  describe("deletion", () => {
    it("retains a completed report, its bytes, and its immutable database evidence", async () => {
      const report = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "Retained report" });
      await updateReportFields(actor(companyAId), report.id, { "[Insert project name]": "X", "[Insert findings]": "Y" });
      const completed = await generateReportDocument(actor(companyAId), report.id, GeneratedDocumentType.DOCX);
      const storageKey = (await prisma.generatedTechnicalReport.findUniqueOrThrow({ where: { id: report.id } })).storageKey!;
      const { localDocumentStorageAdapter } = await import("../src/lib/storage/local-document-storage-adapter");
      expect(await localDocumentStorageAdapter.objectExists(storageKey)).toBe(true);

      expect(completed).toMatchObject({ status: "COMPLETED", retentionLocked: true, retentionReason: "COMPLETED", canDelete: false });
      await expect(deleteReport(actor(companyAId), report.id)).rejects.toMatchObject({ code: "TECHNICAL_REPORT_RETENTION_LOCKED" });
      await expect(updateReportFields(actor(companyAId), report.id, { "[Insert findings]": "Changed" })).rejects.toMatchObject({ code: "TECHNICAL_REPORT_IMMUTABLE" });
      await expect(generateReportDocument(actor(companyAId), report.id, GeneratedDocumentType.DOCX)).rejects.toMatchObject({ code: "TECHNICAL_REPORT_IMMUTABLE" });
      await expect(prisma.generatedTechnicalReport.delete({ where: { id: report.id } })).rejects.toThrow();
      expect(await localDocumentStorageAdapter.objectExists(storageKey)).toBe(true);
      expect(await prisma.technicalReportRetention.findUnique({ where: { generatedTechnicalReportId: report.id } })).toMatchObject({ reason: "COMPLETED" });
      expect((await getReport(actor(companyAId), report.id)).status).toBe("COMPLETED");
    });

    it("still deletes an unissued draft report", async () => {
      const report = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "Disposable draft" });
      expect(report.canDelete).toBe(true);
      await deleteReport(actor(companyAId), report.id);
      await expect(getReport(actor(companyAId), report.id)).rejects.toThrow(NotFoundError);
    });

    it("blocks a role without technical-reports:delete from deleting", async () => {
      const report = await createReportFromTemplate(actor(companyAId), projectAId, { templateId: templateAId, name: "Blocked delete" });
      await expect(deleteReport(actor(companyAId, UserRole.DESIGNER), report.id)).rejects.toThrow(PermissionDeniedError);
    });
  });
});
