import { DocumentTemplateType, GeneratedDocumentType, UserRole } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { createBOQItem, lockBOQ } from "../src/lib/repositories/boq-repository";
import { runBOQVerification } from "../src/lib/repositories/verification-repository";
import { createTemplate } from "../src/lib/repositories/document-template-repository";
import { deleteGeneratedDocument, generateDocument } from "../src/lib/services/document-generation-service";
import { createEmailTemplate } from "../src/lib/repositories/email-template-repository";
import { createReportTemplate } from "../src/lib/repositories/report-template-repository";
import { createReportFromTemplate, generateReportDocument } from "../src/lib/services/technical-report-service";
import {
  createProposalForProject,
  getProposalForCompany,
  markProposalReadyForCompany,
  regenerateProposalLinkForCompany,
  revokeProposalForCompany,
} from "../src/lib/services/client-proposal-service";
import { previewProposalEmail, sendProposalEmail, testSendProposalEmail } from "../src/lib/services/email-service";
import {
  approveProposalPublic,
  getPublicProposalView,
  rejectProposalPublic,
  requestProposalRevision,
  selectProposalOption,
  submitProposalComment,
} from "../src/lib/services/public-proposal-service";
import { findProposalByRawToken, generateProposalToken, hashProposalToken, validateProposalAccess } from "../src/lib/proposals/proposal-token";
import { createProposal, markProposalSent } from "../src/lib/repositories/client-proposal-repository";
import { NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import { localDocumentStorageAdapter } from "../src/lib/storage/local-document-storage-adapter";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = Date.now();
const userIdByCompany = new Map<string, string>();
const req = () => new Request("http://test.local/");

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

describe("client proposal + email delivery (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let clientAId: string;
  let templateAId: string;
  let reportTemplateAId: string;
  let reportTemplateBId: string;
  const cleanupStorageKeys: string[] = [];

  async function fixture(referenceSuffix: string, options: { withOption?: boolean } = {}) {
    const { project, boq } = await createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: "construction",
      reference: `PROP-${referenceSuffix}-${RUN_ID}`,
      name: `Proposal Test Project ${referenceSuffix}`,
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    const { item } = await createBOQItem(companyAId, boq.sections[0].id, {
      itemNumber: 1,
      itemCode: `PROP-ITEM-${referenceSuffix}`,
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

    let optionId: string | null = null;
    if (options.withOption) {
      const option = await prisma.bOQItemOption.create({
        data: { companyId: companyAId, boqItemId: item.id, label: "Premium finish", rate: 999 },
      });
      optionId = option.id;
    }

    await runBOQVerification(companyAId, boq.id);
    await lockBOQ(companyAId, boq.id, "Test Locker");

    const document = await generateDocument(actor(companyAId), project.databaseId, {
      boqId: boq.id,
      templateId: templateAId,
      documentType: "PDF",
      audience: "CLIENT",
    });
    const storageKey = (await prisma.generatedDocument.findUniqueOrThrow({ where: { id: document.id } })).storageKey;
    if (storageKey) cleanupStorageKeys.push(storageKey);

    return { project, boq, itemId: item.id, itemSellingRate: item.sellingRate.toNumber(), optionId, documentId: document.id };
  }

  async function reportFixture(referenceSuffix: string, options: { skipGenerate?: boolean } = {}) {
    const { project } = await createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: "construction",
      reference: `PROP-TR-${referenceSuffix}-${RUN_ID}`,
      name: `Proposal Report Test Project ${referenceSuffix}`,
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    const report = await createReportFromTemplate(actor(companyAId), project.databaseId, {
      templateId: reportTemplateAId,
      name: `Report ${referenceSuffix}`,
    });
    if (options.skipGenerate) return { project, report };
    const generated = await generateReportDocument(actor(companyAId), report.id, GeneratedDocumentType.DOCX);
    if (generated.fileName) {
      const record = await prisma.generatedTechnicalReport.findUniqueOrThrow({ where: { id: report.id } });
      if (record.storageKey) cleanupStorageKeys.push(record.storageKey);
    }
    return { project, report: generated };
  }

  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: {
        legalName: `Phase6 Test Co A ${RUN_ID}`,
        tradeName: "Phase6 Co A",
        email: `phase6-a-${RUN_ID}@example.com`,
        address: "Dubai, UAE",
        taxRegistrationNumber: "100000000000002",
      },
    });
    const companyB = await prisma.company.create({
      data: { legalName: `Phase6 Test Co B ${RUN_ID}`, tradeName: "Phase6 Co B", email: `phase6-b-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    await grantUnlimitedPlanForTests(companyAId);
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyBId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyBId, industryEngineId: construction.id, enabled: true } });

    const client = await createClient(companyAId, { name: "Phase6 Client", email: `phase6-client-${RUN_ID}@example.com` });
    clientAId = client.id;

    await seedTestUser(companyAId, "phase6-owner-a");
    await seedTestUser(companyBId, "phase6-owner-b");

    const templateA = await createTemplate(companyAId, {
      name: "Test Corporate Technical",
      code: `test-corp-technical-p6-${RUN_ID}`,
      type: DocumentTemplateType.CORPORATE_TECHNICAL,
    });
    templateAId = templateA.id;

    const reportTemplateA = await createReportTemplate(companyAId, {
      name: "Proposal Test Report Template",
      code: `prop-report-template-a-${RUN_ID}`,
      sectionsJson: {
        frontMatter: [{ type: "heading", text: "[Insert project name]" }],
        sections: [{ sectionCode: "obs", title: "Observations", blocks: [{ type: "paragraph", text: "[Insert findings]" }] }],
      },
    });
    reportTemplateAId = reportTemplateA.id;

    const reportTemplateB = await createReportTemplate(companyBId, {
      name: "Company B Report Template",
      code: `prop-report-template-b-${RUN_ID}`,
      sectionsJson: { frontMatter: [], sections: [] },
    });
    reportTemplateBId = reportTemplateB.id;
  });

  afterAll(async () => {
    for (const key of cleanupStorageKeys) {
      await localDocumentStorageAdapter.deleteObject(key).catch(() => undefined);
    }
    const companyIds = [companyAId, companyBId];
    await prisma.emailDispatch.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.clientProposalEvent.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.clientProposalDocument.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.clientProposal.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.emailTemplate.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.generatedDocument.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.documentTemplate.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.technicalReportRetention.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.generatedTechnicalReport.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.technicalReportTemplateVersion.deleteMany({ where: { technicalReportTemplateId: { in: [reportTemplateAId, reportTemplateBId] } } });
    await prisma.technicalReportTemplate.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.verificationException.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.bOQRevisionSnapshot.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.project.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.client.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    delete process.env.EMAIL_PROVIDER;
  });

  describe("token security", () => {
    it("generates 32-byte, URL-safe tokens whose SHA-256 hash is what gets stored", () => {
      const raw = generateProposalToken();
      expect(raw.length).toBeGreaterThanOrEqual(40);
      expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
      const hash = hashProposalToken(raw);
      expect(hash).toHaveLength(64);
      expect(hash).not.toBe(raw);
    });

    it("rejects a token that does not exist", async () => {
      const result = await validateProposalAccess("not-a-real-token-at-all-00000000000000000000");
      expect(result).toMatchObject({ ok: false, reason: "NOT_FOUND" });
    });

    it("rejects DRAFT/READY proposals as INVALID_STATUS (never sent, no client link should work yet)", async () => {
      const { boq, documentId, project } = await fixture("token-draft");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });

      const draftResult = await validateProposalAccess(rawToken!);
      expect(draftResult).toMatchObject({ ok: false, reason: "INVALID_STATUS" });

      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      const readyResult = await validateProposalAccess(rawToken!);
      expect(readyResult).toMatchObject({ ok: false, reason: "INVALID_STATUS" });
    });

    it("rejects a revoked proposal's token", async () => {
      const { boq, documentId, project } = await fixture("token-revoked");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await revokeProposalForCompany(actor(companyAId), proposal.id);

      const result = await validateProposalAccess(rawToken!);
      expect(result).toMatchObject({ ok: false, reason: "REVOKED" });
    });

    it("rejects an expired proposal's token", async () => {
      const { boq, documentId, project } = await fixture("token-expired");
      const rawToken = generateProposalToken();
      const client = await prisma.client.findFirstOrThrow({ where: { id: clientAId, companyId: companyAId } });
      const { proposal: created } = await (async () => {
        const p = await createProposal(companyAId, {
          projectId: project.databaseId,
          sourceType: "BOQ_REVISION" as const,
          boqId: boq.id,
          revisionNumber: 1,
          clientId: client.id,
          recipientEmail: "client@example.com",
          recipientName: "Client",
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          documentIds: [documentId],
          createdByUserId: actor(companyAId).userId,
          createdByName: "Test Actor",
        });
        return p;
      })();
      // Directly overwrite the hash so our own rawToken resolves (createProposal generates its own).
      await prisma.clientProposal.update({ where: { id: created.id }, data: { tokenHash: hashProposalToken(rawToken) } });

      const result = await validateProposalAccess(rawToken);
      expect(result).toMatchObject({ ok: false, reason: "EXPIRED" });
    });

    it("a link stops resolving to the old token immediately after regeneration", async () => {
      const { boq, documentId, project } = await fixture("token-regen");
      const { proposal, rawToken: oldToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });

      const { rawToken: newToken } = await regenerateProposalLinkForCompany(actor(companyAId), proposal.id);

      expect(await findProposalByRawToken(oldToken!)).toBeNull();
      expect(await findProposalByRawToken(newToken)).not.toBeNull();
    });
  });

  describe("proposal creation guards", () => {
    it("blocks creation from an unlocked revision", async () => {
      const { project, boq } = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: "construction",
        reference: `PROP-UNLOCKED-${RUN_ID}`,
        name: "Unlocked Project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
      await expect(
        createProposalForProject(actor(companyAId), project.databaseId, {
          sourceType: "BOQ_REVISION" as const,
          boqId: boq.id,
          recipientEmail: "client@example.com",
          recipientName: "Client",
          documentIds: [],
        }),
      ).rejects.toMatchObject({ code: "BOQ_REVISION_NOT_LOCKED" });
    });

    it("blocks creation when unresolved CRITICAL verification exceptions remain", async () => {
      const { project, boq } = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: "construction",
        reference: `PROP-CRIT-${RUN_ID}`,
        name: "Critical Exception Project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
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
      await runBOQVerification(companyAId, boq.id);
      // lockBOQ() itself refuses to lock while critical exceptions remain, so
      // this defense-in-depth guard in createProposalForProject can only be
      // reached by forcing the locked flag directly, bypassing that check.
      await prisma.bOQ.update({ where: { id: boq.id }, data: { isLocked: true, lockedAt: new Date() } });

      await expect(
        createProposalForProject(actor(companyAId), project.databaseId, {
          sourceType: "BOQ_REVISION" as const,
          boqId: boq.id,
          recipientEmail: "client@example.com",
          recipientName: "Client",
          documentIds: [],
        }),
      ).rejects.toMatchObject({ code: "CRITICAL_VERIFICATION_EXCEPTIONS" });
    });

    it("rejects a document belonging to a different company (tenant isolation on attachments)", async () => {
      const { project, boq } = await fixture("cross-tenant-doc");
      const otherDoc = await prisma.generatedDocument.create({
        data: {
          companyId: companyBId,
          projectId: project.databaseId,
          boqId: boq.id,
          templateId: templateAId,
          type: "PDF",
          audience: "CLIENT",
          status: "COMPLETED",
          isDraft: false,
          revisionNumber: 1,
          fileName: "x.pdf",
          mimeType: "application/pdf",
          fileSize: 10,
          checksum: "x",
          storageKey: "x",
          generatedByUserId: userIdByCompany.get(companyBId)!,
          generatedByName: "Test Actor",
        },
      });
      await expect(
        createProposalForProject(actor(companyAId), project.databaseId, {
          sourceType: "BOQ_REVISION" as const,
          boqId: boq.id,
          recipientEmail: "client@example.com",
          recipientName: "Client",
          documentIds: [otherDoc.id],
        }),
      ).rejects.toThrow(NotFoundError);
      await prisma.generatedDocument.delete({ where: { id: otherDoc.id } });
    });

    it("retains an issued proposal document, its bytes, attachment, and event history", async () => {
      const { boq, documentId, project } = await fixture("issued-document-retention");
      const { proposal } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION",
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);
      const document = await prisma.generatedDocument.findUniqueOrThrow({ where: { id: documentId } });
      const eventCount = await prisma.clientProposalEvent.count({ where: { clientProposalId: proposal.id } });

      await expect(deleteGeneratedDocument(actor(companyAId), documentId)).rejects.toMatchObject({ code: "DOCUMENT_RETENTION_LOCKED" });
      await expect(prisma.generatedDocument.update({
        where: { id: documentId },
        data: { storageKey: "tampered-issued-document" },
      })).rejects.toThrow();
      await expect(prisma.generatedDocument.delete({ where: { id: documentId } })).rejects.toThrow();
      await expect(prisma.clientProposal.delete({ where: { id: proposal.id } })).rejects.toThrow();

      expect(await localDocumentStorageAdapter.objectExists(document.storageKey!)).toBe(true);
      expect(await prisma.generatedDocument.findUnique({ where: { id: documentId } })).not.toBeNull();
      expect(await prisma.clientProposalDocument.findUnique({
        where: { clientProposalId_generatedDocumentId: { clientProposalId: proposal.id, generatedDocumentId: documentId } },
      })).not.toBeNull();
      expect(eventCount).toBeGreaterThan(0);
      expect(await prisma.clientProposalEvent.count({ where: { clientProposalId: proposal.id } })).toBe(eventCount);
    });

    it("returns the existing active proposal instead of duplicating by default", async () => {
      const { boq, documentId, project } = await fixture("duplicate");
      const first = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });

      const second = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "someone-else@example.com",
        recipientName: "Someone Else",
        documentIds: [documentId],
      });

      expect(second.isExisting).toBe(true);
      expect(second.proposal.id).toBe(first.proposal.id);
    });

    it("blocks a role without proposals:manage from creating a proposal", async () => {
      const { boq, documentId, project } = await fixture("rbac-create");
      await expect(
        createProposalForProject(actor(companyAId, UserRole.DESIGNER), project.databaseId, {
          sourceType: "BOQ_REVISION" as const,
          boqId: boq.id,
          recipientEmail: "client@example.com",
          recipientName: "Client",
          documentIds: [documentId],
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("options and deterministic total recalculation", () => {
    it("recalculates the total using the selected option's rate, without mutating the locked BOQItem", async () => {
      const { boq, documentId, itemId, itemSellingRate, optionId, project } = await fixture("options", { withOption: true });
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);

      const opened = await getPublicProposalView(rawToken!, req());
      if (!opened.ok || opened.view === null) throw new Error("expected an open view");
      if (opened.view.sourceType !== "BOQ_REVISION") throw new Error("expected a BOQ view");
      const itemBefore = opened.view.boq.sections[0].items.find((i) => i.id === itemId)!;
      expect(itemBefore.totalAmount).toBeCloseTo(10 * itemSellingRate, 2);

      const { view } = await selectProposalOption(rawToken!, { boqItemId: itemId, optionId }, req());
      if (view.sourceType !== "BOQ_REVISION") throw new Error("expected a BOQ view");
      const itemAfter = view.boq.sections[0].items.find((i) => i.id === itemId)!;
      expect(itemAfter.totalAmount).toBeCloseTo(10 * 999, 2);
      expect(itemAfter.options.find((o) => o.id === optionId)?.isSelected).toBe(true);

      const rawItem = await prisma.bOQItem.findUniqueOrThrow({ where: { id: itemId } });
      expect(rawItem.sellingRate.toNumber()).not.toBe(999); // the locked BOQItem itself is never mutated

      const deselected = await selectProposalOption(rawToken!, { boqItemId: itemId, optionId: null }, req());
      if (deselected.view.sourceType !== "BOQ_REVISION") throw new Error("expected a BOQ view");
      const itemReverted = deselected.view.boq.sections[0].items.find((i) => i.id === itemId)!;
      expect(itemReverted.totalAmount).toBeCloseTo(itemBefore.totalAmount, 2);
    });

    it("rejects an option that does not belong to the item", async () => {
      const { boq, documentId, itemId, project } = await fixture("options-invalid");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);
      await getPublicProposalView(rawToken!, req());

      await expect(
        selectProposalOption(rawToken!, { boqItemId: itemId, optionId: "00000000-0000-0000-0000-000000000000" }, req()),
      ).rejects.toMatchObject({ code: "OPTION_NOT_FOUND" });
    });
  });

  describe("comments and revision requests", () => {
    it("adds a client comment and transitions OPENED -> COMMENTED", async () => {
      const { boq, documentId, project } = await fixture("comment");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);
      await getPublicProposalView(rawToken!, req());

      const updated = await submitProposalComment(rawToken!, { comment: "Please confirm lead time." }, req());
      expect(updated.status).toBe("COMMENTED");
      expect(updated.clientComment).toBe("Please confirm lead time.");
    });

    it("requires name, email, and a reason to request a revision, and updates the project status", async () => {
      const { boq, documentId, project } = await fixture("revision");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);
      await getPublicProposalView(rawToken!, req());

      await expect(
        requestProposalRevision(rawToken!, { name: "", email: "a@b.com", comment: "x" }, req()),
      ).rejects.toMatchObject({ code: "REVISION_REQUEST_FIELDS_REQUIRED" });

      const updated = await requestProposalRevision(rawToken!, { name: "Jane", email: "jane@example.com", comment: "Please reduce quantities." }, req());
      expect(updated.status).toBe("REVISION_REQUESTED");

      const refreshedProject = await prisma.project.findUniqueOrThrow({ where: { id: project.databaseId } });
      expect(refreshedProject.status).toBe("REVISION_REQUESTED");

      // A decided proposal cannot be approved afterward.
      await expect(
        approveProposalPublic(rawToken!, { approvalName: "Jane", approvalEmail: "jane@example.com", confirmReview: true }, req()),
      ).rejects.toMatchObject({ code: "INVALID_PROPOSAL_TRANSITION" });
    });
  });

  describe("approval and rejection", () => {
    it("requires confirmReview and records approval, updating the project status", async () => {
      const { boq, documentId, project } = await fixture("approve");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);
      await getPublicProposalView(rawToken!, req());

      await expect(
        approveProposalPublic(rawToken!, { approvalName: "Jane", approvalEmail: "jane@example.com", confirmReview: false }, req()),
      ).rejects.toMatchObject({ code: "REVIEW_CONFIRMATION_REQUIRED" });

      const updated = await approveProposalPublic(rawToken!, { approvalName: "Jane Doe", approvalEmail: "jane@example.com", confirmReview: true }, req());
      expect(updated.status).toBe("APPROVED");
      expect(updated.approvalName).toBe("Jane Doe");

      const refreshedProject = await prisma.project.findUniqueOrThrow({ where: { id: project.databaseId } });
      expect(refreshedProject.status).toBe("CLIENT_APPROVED");
    });

    it("blocks approval of a revoked proposal", async () => {
      const { boq, documentId, project } = await fixture("approve-revoked");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);
      await revokeProposalForCompany(actor(companyAId), proposal.id);

      await expect(
        approveProposalPublic(rawToken!, { approvalName: "Jane", approvalEmail: "jane@example.com", confirmReview: true }, req()),
      ).rejects.toMatchObject({ code: "PROPOSAL_REVOKED" });
    });

    it("records a rejection with a reason and updates the project status", async () => {
      const { boq, documentId, project } = await fixture("reject");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);
      await getPublicProposalView(rawToken!, req());

      const updated = await rejectProposalPublic(rawToken!, { name: "Jane", email: "jane@example.com", reason: "Budget too high." }, req());
      expect(updated.status).toBe("REJECTED");

      const refreshedProject = await prisma.project.findUniqueOrThrow({ where: { id: project.databaseId } });
      expect(refreshedProject.status).toBe("REJECTED");
    });
  });

  describe("email delivery", () => {
    it("previews the rendered email with substituted variables and HTML-escaped values", async () => {
      const { boq, documentId, project } = await fixture("email-preview");
      const template = await createEmailTemplate(companyAId, {
        name: "Test Proposal Email",
        code: `test-proposal-email-${RUN_ID}`,
        subject: "Your proposal for {{projectName}}",
        bodyHtml: "<p>Hello {{clientName}}, view it here: {{secureReviewUrl}}</p>",
        bodyText: "Hello {{clientName}}, view it here: {{secureReviewUrl}}",
      });
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "<b>Client</b>",
        documentIds: [documentId],
      });

      const preview = await previewProposalEmail(actor(companyAId), { proposalId: proposal.id, rawToken: rawToken!, emailTemplateId: template.id });
      expect(preview.subject).toContain(project.name);
      expect(preview.bodyHtml).toContain("&lt;b&gt;Client&lt;/b&gt;");
      expect(preview.bodyHtml).not.toContain("<b>Client</b>");
    });

    it("rejects a stale token after the link has been regenerated", async () => {
      const { boq, documentId, project } = await fixture("email-stale-token");
      const template = await createEmailTemplate(companyAId, {
        name: "Stale Token Template",
        code: `stale-token-template-${RUN_ID}`,
        subject: "Subject",
        bodyHtml: "<p>{{secureReviewUrl}}</p>",
        bodyText: "{{secureReviewUrl}}",
      });
      const { proposal, rawToken: oldToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await regenerateProposalLinkForCompany(actor(companyAId), proposal.id);

      await expect(
        previewProposalEmail(actor(companyAId), { proposalId: proposal.id, rawToken: oldToken!, emailTemplateId: template.id }),
      ).rejects.toMatchObject({ code: "STALE_PROPOSAL_TOKEN" });
    });

    it("test-send always uses the development provider and never persists a dispatch or touches proposal status", async () => {
      const { boq, documentId, project } = await fixture("email-test-send");
      const template = await createEmailTemplate(companyAId, {
        name: "Test Send Template",
        code: `test-send-template-${RUN_ID}`,
        subject: "Subject",
        bodyHtml: "<p>Body</p>",
        bodyText: "Body",
      });
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });

      const before = await prisma.emailDispatch.count({ where: { clientProposalId: proposal.id } });
      const result = await testSendProposalEmail(actor(companyAId), {
        proposalId: proposal.id,
        rawToken: rawToken!,
        emailTemplateId: template.id,
        testRecipient: "internal-tester@example.com",
      });
      expect(result.providerResult.status).toBe("DEVELOPMENT_CAPTURED");
      expect(result.subject).toContain("[TEST]");
      const after = await prisma.emailDispatch.count({ where: { clientProposalId: proposal.id } });
      expect(after).toBe(before);
      const untouchedProposal = await getProposalForCompany(actor(companyAId), proposal.id);
      expect(untouchedProposal.status).toBe("DRAFT");
    });

    it("marks the proposal SENT on a successful send but not on a failed one", async () => {
      const { boq, documentId, project } = await fixture("email-send");
      const template = await createEmailTemplate(companyAId, {
        name: "Send Template",
        code: `send-template-${RUN_ID}`,
        subject: "Subject",
        bodyHtml: "<p>Body {{secureReviewUrl}}</p>",
        bodyText: "Body {{secureReviewUrl}}",
      });
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);

      // Force a deterministic, network-free failure: EMAIL_PROVIDER=smtp with no SMTP_* env vars configured.
      process.env.EMAIL_PROVIDER = "smtp";
      const failed = await sendProposalEmail(actor(companyAId), { proposalId: proposal.id, rawToken: rawToken!, emailTemplateId: template.id });
      expect(failed.status).toBe("FAILED");
      expect(failed.proposalStatus).toBe("READY");
      delete process.env.EMAIL_PROVIDER;

      const sent = await sendProposalEmail(actor(companyAId), { proposalId: proposal.id, rawToken: rawToken!, emailTemplateId: template.id });
      expect(sent.status).toBe("DEVELOPMENT_CAPTURED");
      expect(sent.proposalStatus).toBe("SENT");

      const finalProposal = await getProposalForCompany(actor(companyAId), proposal.id);
      expect(finalProposal.status).toBe("SENT");
    });
  });

  describe("tenant isolation", () => {
    it("blocks a different company from reading a proposal by its internal id", async () => {
      const { boq, documentId, project } = await fixture("isolation-read");
      const { proposal } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });

      await expect(getProposalForCompany(actor(companyBId), proposal.id)).rejects.toThrow(NotFoundError);
    });

    it("blocks a different company's email template from being used for a proposal", async () => {
      const { boq, documentId, project } = await fixture("isolation-template");
      const otherTemplate = await createEmailTemplate(companyBId, {
        name: "Other Co Template",
        code: `other-co-template-${RUN_ID}`,
        subject: "Subject",
        bodyHtml: "<p>Body</p>",
        bodyText: "Body",
      });
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "BOQ_REVISION" as const,
        boqId: boq.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        documentIds: [documentId],
      });

      await expect(
        previewProposalEmail(actor(companyAId), { proposalId: proposal.id, rawToken: rawToken!, emailTemplateId: otherTemplate.id }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("technical report proposals", () => {
    it("creates, sends, and serves a technical-report-sourced proposal end to end", async () => {
      const { project, report } = await reportFixture("full-flow");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "TECHNICAL_REPORT_REVISION",
        technicalReportId: report.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
      });
      expect(proposal.sourceType).toBe("TECHNICAL_REPORT_REVISION");
      expect(proposal.boqId).toBeNull();
      expect(proposal.technicalReportId).toBe(report.id);

      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);

      const opened = await getPublicProposalView(rawToken!, req());
      if (!opened.ok || opened.view === null) throw new Error("expected an open view");
      if (opened.view.sourceType !== "TECHNICAL_REPORT_REVISION") throw new Error("expected a technical report view");
      expect(opened.view.report.id).toBe(report.id);
      expect(opened.view.report.fileName).toBe(report.fileName);
    });

    it("blocks creation from a report that has not finished generating", async () => {
      const { project, report } = await reportFixture("not-final", { skipGenerate: true });
      await expect(
        createProposalForProject(actor(companyAId), project.databaseId, {
          sourceType: "TECHNICAL_REPORT_REVISION",
          technicalReportId: report.id,
          recipientEmail: "client@example.com",
          recipientName: "Client",
        }),
      ).rejects.toMatchObject({ code: "REPORT_REVISION_NOT_FINAL" });
    });

    it("prevents database-level corruption of a completed report's generated evidence", async () => {
      const { report } = await reportFixture("immutable-completed-report");
      await expect(
        prisma.generatedTechnicalReport.update({ where: { id: report.id }, data: { storageKey: null } }),
      ).rejects.toThrow();
      expect((await prisma.generatedTechnicalReport.findUniqueOrThrow({ where: { id: report.id } })).storageKey).not.toBeNull();
      expect(await prisma.technicalReportRetention.findUnique({ where: { generatedTechnicalReportId: report.id } })).not.toBeNull();
    });

    it("rejects a technical report belonging to a different company (tenant isolation)", async () => {
      const { project: otherProject } = await createProjectWithDefaultBoq(actor(companyBId), {
        clientId: (await createClient(companyBId, { name: "Co B Client", email: `co-b-client-${RUN_ID}@example.com` })).id,
        industryEngineId: "construction",
        reference: `PROP-TR-CROSS-${RUN_ID}`,
        name: "Cross tenant report project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
      const otherReport = await createReportFromTemplate(actor(companyBId), otherProject.databaseId, {
        templateId: reportTemplateBId,
        name: "Company B report",
      });
      const { project } = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: "construction",
        reference: `PROP-TR-CROSS-A-${RUN_ID}`,
        name: "Cross tenant attempt project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
      await expect(
        createProposalForProject(actor(companyAId), project.databaseId, {
          sourceType: "TECHNICAL_REPORT_REVISION",
          technicalReportId: otherReport.id,
          recipientEmail: "client@example.com",
          recipientName: "Client",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("blocks a role without proposals:manage from creating a technical report proposal", async () => {
      const { project, report } = await reportFixture("rbac");
      await expect(
        createProposalForProject(actor(companyAId, UserRole.DESIGNER), project.databaseId, {
          sourceType: "TECHNICAL_REPORT_REVISION",
          technicalReportId: report.id,
          recipientEmail: "client@example.com",
          recipientName: "Client",
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("rejects option selection on a technical-report-sourced proposal (BOQ-only feature)", async () => {
      const { project, report } = await reportFixture("options-blocked");
      const { proposal, rawToken } = await createProposalForProject(actor(companyAId), project.databaseId, {
        sourceType: "TECHNICAL_REPORT_REVISION",
        technicalReportId: report.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
      });
      await markProposalReadyForCompany(actor(companyAId), proposal.id);
      await markProposalSent(companyAId, proposal.id);
      await getPublicProposalView(rawToken!, req());

      await expect(
        selectProposalOption(rawToken!, { boqItemId: "00000000-0000-0000-0000-000000000000", optionId: null }, req()),
      ).rejects.toMatchObject({ code: "OPTIONS_NOT_ALLOWED" });
    });
  });

  describe("source type contract", () => {
    it("requires an explicit proposal type", async () => {
      const { project, boq } = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: "construction",
        reference: `PROP-TYPE-REQUIRED-${RUN_ID}`,
        name: "Type Required Project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
      await expect(
        createProposalForProject(actor(companyAId), project.databaseId, {
          boqId: boq.id,
          recipientEmail: "client@example.com",
          recipientName: "Client",
          documentIds: [],
        } as unknown as Parameters<typeof createProposalForProject>[2]),
      ).rejects.toMatchObject({ code: "PROPOSAL_TYPE_REQUIRED" });
    });

    it("the database CHECK constraint rejects a row with both a boqId and a technicalReportId set (defense in depth behind the service guard)", async () => {
      const { boq, documentId, project } = await fixture("check-constraint-both");
      const { report } = await reportFixture("check-constraint-both");
      const client = await prisma.client.findFirstOrThrow({ where: { id: clientAId, companyId: companyAId } });
      const { proposal } = await createProposal(companyAId, {
        sourceType: "BOQ_REVISION",
        projectId: project.databaseId,
        boqId: boq.id,
        revisionNumber: 1,
        clientId: client.id,
        recipientEmail: "client@example.com",
        recipientName: "Client",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        documentIds: [documentId],
        createdByUserId: actor(companyAId).userId,
        createdByName: "Test Actor",
      });
      // Points at a real report row (not a random UUID) so this specifically exercises the CHECK
      // constraint, not an incidental foreign-key failure on a nonexistent id.
      await expect(
        prisma.$executeRawUnsafe(`UPDATE "ClientProposal" SET "technicalReportId" = '${report.id}' WHERE id = '${proposal.id}'`),
      ).rejects.toThrow(/source_consistency_check/);
    });
  });
});
