import { BoqItemSourceType, DocumentTemplateType, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import {
  createBOQRevision,
  deleteBOQItem,
  getBOQ,
  lockBOQ,
  updateBOQ,
} from "../src/lib/repositories/boq-repository";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { runBOQVerification } from "../src/lib/repositories/verification-repository";
import { createTemplate } from "../src/lib/repositories/document-template-repository";
import { generateDocument, getDocumentForDownload } from "../src/lib/services/document-generation-service";
import { getGeneratedDocumentRecord } from "../src/lib/repositories/generated-document-repository";
import { localDocumentStorageAdapter } from "../src/lib/storage/local-document-storage-adapter";
import { LockedBOQError } from "../src/lib/domain/boq-guards";
import { NotFoundError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = `${Date.now()}-${process.pid}`;

/**
 * Real end-to-end coverage of the customer journey no existing test file
 * exercises as one flow: project -> BOQ -> manual item -> catalogue item ->
 * edit -> recalculate -> save -> refresh -> lock -> reject further mutation
 * -> new revision -> PDF -> secure download -> tenant isolation. Existing
 * files test most of the individual pieces (boq-calculator.test.ts for the
 * math, boq-lock-validation.test.ts for lock preconditions,
 * document-generation-service.test.ts for PDF/download) but never chain them
 * together against real created data the way a customer session actually
 * would, and none of them exercise addBoqItemFromSource's now-atomic
 * item+source-attribution write together with a real save/lock/revision/PDF
 * sequence.
 */
describe("BOQ core end-to-end workflow (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let clientAId: string;
  let templateAId: string;
  let ownerUserId: string;
  let masterItemId: string;
  let disciplineId: string;
  const cleanupStorageKeys: string[] = [];

  function ownerActor(): CurrentActor {
    return { userId: ownerUserId, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Workflow Owner", email: `workflow-owner-${RUN_ID}@example.com` };
  }
  function otherCompanyActor(): CurrentActor {
    return { userId: ownerUserId, companyId: companyBId, role: UserRole.COMPANY_OWNER, fullName: "Other Co Owner", email: `workflow-owner-b-${RUN_ID}@example.com` };
  }

  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: { legalName: `Workflow Co A ${RUN_ID}`, tradeName: "Workflow Co A", email: `workflow-a-${RUN_ID}@example.com`, address: "Dubai, UAE", taxRegistrationNumber: "100000000000099" },
    });
    companyAId = companyA.id;
    await grantUnlimitedPlanForTests(companyAId);

    const companyB = await prisma.company.create({
      data: { legalName: `Workflow Co B ${RUN_ID}`, tradeName: "Workflow Co B", email: `workflow-b-${RUN_ID}@example.com` },
    });
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyBId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyBId, industryEngineId: construction.id, enabled: true } });

    const owner = await prisma.user.create({
      data: { companyId: companyAId, email: `workflow-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Workflow Owner", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;

    const client = await createClient(companyAId, { name: "Workflow Client", email: `workflow-client-${RUN_ID}@example.com` });
    clientAId = client.id;

    const template = await createTemplate(companyAId, {
      name: "Workflow Corporate Technical",
      code: `workflow-corporate-technical-${RUN_ID}`,
      type: DocumentTemplateType.CORPORATE_TECHNICAL,
    });
    templateAId = template.id;

    const discipline = await prisma.masterDiscipline.create({ data: { key: `workflow-${RUN_ID}`, name: `Workflow Discipline ${RUN_ID}` } });
    disciplineId = discipline.id;
    const category = await prisma.masterCategory.create({ data: { disciplineId, key: "cat", name: "Category", path: "cat", depth: 0 } });
    const masterItem = await prisma.masterItem.create({
      data: { disciplineId, categoryId: category.id, itemCode: `WF-MASTER-${RUN_ID}`, name: "Workflow Master Item", shortDescription: "Concrete block, 200mm", defaultUnit: "m3", isPremium: false },
    });
    masterItemId = masterItem.id;
  });

  afterAll(async () => {
    for (const key of cleanupStorageKeys) {
      await localDocumentStorageAdapter.deleteObject(key).catch(() => undefined);
    }
    await prisma.masterItem.deleteMany({ where: { disciplineId } });
    await prisma.masterCategory.deleteMany({ where: { disciplineId } });
    await prisma.masterDiscipline.deleteMany({ where: { id: disciplineId } });
    await prisma.generatedDocument.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.documentTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.verificationException.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQRevisionSnapshot.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyItemUsage.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.client.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  it("runs the full customer journey: create -> add items -> edit -> lock -> revise -> generate PDF -> secure download -> tenant isolation", async () => {
    // 1. Project creation also creates the first BOQ revision (R01) atomically.
    const { project, boq: createdBoq } = await createProjectWithDefaultBoq(ownerActor(), {
      clientId: clientAId,
      industryEngineId: "construction",
      reference: `WF-${RUN_ID}`,
      name: "Workflow Test Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    expect(createdBoq.revision).toBe("R01");
    const boqId = createdBoq.databaseId;

    // 2. Opening the project's BOQ via the project's slug (the real browser URL shape).
    const openedByProject = await getBOQ(companyAId, boqId);
    expect(openedByProject.projectId).toBe(project.id); // project.id is the slug on the project DTO

    // 3. Add a manual item.
    const manualAdd = await addBoqItemFromSource(ownerActor(), boqId, {
      sourceType: BoqItemSourceType.MANUAL,
      itemNumber: 1,
      quantity: "4",
      overrides: {
        description: "Manual excavation work",
        unit: "m3",
        unitCost: 50,
        marginMode: "MARKUP",
        marginPercentage: 10,
      },
    });
    expect(manualAdd.item.sourceType).toBe(BoqItemSourceType.MANUAL);
    expect(manualAdd.item.quantity.toNumber()).toBe(4);
    // landedCost 50 * 1.10 markup = 55/unit selling rate, * qty 4 = 220
    expect(manualAdd.item.totalAmount.toNumber()).toBeCloseTo(220, 4);

    // 4. Add a catalogue (MASTER_ITEM) item — exercises the now-atomic
    // create+source-attribution write in one real request.
    const catalogueAdd = await addBoqItemFromSource(ownerActor(), boqId, {
      sourceType: BoqItemSourceType.MASTER_ITEM,
      sourceId: masterItemId,
      itemNumber: 2,
      quantity: "2",
      overrides: { unitCost: 300, marginPercentage: 20 },
    });
    expect(catalogueAdd.item.sourceType).toBe(BoqItemSourceType.MASTER_ITEM);
    expect(catalogueAdd.item.sourceMasterItemId).toBe(masterItemId);
    expect(catalogueAdd.item.masterItemSnapshotJson).not.toBeNull();
    expect(catalogueAdd.item.copiedByUserId).toBe(ownerUserId);
    // The master item itself must never be mutated by adding it to a BOQ.
    const untouchedMaster = await prisma.masterItem.findUniqueOrThrow({ where: { id: masterItemId } });
    expect(untouchedMaster.name).toBe("Workflow Master Item");

    // 5. Edit quantity/unit/rate on the manual item and save (the real
    // whole-document Save path the frontend actually uses).
    let current = await getBOQ(companyAId, boqId);
    const manualItemDto = current.sections.flatMap((s) => s.items).find((i) => i.id === manualAdd.item.id)!;
    manualItemDto.quantity = 6;
    manualItemDto.unitCost = 60;
    manualItemDto.unit = "m3";
    const saved = await updateBOQ(companyAId, boqId, current);

    // 6. Recalculation: line total, subtotal, tax, grand total all reflect
    // the edit — server-side, not the client's stale numbers.
    const savedManualItem = saved.sections.flatMap((s) => s.items).find((i) => i.id === manualAdd.item.id)!;
    expect(savedManualItem.quantity).toBe(6);
    expect(savedManualItem.unitCost).toBe(60);
    // 60 * 1.10 = 66/unit * qty 6 = 396
    expect(savedManualItem.totalAmount).toBeCloseTo(396, 4);
    const catalogueItemAfterSave = saved.sections.flatMap((s) => s.items).find((i) => i.id === catalogueAdd.item.id)!;
    // 300 * 1.20 = 360/unit * qty 2 = 720
    expect(catalogueItemAfterSave.totalAmount).toBeCloseTo(720, 4);
    const expectedSubtotal = 396 + 720;
    expect(saved.totals.subtotal).toBeCloseTo(expectedSubtotal, 4);
    const expectedTax = expectedSubtotal * 0.05;
    expect(saved.totals.taxAmount).toBeCloseTo(expectedTax, 4);
    expect(saved.totals.grandTotal).toBeCloseTo(expectedSubtotal + expectedTax, 4);

    // 7. Refresh: re-fetching independently returns the same persisted values.
    const refreshed = await getBOQ(companyAId, boqId);
    expect(refreshed.totals.grandTotal).toBeCloseTo(saved.totals.grandTotal, 4);
    expect(refreshed.sections.flatMap((s) => s.items).length).toBe(2);

    // 8. Lock the revision — requires a fresh verification pass first, same
    // as the real /lock route.
    await runBOQVerification(companyAId, boqId);
    const locked = await lockBOQ(companyAId, boqId, ownerActor().fullName, ownerUserId);
    expect(locked.status).toBe("locked");
    const lockedRecord = await prisma.bOQ.findUniqueOrThrow({ where: { id: boqId } });
    expect(lockedRecord.isLocked).toBe(true);
    expect(lockedRecord.lockedAt).not.toBeNull();
    expect(lockedRecord.lockedByUserId).toBe(ownerUserId);

    // 9. Locked revision rejects further mutation: adding an item, editing
    // via Save, and deleting an item must all be refused.
    await expect(
      addBoqItemFromSource(ownerActor(), boqId, { sourceType: BoqItemSourceType.MANUAL, itemNumber: 3, quantity: "1", overrides: { description: "should not be added", unit: "EA", unitCost: 1 } }),
    ).rejects.toThrow(LockedBOQError);
    await expect(updateBOQ(companyAId, boqId, refreshed)).rejects.toThrow(LockedBOQError);
    await expect(deleteBOQItem(companyAId, manualAdd.item.id)).rejects.toThrow(LockedBOQError);

    // 10. Create a new revision from the locked one — items are copied, the
    // new revision is sequential and editable, the locked one is untouched.
    const revision2 = await createBOQRevision(companyAId, boqId, ownerActor().fullName);
    expect(revision2.revision).toBe("R02");
    expect(revision2.status).not.toBe("locked");
    expect(revision2.sections.flatMap((s) => s.items).length).toBe(2);
    expect(revision2.totals.grandTotal).toBeCloseTo(saved.totals.grandTotal, 4);
    const stillLocked = await getBOQ(companyAId, boqId);
    expect(stillLocked.status).toBe("locked");
    expect(stillLocked.revision).toBe("R01");

    // 11. Generate a PDF tied to the locked R01 revision specifically (not
    // the new R02 draft).
    const pdfResult = await generateDocument(ownerActor(), project.databaseId, {
      boqId,
      templateId: templateAId,
      documentType: "PDF",
      audience: "CLIENT",
    });
    cleanupStorageKeys.push((await getGeneratedDocumentRecord(companyAId, pdfResult.id)).storageKey!);
    expect(pdfResult.status).toBe("COMPLETED");
    expect(pdfResult.isDraft).toBe(false);
    expect(pdfResult.mimeType).toBe("application/pdf");
    expect(pdfResult.fileSize).toBeGreaterThan(0);

    // 12. Secure download: real bytes, real PDF signature, non-empty.
    const download = await getDocumentForDownload(ownerActor(), pdfResult.id);
    expect(download.buffer.byteLength).toBeGreaterThan(0);
    expect(download.buffer.subarray(0, 5).toString()).toBe("%PDF-");

    // 13. Cross-tenant denial: another company cannot download this
    // document, and cannot see this project by its slug either.
    await expect(getDocumentForDownload(otherCompanyActor(), pdfResult.id)).rejects.toThrow(NotFoundError);
    await expect(getBOQ(companyBId, boqId)).rejects.toThrow(NotFoundError);
  });

  it("refuses to lock a revision with no items", async () => {
    const client = await createClient(companyAId, { name: "Empty Revision Client", email: `empty-rev-client-${RUN_ID}@example.com` });
    const { boq } = await createProjectWithDefaultBoq(ownerActor(), {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `WF-EMPTY-${RUN_ID}`,
      name: "Empty Revision Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    await runBOQVerification(companyAId, boq.databaseId);
    await expect(lockBOQ(companyAId, boq.databaseId, ownerActor().fullName, ownerUserId)).rejects.toMatchObject({ code: "BOQ_REVISION_EMPTY" });
  });
});
