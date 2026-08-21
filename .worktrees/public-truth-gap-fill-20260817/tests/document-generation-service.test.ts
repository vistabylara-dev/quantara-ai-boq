import { createHash } from "node:crypto";
import { DocumentTemplateType, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { createBOQItem, lockBOQ } from "../src/lib/repositories/boq-repository";
import { runBOQVerification } from "../src/lib/repositories/verification-repository";
import { createTemplate } from "../src/lib/repositories/document-template-repository";
import { setTemplateActiveForCompany } from "../src/lib/services/document-template-service";
import {
  deleteGeneratedDocument,
  generateDocument,
  getDocumentForDownload,
} from "../src/lib/services/document-generation-service";
import { getGeneratedDocumentRecord } from "../src/lib/repositories/generated-document-repository";
import {
  assertSafeStorageKey,
  StorageKeyError,
} from "../src/lib/storage/document-storage-adapter";
import { localDocumentStorageAdapter } from "../src/lib/storage/local-document-storage-adapter";
import { NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";
import { preserveIssuedEvidenceDuringCleanup } from "./helpers/preserve-issued-evidence";

const RUN_ID = Date.now();
const userIdByCompany = new Map<string, string>();

/**
 * generateDocument() persists actor.userId directly into
 * GeneratedDocument.generatedByUserId, which has a real FK to User.id (not
 * just a UUID-shaped column) — so, unlike other services' tests in this
 * suite, the actor here must reference a real seeded User row per company.
 */
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

describe("document generation service (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let clientAId: string;
  let templateAId: string;
  let templateBId: string;
  const cleanupStorageKeys: string[] = [];

  async function createCleanProjectAndBoq(referenceSuffix: string) {
    const { project, boq } = await createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: "construction",
      reference: `DOC-${referenceSuffix}-${RUN_ID}`,
      name: `Document Test Project ${referenceSuffix}`,
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    const sectionId = boq.sections[0].id;
    await createBOQItem(companyAId, sectionId, {
      itemNumber: 1,
      itemCode: `DOC-ITEM-${referenceSuffix}`,
      category: "Concrete",
      description: "Clean item with no verification issues",
      specification: "C40 concrete, BS 8500 compliant",
      quantity: "10",
      unit: "m3",
      unitCost: "300",
      marginMode: "MARKUP",
      marginPercentage: "20",
      drawingReference: "A-100",
      confidenceScore: "95",
      sortOrder: 1,
    });
    return { project, boq };
  }

  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: {
        legalName: `Phase5 Test Co A ${RUN_ID}`,
        tradeName: "Phase5 Co A",
        email: `phase5-a-${RUN_ID}@example.com`,
        address: "Dubai, UAE",
        taxRegistrationNumber: "100000000000001",
      },
    });
    const companyB = await prisma.company.create({
      data: { legalName: `Phase5 Test Co B ${RUN_ID}`, tradeName: "Phase5 Co B", email: `phase5-b-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    await grantUnlimitedPlanForTests(companyAId);
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyBId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyBId, industryEngineId: construction.id, enabled: true } });

    const client = await createClient(companyAId, { name: "Phase5 Client", email: `phase5-client-${RUN_ID}@example.com` });
    clientAId = client.id;

    await seedTestUser(companyAId, "phase5-owner-a");
    await seedTestUser(companyBId, "phase5-owner-b");

    const templateA = await createTemplate(companyAId, {
      name: "Test Corporate Technical",
      code: `test-corporate-technical-${RUN_ID}`,
      type: DocumentTemplateType.CORPORATE_TECHNICAL,
    });
    templateAId = templateA.id;

    const templateB = await createTemplate(companyBId, {
      name: "Company B Template",
      code: `company-b-template-${RUN_ID}`,
      type: DocumentTemplateType.CORPORATE_TECHNICAL,
    });
    templateBId = templateB.id;
  });

  afterAll(async () => {
    for (const key of cleanupStorageKeys) {
      await localDocumentStorageAdapter.deleteObject(key).catch(() => undefined);
    }
    if (await preserveIssuedEvidenceDuringCleanup([companyAId, companyBId])) {
      await prisma.$disconnect();
      return;
    }
    await prisma.generatedDocument.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.documentTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.verificationException.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQRevisionSnapshot.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.client.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  describe("storage key safety", () => {
    it("rejects path traversal in storage keys", () => {
      expect(() => assertSafeStorageKey("../../etc/passwd")).toThrow(StorageKeyError);
      expect(() => assertSafeStorageKey("/etc/passwd")).toThrow(StorageKeyError);
      expect(() => assertSafeStorageKey("a\\b")).toThrow(StorageKeyError);
      expect(() => assertSafeStorageKey("company/project/../../../etc")).toThrow(StorageKeyError);
      expect(() => assertSafeStorageKey("company/project/R01/doc.pdf")).not.toThrow();
    });
  });

  describe("draft generation from an unlocked BOQ", () => {
    it("allows CSV generation from an unlocked (draft) BOQ", async () => {
      const { boq } = await createCleanProjectAndBoq("csv-draft");
      const result = await generateDocument(actor(companyAId), boq.projectId, {
        boqId: boq.id,
        templateId: templateAId,
        documentType: "CSV",
        audience: "INTERNAL",
      });
      cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyAId, result.id)).storageKey!);
      expect(result.status).toBe("COMPLETED");
      expect(result.isDraft).toBe(true);
      expect(result.checksum).toBeTruthy();
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it("blocks PDF/XLSX/DOCX generation from an unlocked BOQ", async () => {
      const { boq } = await createCleanProjectAndBoq("pdf-blocked");
      await expect(
        generateDocument(actor(companyAId), boq.projectId, {
          boqId: boq.id,
          templateId: templateAId,
          documentType: "PDF",
          audience: "INTERNAL",
        }),
      ).rejects.toMatchObject({ code: "LOCKED_REVISION_REQUIRED" });
    });
  });

  describe("verification blocking", () => {
    it("blocks generation when critical verification exceptions remain", async () => {
      const { project, boq } = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: "construction",
        reference: `DOC-CRITICAL-${RUN_ID}`,
        name: "Critical Exception Project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
      // Missing description/unit -> guaranteed CRITICAL exceptions (MISSING_DESCRIPTION, MISSING_UNIT).
      await createBOQItem(companyAId, boq.sections[0].id, {
        itemNumber: 1,
        itemCode: "BAD-ITEM",
        category: "Concrete",
        description: "",
        quantity: "1",
        unit: "",
        unitCost: "100",
        marginMode: "MARKUP",
        marginPercentage: "10",
        sortOrder: 1,
      });

      await expect(
        generateDocument(actor(companyAId), project.databaseId, {
          boqId: boq.id,
          templateId: templateAId,
          documentType: "CSV",
          audience: "INTERNAL",
        }),
      ).rejects.toMatchObject({ code: "CRITICAL_VERIFICATION_EXCEPTIONS" });
    });
  });

  describe("final generation from a locked revision", () => {
    it("generates a PDF, stores it, and computes a correct checksum", async () => {
      const { boq } = await createCleanProjectAndBoq("pdf-locked");
      await runBOQVerification(companyAId, boq.id);
      await lockBOQ(companyAId, boq.id, "Test Locker");

      const result = await generateDocument(actor(companyAId), boq.projectId, {
        boqId: boq.id,
        templateId: templateAId,
        documentType: "PDF",
        audience: "CLIENT",
      });
      cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyAId, result.id)).storageKey!);

      expect(result.status).toBe("COMPLETED");
      expect(result.isDraft).toBe(false);
      expect(result.mimeType).toBe("application/pdf");

      const download = await getDocumentForDownload(actor(companyAId), result.id);
      const actualChecksum = createHash("sha256").update(download.buffer).digest("hex");
      expect(actualChecksum).toBe(result.checksum);
      expect(download.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("blocks CLIENT-audience final generation when the company profile is incomplete", async () => {
      const incompleteCompany = await prisma.company.create({
        data: { legalName: "Incomplete Co", tradeName: "Incomplete", email: `incomplete-${RUN_ID}@example.com` },
      });
      const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
      await prisma.companyIndustryEngine.create({ data: { companyId: incompleteCompany.id, industryEngineId: construction.id, enabled: true } });
      await seedTestUser(incompleteCompany.id, "phase5-owner-incomplete");
      const client = await createClient(incompleteCompany.id, { name: "Client", email: `incomplete-client-${RUN_ID}@example.com` });
      const template = await createTemplate(incompleteCompany.id, {
        name: "T",
        code: `incomplete-template-${RUN_ID}`,
        type: DocumentTemplateType.CORPORATE_TECHNICAL,
      });
      const { project, boq } = await createProjectWithDefaultBoq(actor(incompleteCompany.id), {
        clientId: client.id,
        industryEngineId: "construction",
        reference: `DOC-INCOMPLETE-${RUN_ID}`,
        name: "Incomplete Profile Project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
      await createBOQItem(incompleteCompany.id, boq.sections[0].id, {
        itemNumber: 1,
        itemCode: "ITEM-1",
        category: "Concrete",
        description: "Clean item",
        specification: "spec",
        quantity: "1",
        unit: "m3",
        unitCost: "100",
        marginMode: "MARKUP",
        marginPercentage: "20",
        drawingReference: "A-1",
        confidenceScore: "95",
        sortOrder: 1,
      });
      await runBOQVerification(incompleteCompany.id, boq.id);
      await lockBOQ(incompleteCompany.id, boq.id, "Locker");

      await expect(
        generateDocument(actor(incompleteCompany.id), project.databaseId, {
          boqId: boq.id,
          templateId: template.id,
          documentType: "PDF",
          audience: "CLIENT",
        }),
      ).rejects.toMatchObject({ code: "COMPANY_PROFILE_INCOMPLETE" });

      expect(await prisma.bOQRevisionItemEvidence.count({ where: { companyId: incompleteCompany.id } })).toBeGreaterThan(0);
    });
  });

  describe("regeneration and history", () => {
    it("creates a new record on regeneration, leaving the old record unchanged", async () => {
      const { boq } = await createCleanProjectAndBoq("regen");
      await runBOQVerification(companyAId, boq.id);
      await lockBOQ(companyAId, boq.id, "Test Locker");

      const first = await generateDocument(actor(companyAId), boq.projectId, {
        boqId: boq.id,
        templateId: templateAId,
        documentType: "CSV",
        audience: "INTERNAL",
      });
      cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyAId, first.id)).storageKey!);
      const firstSnapshot = await getGeneratedDocumentRecord(companyAId, first.id);

      const second = await generateDocument(actor(companyAId), boq.projectId, {
        boqId: boq.id,
        templateId: templateAId,
        documentType: "CSV",
        audience: "INTERNAL",
      });
      cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyAId, second.id)).storageKey!);

      expect(second.id).not.toBe(first.id);

      const firstAfter = await getGeneratedDocumentRecord(companyAId, first.id);
      expect(firstAfter.checksum).toBe(firstSnapshot.checksum);
      expect(firstAfter.fileName).toBe(firstSnapshot.fileName);
      expect(firstAfter.createdAt.getTime()).toBe(firstSnapshot.createdAt.getTime());

      const history = await prisma.generatedDocument.findMany({ where: { companyId: companyAId, boqId: boq.id } });
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("security: tenant isolation and RBAC", () => {
    it("rejects generation with a template from a different company", async () => {
      const { boq } = await createCleanProjectAndBoq("cross-tenant-template");
      await expect(
        generateDocument(actor(companyAId), boq.projectId, {
          boqId: boq.id,
          templateId: templateBId,
          documentType: "CSV",
          audience: "INTERNAL",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects download of a document belonging to a different company", async () => {
      const { boq } = await createCleanProjectAndBoq("cross-tenant-download");
      const result = await generateDocument(actor(companyAId), boq.projectId, {
        boqId: boq.id,
        templateId: templateAId,
        documentType: "CSV",
        audience: "INTERNAL",
      });
      cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyAId, result.id)).storageKey!);

      await expect(getDocumentForDownload(actor(companyBId), result.id)).rejects.toThrow(NotFoundError);
    });

    it("blocks a role without documents:generate from generating", async () => {
      const { boq } = await createCleanProjectAndBoq("rbac-generate");
      await expect(
        generateDocument(actor(companyAId, UserRole.DESIGNER), boq.projectId, {
          boqId: boq.id,
          templateId: templateAId,
          documentType: "CSV",
          audience: "INTERNAL",
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("blocks a role without documents:download from downloading", async () => {
      const { boq } = await createCleanProjectAndBoq("rbac-download");
      const result = await generateDocument(actor(companyAId), boq.projectId, {
        boqId: boq.id,
        templateId: templateAId,
        documentType: "CSV",
        audience: "INTERNAL",
      });
      cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyAId, result.id)).storageKey!);

      await expect(getDocumentForDownload(actor(companyAId, UserRole.DESIGNER), result.id)).rejects.toThrow(PermissionDeniedError);
    });

    it("blocks SALES_USER from generating INTERNAL-audience documents", async () => {
      const { boq } = await createCleanProjectAndBoq("rbac-sales-internal");
      await expect(
        generateDocument(actor(companyAId, UserRole.SALES_USER), boq.projectId, {
          boqId: boq.id,
          templateId: templateAId,
          documentType: "CSV",
          audience: "INTERNAL",
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("template validation", () => {
    it("rejects generation with an inactive template", async () => {
      const { boq } = await createCleanProjectAndBoq("inactive-template");
      const template = await createTemplate(companyAId, {
        name: "Soon Inactive",
        code: `soon-inactive-${RUN_ID}`,
        type: DocumentTemplateType.CORPORATE_TECHNICAL,
      });
      await setTemplateActiveForCompany(actor(companyAId), template.id, false);

      await expect(
        generateDocument(actor(companyAId), boq.projectId, {
          boqId: boq.id,
          templateId: template.id,
          documentType: "CSV",
          audience: "INTERNAL",
        }),
      ).rejects.toMatchObject({ code: "TEMPLATE_INACTIVE" });
    });
  });

  describe("deletion", () => {
    it("deletes both the database record and the stored file", async () => {
      const { boq } = await createCleanProjectAndBoq("delete");
      const result = await generateDocument(actor(companyAId), boq.projectId, {
        boqId: boq.id,
        templateId: templateAId,
        documentType: "CSV",
        audience: "INTERNAL",
      });
      const storageKey = (await getGeneratedDocumentRecord(companyAId, result.id)).storageKey!;
      expect(await localDocumentStorageAdapter.objectExists(storageKey)).toBe(true);

      await deleteGeneratedDocument(actor(companyAId), result.id);

      expect(await localDocumentStorageAdapter.objectExists(storageKey)).toBe(false);
      await expect(getGeneratedDocumentRecord(companyAId, result.id)).rejects.toThrow(NotFoundError);
    });
  });
});
