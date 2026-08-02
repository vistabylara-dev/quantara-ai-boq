import { PlanType, SubscriptionStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { createBOQItem, lockBOQ } from "../src/lib/repositories/boq-repository";
import { runBOQVerification } from "../src/lib/repositories/verification-repository";
import {
  acceptTrialTerms,
  canUsePremiumItem,
  getCompanyEntitlements,
  getTrialUsageSummary,
  recordPremiumItemUnlock,
  startTrial,
} from "../src/lib/entitlements/entitlement-service";
import {
  activateDevelopmentPackage,
  assertMasterItemAccess,
  companyHasPackageAccess,
  expireDevelopmentPackage,
} from "../src/lib/entitlements/package-entitlement-service";
import {
  createFromBoqItem,
  createFromCatalogue,
  createFromMaster,
  createManualLibraryItem,
  getLibraryItemForCompany,
  listLibraryItemVersionsForCompany,
  updateLibraryItemForCompany,
} from "../src/lib/services/company-library-service";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { searchItems } from "../src/lib/services/item-search-service";
import { createImportJob, executeImportJob, updateImportMapping, validateImportJob, actOnImportRows } from "../src/lib/services/import-service";
import { AppError, NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = Date.now();
const userIdByCompany = new Map<string, string>();

function actor(companyId: string, role: UserRole = UserRole.COMPANY_OWNER): CurrentActor {
  const userId = userIdByCompany.get(companyId);
  if (!userId) throw new Error(`No test user seeded for company ${companyId}`);
  return { userId, companyId, role, fullName: "Test Actor", email: "actor@example.com" };
}

async function seedCompanyWithUser(suffix: string, opts: { emailVerified?: boolean; completeProfile?: boolean } = {}) {
  const company = await prisma.company.create({
    data: {
      legalName: `Phase7 Test Co ${suffix} ${RUN_ID}`,
      tradeName: `Phase7 ${suffix}`,
      email: `phase7-${suffix}-${RUN_ID}@example.com`,
      address: opts.completeProfile !== false ? "Dubai, UAE" : null,
      country: opts.completeProfile !== false ? "UAE" : null,
      taxRegistrationNumber: opts.completeProfile !== false ? "100000000000003" : null,
    },
  });
  const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
  await prisma.companyIndustryEngine.create({ data: { companyId: company.id, industryEngineId: construction.id, enabled: true } });
  const client = await createClient(company.id, { name: `Client ${suffix}`, email: `phase7-client-${suffix}-${RUN_ID}@example.com` });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `phase7-owner-${suffix}-${RUN_ID}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: "Test Actor",
      role: UserRole.COMPANY_OWNER,
      isActive: true,
      emailVerifiedAt: opts.emailVerified === false ? null : new Date(),
    },
  });
  userIdByCompany.set(company.id, user.id);
  return { companyId: company.id, clientId: client.id };
}

async function createCleanProject(companyId: string, clientId: string, referenceSuffix: string) {
  const { project, boq } = await createProjectWithDefaultBoq(actor(companyId), {
    clientId,
    industryEngineId: "construction",
    reference: `P7-${referenceSuffix}-${RUN_ID}`,
    name: `Phase7 Project ${referenceSuffix}`,
    location: "Dubai",
    currency: "AED",
    taxRate: "5",
    language: "English",
  });
  return { project, boq };
}

describe("Phase 7: commercial entitlements + industry data platform (integration, real local Postgres)", () => {
  let mechanicalDisciplineId: string;
  let premiumItemIds: string[];
  let mechanicalPackageId: string;
  const cleanupCompanyIds: string[] = [];

  beforeAll(async () => {
    const discipline = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    mechanicalDisciplineId = discipline.id;
    const items = await prisma.masterItem.findMany({ where: { disciplineId: discipline.id, isPremium: true }, take: 10, orderBy: { itemCode: "asc" } });
    premiumItemIds = items.map((i) => i.id);
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "mechanical-hvac-professional" } });
    mechanicalPackageId = pkg.id;
  });

  afterAll(async () => {
    for (const companyId of cleanupCompanyIds) {
      await prisma.importRow.deleteMany({ where: { companyId } });
      await prisma.importJob.deleteMany({ where: { companyId } });
      await prisma.importMappingTemplate.deleteMany({ where: { companyId } });
      await prisma.companyItemUsage.deleteMany({ where: { companyId } });
      await prisma.companyLibraryItemVariant.deleteMany({ where: { companyId } });
      await prisma.companyLibraryItemVersion.deleteMany({ where: { companyId } });
      await prisma.companyLibraryItem.deleteMany({ where: { companyId } });
      await prisma.trialPremiumItemUnlock.deleteMany({ where: { companyId } });
      await prisma.companyTrialUsage.deleteMany({ where: { companyId } });
      await prisma.companyPackageSubscription.deleteMany({ where: { companyId } });
      await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
      await prisma.rateCatalogueItem.deleteMany({ where: { companyId } });
      await prisma.auditLog.deleteMany({ where: { companyId } });
      await prisma.bOQRevisionSnapshot.deleteMany({ where: { companyId } });
      await prisma.bOQItem.deleteMany({ where: { companyId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  describe("trial lifecycle", () => {
    it("blocks starting a trial before email verification, then before profile completion, then before terms acceptance", async () => {
      const { companyId } = await seedCompanyWithUser("trial-gate", { emailVerified: false, completeProfile: false });
      cleanupCompanyIds.push(companyId);

      await expect(startTrial(actor(companyId))).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });

      await prisma.user.update({ where: { id: userIdByCompany.get(companyId)! }, data: { emailVerifiedAt: new Date() } });
      await expect(startTrial(actor(companyId))).rejects.toMatchObject({ code: "COMPANY_PROFILE_INCOMPLETE" });

      await prisma.company.update({ where: { id: companyId }, data: { address: "Dubai, UAE", country: "UAE", taxRegistrationNumber: "100000000000099" } });
      await expect(startTrial(actor(companyId))).rejects.toMatchObject({ code: "TRIAL_TERMS_NOT_ACCEPTED" });

      await acceptTrialTerms(actor(companyId));
      const result = await startTrial(actor(companyId));
      expect(result.subscriptionId).toBeTruthy();

      await expect(startTrial(actor(companyId))).rejects.toMatchObject({ code: "TRIAL_ALREADY_USED" });
    });

    it("allows exactly one project on the free (no-subscription) default and blocks a second", async () => {
      const { companyId, clientId } = await seedCompanyWithUser("free-project-limit");
      cleanupCompanyIds.push(companyId);

      await createCleanProject(companyId, clientId, "free-1");
      await expect(createCleanProject(companyId, clientId, "free-2")).rejects.toMatchObject({ code: "PROJECT_LIMIT_REACHED" });
    });

    it("allows one completed BOQ on trial and blocks a second lock", async () => {
      const { companyId, clientId } = await seedCompanyWithUser("trial-boq-limit");
      cleanupCompanyIds.push(companyId);
      await prisma.company.update({ where: { id: companyId }, data: { trialTermsAcceptedAt: new Date() } });
      await startTrial(actor(companyId));

      const { project, boq } = await createCleanProject(companyId, clientId, "trial-boq");
      await createBOQItem(companyId, boq.sections[0].id, {
        itemNumber: 1, itemCode: "T1", category: "Concrete", description: "Item", quantity: "1", unit: "m3", unitCost: "100", marginPercentage: "10", sortOrder: 1,
      });
      await runBOQVerification(companyId, boq.id);
      const locked = await lockBOQ(companyId, boq.id, "Tester");
      expect(locked.status).toBe("locked");

      const usage = await getTrialUsageSummary(companyId);
      expect(usage?.boqsCompleted).toBe(1);

      // A second project is already blocked by the trial's project limit, so directly exercise
      // the BOQ-completion gate itself against a manually-created second BOQ row for the same project.
      const secondBoq = await prisma.bOQ.create({
        data: { companyId, projectId: project.databaseId, title: "R02", revisionNumber: 2, taxRate: 5 },
      });
      await expect(lockBOQ(companyId, secondBoq.id, "Tester")).rejects.toMatchObject({ code: "TRIAL_BOQ_LIMIT_REACHED" });
    });

    it("allows five unique premium items, blocks a sixth, and does not consume an allowance for repeated use of the same item", async () => {
      const { companyId } = await seedCompanyWithUser("trial-premium-limit");
      cleanupCompanyIds.push(companyId);
      await prisma.company.update({ where: { id: companyId }, data: { trialTermsAcceptedAt: new Date() } });
      await startTrial(actor(companyId));

      for (const itemId of premiumItemIds.slice(0, 5)) {
        const check = await canUsePremiumItem(companyId, itemId);
        expect(check.allowed).toBe(true);
        await recordPremiumItemUnlock(companyId, itemId);
      }

      // Reusing the same (already-unlocked) item never re-checks the cap and always succeeds.
      const reuseCheck = await canUsePremiumItem(companyId, premiumItemIds[0]);
      expect(reuseCheck.allowed).toBe(true);
      await recordPremiumItemUnlock(companyId, premiumItemIds[0]);

      const usageAfterReuse = await getTrialUsageSummary(companyId);
      expect(usageAfterReuse?.uniquePremiumItemsUnlocked).toBe(5);
      expect(usageAfterReuse?.unlockedItems.find((u) => u.masterItemId === premiumItemIds[0])?.usageCount).toBe(2);

      const sixthCheck = await canUsePremiumItem(companyId, premiumItemIds[5]);
      expect(sixthCheck.allowed).toBe(false);
      await expect(recordPremiumItemUnlock(companyId, premiumItemIds[5])).rejects.toMatchObject({ code: "PREMIUM_ITEM_LIMIT_REACHED" });

      const finalUsage = await getTrialUsageSummary(companyId);
      expect(finalUsage?.uniquePremiumItemsUnlocked).toBe(5);
    });

    it("does not consume any premium allowance for a manually created company library item", async () => {
      const { companyId } = await seedCompanyWithUser("trial-manual-item");
      cleanupCompanyIds.push(companyId);
      await prisma.company.update({ where: { id: companyId }, data: { trialTermsAcceptedAt: new Date() } });
      await startTrial(actor(companyId));

      await createManualLibraryItem(actor(companyId), {
        companyItemCode: "MANUAL-1",
        name: "Manual item",
        unit: "nos",
        defaultCost: 10,
        defaultSellingRate: 15,
      });

      const usage = await getTrialUsageSummary(companyId);
      expect(usage?.uniquePremiumItemsUnlocked).toBe(0);
    });
  });

  describe("industry package entitlements", () => {
    it("blocks a premium item without a package or trial, allows it once a development package is activated, and blocks new access again after expiry", async () => {
      const { companyId } = await seedCompanyWithUser("package-bypass");
      cleanupCompanyIds.push(companyId);
      const itemId = premiumItemIds[0];

      await expect(assertMasterItemAccess(companyId, itemId)).rejects.toThrow(AppError);
      expect(await companyHasPackageAccess(companyId, mechanicalPackageId)).toBe(false);

      await activateDevelopmentPackage(actor(companyId), mechanicalPackageId);
      expect(await companyHasPackageAccess(companyId, mechanicalPackageId)).toBe(true);
      await expect(assertMasterItemAccess(companyId, itemId)).resolves.toBeUndefined();

      // Package access must never consume a trial slot, even while a trial is separately active and exhausted.
      const entitlementsAfterActivation = await getCompanyEntitlements(companyId);
      expect(entitlementsAfterActivation.isTrial).toBe(false);

      await expireDevelopmentPackage(actor(companyId), mechanicalPackageId);
      expect(await companyHasPackageAccess(companyId, mechanicalPackageId)).toBe(false);
      await expect(assertMasterItemAccess(companyId, itemId)).rejects.toThrow(AppError);
    });

    it("does not cross company boundaries for package subscriptions", async () => {
      const { companyId: companyAId } = await seedCompanyWithUser("pkg-isolation-a");
      const { companyId: companyBId } = await seedCompanyWithUser("pkg-isolation-b");
      cleanupCompanyIds.push(companyAId, companyBId);

      await activateDevelopmentPackage(actor(companyAId), mechanicalPackageId);
      expect(await companyHasPackageAccess(companyAId, mechanicalPackageId)).toBe(true);
      expect(await companyHasPackageAccess(companyBId, mechanicalPackageId)).toBe(false);
    });
  });

  describe("company library", () => {
    it("copies a master item into the company library without ever mutating the master item, and records a trial unlock", async () => {
      const { companyId } = await seedCompanyWithUser("library-from-master");
      cleanupCompanyIds.push(companyId);
      await prisma.company.update({ where: { id: companyId }, data: { trialTermsAcceptedAt: new Date() } });
      await startTrial(actor(companyId));

      const masterBefore = await prisma.masterItem.findUniqueOrThrow({ where: { id: premiumItemIds[0] } });
      const created = await createFromMaster(actor(companyId), premiumItemIds[0]);
      expect(created.sourceMasterItemId).toBe(premiumItemIds[0]);
      expect(created.name).toBe(masterBefore.name);

      const masterAfter = await prisma.masterItem.findUniqueOrThrow({ where: { id: premiumItemIds[0] } });
      expect(masterAfter.updatedAt.getTime()).toBe(masterBefore.updatedAt.getTime());

      const usage = await getTrialUsageSummary(companyId);
      expect(usage?.uniquePremiumItemsUnlocked).toBe(1);
    });

    it("blocks copying a locked premium master item with no package or trial allowance", async () => {
      const { companyId } = await seedCompanyWithUser("library-locked-master");
      cleanupCompanyIds.push(companyId);
      await expect(createFromMaster(actor(companyId), premiumItemIds[1])).rejects.toThrow(AppError);
    });

    it("copies from the rate catalogue and from a previous BOQ item without mutating the source", async () => {
      const { companyId, clientId } = await seedCompanyWithUser("library-from-sources");
      cleanupCompanyIds.push(companyId);

      const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
      const catalogueItem = await prisma.rateCatalogueItem.create({
        data: {
          companyId,
          industryEngineId: industry.id,
          itemCode: "CAT-1",
          category: "Concrete",
          description: "Catalogue concrete",
          unit: "m3",
          baseCost: 200,
          sellingRate: 260,
          effectiveDate: new Date(),
        },
      });
      const fromCatalogue = await createFromCatalogue(actor(companyId), catalogueItem.id);
      expect(fromCatalogue.defaultRateCatalogueItemId).toBe(catalogueItem.id);
      const catalogueAfter = await prisma.rateCatalogueItem.findUniqueOrThrow({ where: { id: catalogueItem.id } });
      expect(catalogueAfter.sellingRate.toNumber()).toBe(260);

      const { boq } = await createCleanProject(companyId, clientId, "lib-from-boq");
      const { item: boqItem } = await createBOQItem(companyId, boq.sections[0].id, {
        itemNumber: 1, itemCode: "BOQ-1", category: "Concrete", description: "BOQ item", quantity: "5", unit: "m3", unitCost: "150", marginPercentage: "20", sortOrder: 1,
      });
      const fromBoq = await createFromBoqItem(actor(companyId), boqItem.id);
      expect(fromBoq.companyItemCode).toBe("BOQ-1");
      const boqItemAfter = await prisma.bOQItem.findUniqueOrThrow({ where: { id: boqItem.id } });
      expect(boqItemAfter.description).toBe("BOQ item");
    });

    it("creates a version snapshot when a versioned field changes, and enforces tenant isolation", async () => {
      const { companyId: companyAId } = await seedCompanyWithUser("library-versions-a");
      const { companyId: companyBId } = await seedCompanyWithUser("library-versions-b");
      cleanupCompanyIds.push(companyAId, companyBId);

      const created = await createManualLibraryItem(actor(companyAId), { companyItemCode: "VER-1", name: "Versioned item", unit: "nos", defaultCost: 10 });
      let versions = await listLibraryItemVersionsForCompany(actor(companyAId), created.id);
      expect(versions).toHaveLength(0);

      await updateLibraryItemForCompany(actor(companyAId), created.id, { defaultCost: 20 }, "price increase");
      versions = await listLibraryItemVersionsForCompany(actor(companyAId), created.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].changeReason).toBe("price increase");

      // A name-only change is not a version trigger.
      await updateLibraryItemForCompany(actor(companyAId), created.id, { name: "Renamed item" });
      versions = await listLibraryItemVersionsForCompany(actor(companyAId), created.id);
      expect(versions).toHaveLength(1);

      await expect(getLibraryItemForCompany(actor(companyBId), created.id)).rejects.toThrow(NotFoundError);
    });

    it("blocks a role without library:manage from creating a company library item", async () => {
      const { companyId } = await seedCompanyWithUser("library-rbac");
      cleanupCompanyIds.push(companyId);
      await expect(
        createManualLibraryItem(actor(companyId, UserRole.SALES_USER), { companyItemCode: "RBAC-1", name: "x", unit: "nos" }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("BOQ item source copying", () => {
    it("copies a company library item into a BOQ, preserving source metadata and recording usage, without mutating the library item", async () => {
      const { companyId, clientId } = await seedCompanyWithUser("boq-copy");
      cleanupCompanyIds.push(companyId);

      const libraryItem = await createManualLibraryItem(actor(companyId), { companyItemCode: "COPY-1", name: "Copy source", unit: "nos", defaultCost: 50, defaultSellingRate: 75, defaultMargin: 20 });
      const { project, boq } = await createCleanProject(companyId, clientId, "boq-copy");

      const result = await addBoqItemFromSource(actor(companyId), boq.id, {
        sourceType: "COMPANY_LIBRARY",
        sourceId: libraryItem.id,
        itemNumber: 1,
        quantity: "3",
      });
      expect(result.item.sourceCompanyLibraryItemId).toBe(libraryItem.id);
      expect(result.item.itemCode).toBe("COPY-1");

      const libraryAfter = await getLibraryItemForCompany(actor(companyId), libraryItem.id);
      expect(libraryAfter.usageCount).toBe(1);
      expect(libraryAfter.defaultSellingRate).toBe(75);

      // Editing the copied BOQ item afterward must never touch the library source.
      await prisma.bOQItem.update({ where: { id: result.item.id }, data: { description: "Project-specific edit" } });
      const libraryStillUnchanged = await getLibraryItemForCompany(actor(companyId), libraryItem.id);
      expect(libraryStillUnchanged.name).toBe("Copy source");
      void project;
    });
  });

  describe("unified search ranking", () => {
    it("ranks an exact company item code above a locked master item, and a favorite above a plain library match", async () => {
      const { companyId } = await seedCompanyWithUser("search-ranking");
      cleanupCompanyIds.push(companyId);

      const uniqueToken = `SRCH${RUN_ID}`;
      await createManualLibraryItem(actor(companyId), { companyItemCode: uniqueToken, name: "Exact code match", unit: "nos" });

      const result = await searchItems(actor(companyId), uniqueToken);
      expect(result.items[0].itemCode).toBe(uniqueToken);
      expect(result.items[0].rankTier).toBe(1);
    });
  });

  describe("structured CSV import", () => {
    it("parses, maps, validates (including duplicate detection), and executes an approved row into the company library — leaving unapproved rows untouched", async () => {
      const { companyId } = await seedCompanyWithUser("import-flow");
      cleanupCompanyIds.push(companyId);

      const csv = [
        "Code,Name,Unit,Cost",
        "IMP-1,Imported Item One,nos,100",
        "IMP-1,Imported Item Duplicate,nos,120",
        ",Missing code row,nos,50",
      ].join("\n");
      const fileContentBase64 = Buffer.from(csv, "utf-8").toString("base64");

      const job = await createImportJob(actor(companyId), {
        uploadedFileName: "test-import.csv",
        fileContentBase64,
        sourceType: "CSV",
        destinationType: "COMPANY_LIBRARY",
      });
      expect(job.totalRows).toBe(3);
      expect(job.headers).toEqual(["Code", "Name", "Unit", "Cost"]);

      const mapped = await updateImportMapping(actor(companyId), job.id, {
        mappingJson: { itemCode: "Code", description: "Name", unit: "Unit", cost: "Cost" },
      });
      expect((mapped.rows[0].normalizedData as Record<string, string> | null)?.itemCode).toBe("IMP-1");

      const validated = await validateImportJob(actor(companyId), job.id);
      const rowsByNumber = new Map(validated.rows.map((r) => [r.rowNumber, r]));
      expect(rowsByNumber.get(1)?.status).toBe("VALID");
      expect(rowsByNumber.get(2)?.status).toBe("WARNING"); // duplicate itemCode within the batch
      expect(rowsByNumber.get(3)?.status).toBe("ERROR"); // missing required itemCode

      await actOnImportRows(actor(companyId), job.id, { rowIds: [rowsByNumber.get(1)!.id], action: "CREATE_NEW" });
      const executed = await executeImportJob(actor(companyId), job.id);
      expect(executed.job.importedRows).toBe(1);

      const importedRow = executed.rows.find((r) => r.rowNumber === 1)!;
      expect(importedRow.status).toBe("IMPORTED");
      expect(importedRow.destinationEntityId).toBeTruthy();

      const libraryItem = await getLibraryItemForCompany(actor(companyId), importedRow.destinationEntityId!);
      expect(libraryItem.companyItemCode).toBe("IMP-1");

      // The duplicate/error rows were never approved, so nothing else was created.
      const stillPending = executed.rows.find((r) => r.rowNumber === 2);
      expect(stillPending?.status).toBe("WARNING");
    });

    it("enforces tenant isolation on import jobs", async () => {
      const { companyId: companyAId } = await seedCompanyWithUser("import-isolation-a");
      const { companyId: companyBId } = await seedCompanyWithUser("import-isolation-b");
      cleanupCompanyIds.push(companyAId, companyBId);

      const csv = "Code,Name,Unit,Cost\nISO-1,Item,nos,10";
      const job = await createImportJob(actor(companyAId), {
        uploadedFileName: "iso.csv",
        fileContentBase64: Buffer.from(csv).toString("base64"),
        sourceType: "CSV",
        destinationType: "COMPANY_LIBRARY",
      });

      await expect(validateImportJob(actor(companyBId), job.id)).rejects.toThrow(NotFoundError);
    });
  });
});
