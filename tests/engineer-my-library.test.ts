import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { createBOQItem } from "../src/lib/repositories/boq-repository";
import {
  createFromBoqItem,
  getLibraryItemForCompany,
  listLibraryItemsForCompany,
  setLibraryItemFavoriteForCompany,
} from "../src/lib/services/company-library-service";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { activateDevelopmentSoftwarePlan } from "../src/lib/entitlements/entitlement-service";
import { NotFoundError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

/**
 * Engineer reusable-item workflow (feature/engineer-my-library): manual BOQ
 * item -> "Save for future projects" -> My Items -> reuse in another
 * project. Exercises company-library-service.createFromBoqItem's duplicate-
 * safety behavior and the new createdByUserId ("My Items") filter, on top
 * of the existing Company Library architecture — no second library system.
 */

const RUN_ID = Date.now();

function actorFor(userId: string, companyId: string, role: UserRole = UserRole.COMPANY_OWNER): CurrentActor {
  return { userId, companyId, role, fullName: "Test Actor", email: "actor@example.com" };
}

async function seedCompanyWithUsers(suffix: string, userCount = 1) {
  const company = await prisma.company.create({
    data: {
      legalName: `Engineer Lib Co ${suffix} ${RUN_ID}`,
      tradeName: `Engineer Lib ${suffix}`,
      email: `engineer-lib-${suffix}-${RUN_ID}@example.com`,
      address: "Dubai, UAE",
      country: "UAE",
      taxRegistrationNumber: "100000000000003",
      isTestCompany: true,
    },
  });
  const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
  await prisma.companyIndustryEngine.create({ data: { companyId: company.id, industryEngineId: construction.id, enabled: true } });
  const client = await createClient(company.id, { name: `Client ${suffix}`, email: `engineer-lib-client-${suffix}-${RUN_ID}@example.com` });

  const userIds: string[] = [];
  for (let i = 0; i < userCount; i += 1) {
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `engineer-lib-user-${suffix}-${i}-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: `Test Engineer ${i}`,
        role: UserRole.COMPANY_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    userIds.push(user.id);
  }

  return { companyId: company.id, clientId: client.id, userIds };
}

async function createCleanProject(companyId: string, clientId: string, userId: string, referenceSuffix: string) {
  const { project, boq } = await createProjectWithDefaultBoq(actorFor(userId, companyId), {
    clientId,
    industryEngineId: "construction",
    reference: `ENGLIB-${referenceSuffix}-${RUN_ID}`,
    name: `Engineer Lib Project ${referenceSuffix}`,
    location: "Dubai",
    currency: "AED",
    taxRate: "5",
    language: "English",
  });
  return { project, boq };
}

describe("Engineer reusable-item workflow (integration, real local Postgres)", () => {
  const cleanupCompanyIds: string[] = [];

  afterAll(async () => {
    for (const companyId of cleanupCompanyIds) {
      await prisma.companyItemUsage.deleteMany({ where: { companyId } });
      await prisma.companyLibraryItemVersion.deleteMany({ where: { companyId } });
      await prisma.companyLibraryItem.deleteMany({ where: { companyId } });
      await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
      await prisma.bOQItem.deleteMany({ where: { companyId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }, 30_000);

  it("saves a manual BOQ item for future projects without mutating the original BOQ item", async () => {
    const { companyId, clientId, userIds } = await seedCompanyWithUsers("save-basic");
    cleanupCompanyIds.push(companyId);
    const [userId] = userIds;
    const { boq } = await createCleanProject(companyId, clientId, userId, "save-basic");

    const { item: boqItem } = await createBOQItem(companyId, boq.sections[0].id, {
      itemNumber: 1, itemCode: "REUSE-1", category: "Concrete", description: "Reusable concrete item", quantity: "5", unit: "m3", unitCost: "150", marginPercentage: "20", sortOrder: 1,
    });

    const saved = await createFromBoqItem(actorFor(userId, companyId), boqItem.id);
    expect(saved.companyItemCode).toBe("REUSE-1");
    expect(saved.sourceType).toBe("PREVIOUS_PROJECT");
    expect(saved.reused).toBe(false);
    expect(saved.createdByUserId).toBe(userId);

    const boqItemAfter = await prisma.bOQItem.findUniqueOrThrow({ where: { id: boqItem.id } });
    expect(boqItemAfter.description).toBe("Reusable concrete item");
    expect(boqItemAfter.itemCode).toBe("REUSE-1");
    expect(boqItemAfter.unitCost.toNumber()).toBe(150);
  });

  it("reuses the existing library item (double-submit protection) when the same code and identical content is saved again", async () => {
    const { companyId, clientId, userIds } = await seedCompanyWithUsers("save-idempotent");
    cleanupCompanyIds.push(companyId);
    const [userId] = userIds;
    const { boq } = await createCleanProject(companyId, clientId, userId, "save-idempotent");

    const { item: boqItem } = await createBOQItem(companyId, boq.sections[0].id, {
      itemNumber: 1, itemCode: "DUP-1", category: "Concrete", description: "Same item", quantity: "1", unit: "m3", unitCost: "100", marginPercentage: "10", sortOrder: 1,
    });

    const first = await createFromBoqItem(actorFor(userId, companyId), boqItem.id);
    expect(first.reused).toBe(false);

    // Accidental double-click on "Save for future projects" for the same item.
    const second = await createFromBoqItem(actorFor(userId, companyId), boqItem.id);
    expect(second.reused).toBe(true);
    expect(second.id).toBe(first.id);

    const rows = await prisma.companyLibraryItem.findMany({ where: { companyId, companyItemCode: "DUP-1" } });
    expect(rows).toHaveLength(1);
  });

  it("keeps an intentional variant under a distinct auto-generated code when the same code already exists with different details", async () => {
    const { companyId, clientId, userIds } = await seedCompanyWithUsers("save-variant");
    cleanupCompanyIds.push(companyId);
    const [userId] = userIds;
    const { boq } = await createCleanProject(companyId, clientId, userId, "save-variant");

    const { item: firstItem } = await createBOQItem(companyId, boq.sections[0].id, {
      itemNumber: 1, itemCode: "VAR-1", category: "Concrete", description: "Original spec", quantity: "1", unit: "m3", unitCost: "100", marginPercentage: "10", sortOrder: 1,
    });
    const first = await createFromBoqItem(actorFor(userId, companyId), firstItem.id);
    expect(first.reused).toBe(false);

    const { item: secondItem } = await createBOQItem(companyId, boq.sections[0].id, {
      itemNumber: 2, itemCode: "VAR-1", category: "Concrete", description: "Different spec entirely", quantity: "1", unit: "m3", unitCost: "999", marginPercentage: "10", sortOrder: 2,
    });
    const second = await createFromBoqItem(actorFor(userId, companyId), secondItem.id);
    expect(second.reused).toBe(false);
    expect(second.renamedFrom).toBe("VAR-1");
    expect(second.companyItemCode).toBe("VAR-1-2");
    expect(second.id).not.toBe(first.id);

    const rows = await prisma.companyLibraryItem.findMany({ where: { companyId, companyItemCode: { in: ["VAR-1", "VAR-1-2"] } } });
    expect(rows).toHaveLength(2);
  });

  it("filters 'My Items' to the current user's own saved items, while company-wide visibility still includes every user's items", async () => {
    const { companyId, clientId, userIds } = await seedCompanyWithUsers("my-items", 2);
    cleanupCompanyIds.push(companyId);
    const [userA, userB] = userIds;
    const { boq } = await createCleanProject(companyId, clientId, userA, "my-items");

    const { item: itemA } = await createBOQItem(companyId, boq.sections[0].id, {
      itemNumber: 1, itemCode: "MINE-A", category: "Concrete", description: "User A item", quantity: "1", unit: "m3", unitCost: "10", marginPercentage: "10", sortOrder: 1,
    });
    await createFromBoqItem(actorFor(userA, companyId), itemA.id);

    const { item: itemB } = await createBOQItem(companyId, boq.sections[0].id, {
      itemNumber: 2, itemCode: "MINE-B", category: "Concrete", description: "User B item", quantity: "1", unit: "m3", unitCost: "10", marginPercentage: "10", sortOrder: 2,
    });
    await createFromBoqItem(actorFor(userB, companyId), itemB.id);

    const userAMine = await listLibraryItemsForCompany(actorFor(userA, companyId), { createdByUserId: userA });
    expect(userAMine.items.map((i) => i.companyItemCode)).toEqual(["MINE-A"]);

    const userBMine = await listLibraryItemsForCompany(actorFor(userB, companyId), { createdByUserId: userB });
    expect(userBMine.items.map((i) => i.companyItemCode)).toEqual(["MINE-B"]);

    const companyWide = await listLibraryItemsForCompany(actorFor(userA, companyId), {});
    expect(companyWide.items.map((i) => i.companyItemCode).sort()).toEqual(["MINE-A", "MINE-B"]);
  });

  it("never leaks another company's items across tenant boundaries, including the createdByUserId ('My Items') filter", async () => {
    const { companyId: companyAId, clientId: clientAId, userIds: userIdsA } = await seedCompanyWithUsers("tenant-iso-a");
    const { companyId: companyBId } = await seedCompanyWithUsers("tenant-iso-b");
    cleanupCompanyIds.push(companyAId, companyBId);
    const [userA] = userIdsA;
    const { boq } = await createCleanProject(companyAId, clientAId, userA, "tenant-iso");

    const { item } = await createBOQItem(companyAId, boq.sections[0].id, {
      itemNumber: 1, itemCode: "ISO-1", category: "Concrete", description: "Company A item", quantity: "1", unit: "m3", unitCost: "10", marginPercentage: "10", sortOrder: 1,
    });
    const saved = await createFromBoqItem(actorFor(userA, companyAId), item.id);

    const companyBView = await listLibraryItemsForCompany(actorFor(userA, companyBId), {});
    expect(companyBView.items.map((i) => i.companyItemCode)).not.toContain("ISO-1");

    // Even a (deliberately mismatched) createdByUserId filter never crosses the companyId scope.
    const companyBMineByUserA = await listLibraryItemsForCompany(actorFor(userA, companyBId), { createdByUserId: userA });
    expect(companyBMineByUserA.items).toHaveLength(0);

    await expect(getLibraryItemForCompany(actorFor(userA, companyBId), saved.id)).rejects.toThrow(NotFoundError);
  });

  it("supports the full reuse journey: save from one project, insert into a second project's BOQ, and keep the reused BOQ copy independent of the library original", async () => {
    const { companyId, clientId, userIds } = await seedCompanyWithUsers("reuse-journey");
    cleanupCompanyIds.push(companyId);
    const [userId] = userIds;
    // This journey opens a second project — beyond the free/trial 1-project
    // limit — so activate a real (dev-simulated) paid plan first. Unrelated
    // to the feature under test; just clears an entitlement gate that has
    // nothing to do with the library. Dev-plan activation requires a
    // platform-owner actor, scoped only to this fixture user.
    await prisma.user.update({ where: { id: userId }, data: { platformRole: "PLATFORM_OWNER" } });
    await activateDevelopmentSoftwarePlan(actorFor(userId, companyId), "commerce_starter");

    const { boq: firstBoq } = await createCleanProject(companyId, clientId, userId, "reuse-source");
    const { item: sourceItem } = await createBOQItem(companyId, firstBoq.sections[0].id, {
      itemNumber: 1, itemCode: "REUSE-JRN-1", category: "Concrete", description: "Reusable across projects", specification: "Original specification text", quantity: "2", unit: "m3", unitCost: "120", marginPercentage: "15", sortOrder: 1,
    });
    // createFromBoqItem maps BOQItem.description -> library item.name and
    // BOQItem.specification -> library item.description (see
    // company-library-service.ts createFromBoqItem) — asserted below against
    // the same fields the round trip actually uses, not a same-named guess.
    const savedLibraryItem = await createFromBoqItem(actorFor(userId, companyId), sourceItem.id);
    expect(savedLibraryItem.name).toBe("Reusable across projects");
    expect(savedLibraryItem.description).toBe("Original specification text");

    // "My Items" finds it.
    const mine = await listLibraryItemsForCompany(actorFor(userId, companyId), { createdByUserId: userId });
    expect(mine.items.map((i) => i.id)).toContain(savedLibraryItem.id);

    // Open another project and insert the saved item into its BOQ.
    const { boq: secondBoq } = await createCleanProject(companyId, clientId, userId, "reuse-target");
    const inserted = await addBoqItemFromSource(actorFor(userId, companyId), secondBoq.id, {
      sourceType: "COMPANY_LIBRARY",
      sourceId: savedLibraryItem.id,
      itemNumber: 1,
      quantity: "3",
    });
    expect(inserted.item.sourceCompanyLibraryItemId).toBe(savedLibraryItem.id);
    expect(inserted.item.itemCode).toBe("REUSE-JRN-1");

    // Edit the newly inserted BOQ copy.
    await prisma.bOQItem.update({ where: { id: inserted.item.id }, data: { description: "Edited only in the second project" } });

    // The saved library original is untouched by that edit.
    const libraryAfter = await getLibraryItemForCompany(actorFor(userId, companyId), savedLibraryItem.id);
    expect(libraryAfter.name).toBe("Reusable across projects");
    expect(libraryAfter.description).toBe("Original specification text");

    // The original source BOQ item (in the first project) is also untouched.
    const sourceAfter = await prisma.bOQItem.findUniqueOrThrow({ where: { id: sourceItem.id } });
    expect(sourceAfter.description).toBe("Reusable across projects");
    expect(sourceAfter.specification).toBe("Original specification text");
  });

  it("still supports favoriting a saved item and filtering by favorites", async () => {
    const { companyId, clientId, userIds } = await seedCompanyWithUsers("favorites", 1);
    cleanupCompanyIds.push(companyId);
    const [userId] = userIds;
    const { boq } = await createCleanProject(companyId, clientId, userId, "favorites");

    const { item } = await createBOQItem(companyId, boq.sections[0].id, {
      itemNumber: 1, itemCode: "FAV-1", category: "Concrete", description: "Favorite candidate", quantity: "1", unit: "m3", unitCost: "10", marginPercentage: "10", sortOrder: 1,
    });
    const saved = await createFromBoqItem(actorFor(userId, companyId), item.id);
    expect(saved.isFavorite).toBe(false);

    await setLibraryItemFavoriteForCompany(actorFor(userId, companyId), saved.id, true);
    const favorites = await listLibraryItemsForCompany(actorFor(userId, companyId), { favoritesOnly: true });
    expect(favorites.items.map((i) => i.id)).toContain(saved.id);

    await setLibraryItemFavoriteForCompany(actorFor(userId, companyId), saved.id, false);
    const favoritesAfterUnset = await listLibraryItemsForCompany(actorFor(userId, companyId), { favoritesOnly: true });
    expect(favoritesAfterUnset.items.map((i) => i.id)).not.toContain(saved.id);
  });
});
