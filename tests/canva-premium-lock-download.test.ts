import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import { BoqItemSourceType, DocumentTemplateType, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { lockBOQ } from "../src/lib/repositories/boq-repository";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { runBOQVerification } from "../src/lib/repositories/verification-repository";
import { createTemplate } from "../src/lib/repositories/document-template-repository";
import { generateDocument, getDocumentForDownload } from "../src/lib/services/document-generation-service";
import { getGeneratedDocumentRecord } from "../src/lib/repositories/generated-document-repository";
import { localDocumentStorageAdapter } from "../src/lib/storage/local-document-storage-adapter";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";
import { preserveIssuedEvidenceDuringCleanup } from "./helpers/preserve-issued-evidence";
import { acceptTrialTerms, startTrial } from "../src/lib/entitlements/entitlement-service";

/**
 * VERIFY-CANVA-PREMIUM-LOCK-DOWNLOAD — real reproduction, real local
 * Postgres, real PDF/DOCX bytes. No prior test exercised generateDocument()
 * (the actual download-route service function) with a genuinely premium,
 * unlicensed MasterItem — the only existing coverage
 * (tests/commercial-entitlement-service.test.ts) calls
 * assertCleanOutputAuthorized() directly, and boq-core-workflow.test.ts's
 * generateDocument() coverage deliberately uses isPremium: false. This file
 * closes that gap and proves, with a real generated file (not the preview
 * route), whether the lock and the trial watermark actually work.
 */
const RUN_ID = `${Date.now()}-${process.pid}-lock`;

describe("VERIFY: premium item clean-output lock + trial watermark (integration, real local Postgres)", () => {
  let disciplineId: string;
  let categoryId: string;
  const cleanupCompanyIds: string[] = [];
  const cleanupPackageIds: string[] = [];
  const cleanupMasterItemIds: string[] = [];
  const cleanupStorageKeys: string[] = [];

  // DocumentTemplate is company-scoped (getTemplate(actor.companyId, ...)
  // inside generateDocument() enforces tenant isolation), so each company
  // fixture needs its own template — sharing one across companies would
  // 404 for every company but the one that created it.
  async function seedCompanyWithUser(label: string) {
    const company = await prisma.company.create({
      data: { legalName: `Lock Test Co ${label} ${RUN_ID}`, tradeName: `Lock ${label}`, email: `lock-${label}-${RUN_ID}@example.com`, address: "Dubai, UAE", country: "UAE", taxRegistrationNumber: "100000000000003" },
    });
    cleanupCompanyIds.push(company.id);
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: company.id, industryEngineId: construction.id, enabled: true } });
    const client = await createClient(company.id, { name: `Client ${label}`, email: `lock-client-${label}-${RUN_ID}@example.com` });
    const user = await prisma.user.create({
      data: { companyId: company.id, email: `lock-owner-${label}-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Lock Test Owner", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    const template = await createTemplate(company.id, {
      name: `Lock Test Template ${label}`,
      code: `lock-test-template-${RUN_ID}-${label}`,
      type: DocumentTemplateType.CORPORATE_TECHNICAL,
    });
    const actor: CurrentActor = { userId: user.id, companyId: company.id, role: UserRole.COMPANY_OWNER, fullName: "Lock Test Owner", email: user.email };
    return { companyId: company.id, clientId: client.id, actor, templateId: template.id };
  }

  beforeAll(async () => {
    const discipline = await prisma.masterDiscipline.findFirstOrThrow();
    disciplineId = discipline.id;
    const category = await prisma.masterCategory.findFirstOrThrow({ where: { disciplineId } });
    categoryId = category.id;
  });

  afterAll(async () => {
    for (const key of cleanupStorageKeys) {
      await localDocumentStorageAdapter.deleteObject(key).catch(() => undefined);
    }
    // Two of the three tests lock a BOQ revision, which writes real,
    // intentionally-immutable governed evidence rows (same DB-level
    // protection production relies on) — row-by-row teardown must not try
    // to bypass that. Same guard as boq-core-workflow.test.ts.
    if (await preserveIssuedEvidenceDuringCleanup(cleanupCompanyIds)) {
      await prisma.$disconnect();
      return;
    }
    await prisma.generatedDocument.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.documentTemplate.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.verificationException.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.companyPackageSubscription.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.industryDataPackageItem.deleteMany({ where: { packageId: { in: cleanupPackageIds } } });
    await prisma.masterItem.deleteMany({ where: { id: { in: cleanupMasterItemIds } } });
    await prisma.industryDataPackage.deleteMany({ where: { id: { in: cleanupPackageIds } } });
    await prisma.companyItemUsage.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.project.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.client.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.user.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: cleanupCompanyIds } } });
    await prisma.$disconnect();
  });

  it("blocks PDF and DOCX (WITH_PRICES) clean-output generation for a company with no subscription to the premium item's package — and creates no GeneratedDocument row at all", async () => {
    const { companyId, clientId, actor, templateId } = await seedCompanyWithUser("blocked");
    await grantUnlimitedPlanForTests(companyId); // isolates this test to ONLY the premium-item gate, not the trial export-count gate

    const pkg = await prisma.industryDataPackage.create({
      data: { key: `lock-test-pkg-${RUN_ID}-blocked`, name: "Lock Test Package", disciplineId, packageType: "SPECIALIST", monthlyPrice: 0 },
    });
    cleanupPackageIds.push(pkg.id);
    const premiumItem = await prisma.masterItem.create({
      data: { disciplineId, categoryId, itemCode: `LOCK-BLOCKED-${RUN_ID}`, name: "Lock Test Premium Item", defaultUnit: "nos", isPremium: true, status: "ACTIVE" },
    });
    cleanupMasterItemIds.push(premiumItem.id);
    await prisma.industryDataPackageItem.create({ data: { packageId: pkg.id, masterItemId: premiumItem.id, sortOrder: 0 } });

    const noSubscription = await prisma.companyPackageSubscription.count({ where: { companyId, packageId: pkg.id, status: "ACTIVE" } });
    expect(noSubscription).toBe(0); // confirms the reproduction precondition the mission asks for

    const { project, boq } = await createProjectWithDefaultBoq(actor, {
      clientId, industryEngineId: "construction", reference: `LOCK-BLOCKED-${RUN_ID}`, name: "Lock Blocked Test", location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    await addBoqItemFromSource(actor, boq.databaseId, { sourceType: BoqItemSourceType.MASTER_ITEM, sourceId: premiumItem.id, itemNumber: 1, quantity: "2", overrides: { unitCost: 100, marginPercentage: 10 } });

    const documentCountBefore = await prisma.generatedDocument.count({ where: { companyId } });

    let pdfError: unknown;
    try {
      await generateDocument(actor, project.databaseId, { boqId: boq.databaseId, templateId, documentType: "PDF", audience: "CLIENT", pricingMode: "WITH_PRICES" });
    } catch (error) {
      pdfError = error;
    }
    expect(pdfError).toMatchObject({ code: "COMMERCIAL_UNLOCK_REQUIRED", status: 403 });

    let docxError: unknown;
    try {
      await generateDocument(actor, project.databaseId, { boqId: boq.databaseId, templateId, documentType: "DOCX", audience: "CLIENT", pricingMode: "WITH_PRICES" });
    } catch (error) {
      docxError = error;
    }
    expect(docxError).toMatchObject({ code: "COMMERCIAL_UNLOCK_REQUIRED", status: 403 });

    // The real proof "no file downloaded": no GeneratedDocument row was
    // ever created for either attempt — nothing exists to download.
    const documentCountAfter = await prisma.generatedDocument.count({ where: { companyId } });
    expect(documentCountAfter).toBe(documentCountBefore);
  });

  it("allows clean PDF generation once the company holds an active subscription to the premium item's package (positive control — the gate isn't just always-on)", async () => {
    const { companyId, clientId, actor, templateId } = await seedCompanyWithUser("allowed");
    await grantUnlimitedPlanForTests(companyId);

    const pkg = await prisma.industryDataPackage.create({
      data: { key: `lock-test-pkg-${RUN_ID}-allowed`, name: "Lock Test Package Allowed", disciplineId, packageType: "SPECIALIST", monthlyPrice: 0 },
    });
    cleanupPackageIds.push(pkg.id);
    const premiumItem = await prisma.masterItem.create({
      data: { disciplineId, categoryId, itemCode: `LOCK-ALLOWED-${RUN_ID}`, name: "Lock Test Premium Item Allowed", defaultUnit: "nos", isPremium: true, status: "ACTIVE" },
    });
    cleanupMasterItemIds.push(premiumItem.id);
    await prisma.industryDataPackageItem.create({ data: { packageId: pkg.id, masterItemId: premiumItem.id, sortOrder: 0 } });
    await prisma.companyPackageSubscription.create({ data: { companyId, packageId: pkg.id, status: "ACTIVE", startsAt: new Date(), expiresAt: null, source: "test-fixture" } });

    const { project, boq } = await createProjectWithDefaultBoq(actor, {
      clientId, industryEngineId: "construction", reference: `LOCK-ALLOWED-${RUN_ID}`, name: "Lock Allowed Test", location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    await addBoqItemFromSource(actor, boq.databaseId, { sourceType: BoqItemSourceType.MASTER_ITEM, sourceId: premiumItem.id, itemNumber: 1, quantity: "2", overrides: { unitCost: 100, marginPercentage: 10 } });

    // PDF is FINAL_ONLY_TYPES — requires a locked revision (same requirement
    // the blocked test never needed to reach, since it fails on the earlier
    // premium-item gate before this one would even matter).
    await runBOQVerification(companyId, boq.databaseId);
    await lockBOQ(companyId, boq.databaseId, actor.fullName, actor.userId);

    const result = await generateDocument(actor, project.databaseId, { boqId: boq.databaseId, templateId, documentType: "PDF", audience: "CLIENT", pricingMode: "WITH_PRICES" });
    cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyId, result.id)).storageKey!);
    expect(result.status).toBe("COMPLETED");

    const download = await getDocumentForDownload(actor, result.id);
    expect(download.buffer.byteLength).toBeGreaterThan(0);
    expect(download.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  async function seedTrialCompanyWithLockedBoq(label: string) {
    const { companyId, clientId, actor, templateId } = await seedCompanyWithUser(label);
    // Deliberately NOT calling grantUnlimitedPlanForTests. Real finding from
    // reproduction: a company with NO CompanySoftwareSubscription row at all
    // is NOT "on trial" — getCompanyEntitlements (entitlement-service.ts)
    // returns isTrial: false, planType: FREE for that case; "trial" is a
    // real, explicit subscription row with status: TRIAL, only created by
    // startTrial(). So applyTrialWatermark only engages after the actual
    // customer trial-activation flow: accept terms, then start the trial.
    await acceptTrialTerms(actor);
    await startTrial(actor);

    const plainItem = await prisma.masterItem.create({
      data: { disciplineId, categoryId, itemCode: `WATERMARK-${label}-${RUN_ID}`, name: "Watermark Test Item", defaultUnit: "nos", isPremium: false, status: "ACTIVE" },
    });
    cleanupMasterItemIds.push(plainItem.id);

    const { project, boq } = await createProjectWithDefaultBoq(actor, {
      clientId, industryEngineId: "construction", reference: `WATERMARK-${label}-${RUN_ID}`, name: "Watermark Test", location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    await addBoqItemFromSource(actor, boq.databaseId, { sourceType: BoqItemSourceType.MASTER_ITEM, sourceId: plainItem.id, itemNumber: 1, quantity: "2", overrides: { unitCost: 100, marginPercentage: 10 } });

    // Must be a locked (non-draft) revision — applyTrialWatermark is false for drafts.
    await runBOQVerification(companyId, boq.databaseId);
    await lockBOQ(companyId, boq.databaseId, actor.fullName, actor.userId);

    return { companyId, actor, project, boq, templateId };
  }

  // A trial company gets exactly ONE final (non-draft) export total
  // (TRIAL_LIMITS.maxFinalExports === 1, entitlement-service.ts) — confirmed
  // real, correct product behavior via reproduction (a second generateDocument
  // call on the same trial company throws TRIAL_EXPORT_LIMIT_REACHED). So PDF
  // and DOCX watermark checks each need their own freshly-activated trial
  // company rather than sharing one company's single allowed export.

  it("burns the real trial watermark into the actual PDF bytes for a first, non-draft (locked) export on trial — not just the preview route", async () => {
    const { companyId, actor, project, boq, templateId } = await seedTrialCompanyWithLockedBoq("watermark-pdf");

    const pdfResult = await generateDocument(actor, project.databaseId, { boqId: boq.databaseId, templateId, documentType: "PDF", audience: "CLIENT", pricingMode: "WITH_PRICES" });
    cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyId, pdfResult.id)).storageKey!);
    expect(pdfResult.status).toBe("COMPLETED");
    expect(pdfResult.isDraft).toBe(false);

    const pdfDownload = await getDocumentForDownload(actor, pdfResult.id);
    const parsed = await new PDFParse({ data: pdfDownload.buffer }).getText();
    // pdf-parse's positional line-reconstruction inserts a line break where
    // the rotated (-40deg) watermark's bounding box crosses its own
    // heuristic line boundary — the real text is one continuous run in the
    // PDF (confirmed by inspecting the raw dump), this just normalizes that
    // extraction artifact rather than loosening what's actually asserted.
    const normalizedPdfText = parsed.text.replace(/\s+/g, " ");
    expect(normalizedPdfText).toContain("Generated with Quantara — Trial Version");
  });

  it("burns the real trial watermark into the actual DOCX bytes for a first, non-draft (locked) export on trial — not just the preview route", async () => {
    const { companyId, actor, project, boq, templateId } = await seedTrialCompanyWithLockedBoq("watermark-docx");

    const docxResult = await generateDocument(actor, project.databaseId, { boqId: boq.databaseId, templateId, documentType: "DOCX", audience: "CLIENT", pricingMode: "WITH_PRICES" });
    cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyId, docxResult.id)).storageKey!);
    expect(docxResult.status).toBe("COMPLETED");
    expect(docxResult.isDraft).toBe(false);

    const docxDownload = await getDocumentForDownload(actor, docxResult.id);
    const zip = await JSZip.loadAsync(docxDownload.buffer);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const footerFiles = Object.keys(zip.files).filter((name) => name.startsWith("word/footer"));
    const footerXmls = await Promise.all(footerFiles.map((name) => zip.file(name)!.async("string")));
    const allDocxText = documentXml + footerXmls.join("");
    expect(allDocxText).toContain("Generated with Quantara");
    expect(allDocxText).toContain("Trial Version");
  });
});
