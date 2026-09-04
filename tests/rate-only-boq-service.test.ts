import {
  BOQStatus,
  MarginMode,
  RateProvenanceSource,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
} from "../src/lib/errors/app-error";
import { createClient } from "../src/lib/repositories/client-repository";
import {
  createBOQItem,
  createBOQRevision,
} from "../src/lib/repositories/boq-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { updateRateOnlyBOQItemUnitRate } from "../src/lib/services/rate-only-boq-service";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

const RUN_ID = `${Date.now()}-${process.pid}`;

describe("rate-only BOQ service (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let companyAUserId: string;
  let companyBUserId: string;
  let clientAId: string;
  let fixtureSequence = 0;

  function actorA(role: UserRole = UserRole.COMPANY_OWNER): CurrentActor {
    return {
      userId: companyAUserId,
      companyId: companyAId,
      role,
      fullName: "Rate Owner A",
      email: `rate-owner-a-${RUN_ID}@example.com`,
    };
  }

  function actorB(): CurrentActor {
    return {
      userId: companyBUserId,
      companyId: companyBId,
      role: UserRole.COMPANY_OWNER,
      fullName: "Rate Owner B",
      email: `rate-owner-b-${RUN_ID}@example.com`,
    };
  }

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    const [companyA, companyB] = await Promise.all([
      prisma.company.create({
        data: {
          legalName: `Rate-only Company A ${RUN_ID}`,
          tradeName: "Rate-only Company A",
          email: `rate-company-a-${RUN_ID}@example.com`,
        },
      }),
      prisma.company.create({
        data: {
          legalName: `Rate-only Company B ${RUN_ID}`,
          tradeName: "Rate-only Company B",
          email: `rate-company-b-${RUN_ID}@example.com`,
        },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyAId);
    await grantUnlimitedPlanForTests(companyBId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.createMany({
      data: [
        { companyId: companyAId, industryEngineId: construction.id, enabled: true },
        { companyId: companyBId, industryEngineId: construction.id, enabled: true },
      ],
    });

    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: companyAId,
          email: `rate-owner-a-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "Rate Owner A",
          role: UserRole.COMPANY_OWNER,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyBId,
          email: `rate-owner-b-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "Rate Owner B",
          role: UserRole.COMPANY_OWNER,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);
    companyAUserId = userA.id;
    companyBUserId = userB.id;

    const client = await createClient(companyAId, {
      name: "Rate-only Client",
      email: `rate-client-${RUN_ID}@example.com`,
    });
    clientAId = client.id;
  });

  afterAll(async () => {
    if (!companyAId || !companyBId) {
      await prisma.$disconnect();
      return;
    }
    await prisma.verificationException.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
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

  async function createFixture(initialRate = "10") {
    fixtureSequence += 1;
    const { boq } = await createProjectWithDefaultBoq(actorA(), {
      clientId: clientAId,
      industryEngineId: "construction",
      reference: `RATE-${RUN_ID}-${fixtureSequence}`,
      name: `Rate-only Project ${fixtureSequence}`,
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    const created = await createBOQItem(companyAId, boq.sections[0].id, {
      itemNumber: 1,
      itemCode: `RATE-ITEM-${fixtureSequence}`,
      category: "Generated scope",
      description: "Generated measured item",
      quantity: "3",
      unit: "m2",
      unitCost: initialRate,
      freightCost: "2",
      installationCost: "1",
      additionalCost: "0.5",
      marginMode: MarginMode.MARKUP,
      marginPercentage: "10",
    });
    return { boqId: boq.databaseId, itemId: created.item.id };
  }

  it("updates only the rate model and reuses server totals, provenance, version invalidation and audits", async () => {
    const fixture = await createFixture();
    const updated = await updateRateOnlyBOQItemUnitRate(actorA(), fixture.itemId, { unitRate: "15.25" });
    const item = updated.sections.flatMap((section) => section.items).find((candidate) => candidate.id === fixture.itemId);

    expect(item).toMatchObject({
      description: "Generated measured item",
      quantity: 3,
      unit: "m2",
      unitCost: 15.25,
      freightCost: 0,
      installationCost: 0,
      additionalCost: 0,
      marginPercentage: 0,
      sellingRate: 15.25,
      totalAmount: 45.75,
    });
    expect(updated.status).toBe("draft");

    const [persistedBoq, provenance, audit] = await Promise.all([
      prisma.bOQ.findUniqueOrThrow({ where: { id: fixture.boqId } }),
      prisma.bOQItemRateProvenance.findUniqueOrThrow({ where: { boqItemId: fixture.itemId } }),
      prisma.auditLog.findFirstOrThrow({
        where: { companyId: companyAId, entityId: fixture.itemId, action: "UNIT_RATE_CONFIRMED" },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    expect(persistedBoq.version).toBeGreaterThan(1);
    expect(persistedBoq.verifiedVersion).toBeNull();
    expect(provenance.sourceType).toBe(RateProvenanceSource.MANUAL_CONFIRMED);
    expect(provenance.confirmedByUserId).toBe(companyAUserId);
    expect(provenance.unitCostSnapshot.toString()).toBe("15.25");
    expect(audit.payloadJson).toEqual(expect.objectContaining({
      confirmedByUserId: companyAUserId,
      confirmedByName: "Rate Owner A",
      unitRate: "15.25",
    }));
  });

  it("records an explicit user confirmation when an unchanged rate is zero", async () => {
    const fixture = await createFixture("0");
    // First normalize every hidden commercial component to zero. Then mark
    // the still-matching zero snapshot as legacy/unconfirmed so the second
    // call proves confirmation is written without relying on a numeric delta.
    await updateRateOnlyBOQItemUnitRate(actorA(), fixture.itemId, { unitRate: 0 });
    await prisma.bOQItemRateProvenance.update({
      where: { boqItemId: fixture.itemId },
      data: {
        sourceType: RateProvenanceSource.LEGACY_UNVERIFIED,
        confirmedByUserId: null,
        confirmedByName: "Legacy import",
        confirmedAt: null,
      },
    });

    await updateRateOnlyBOQItemUnitRate(actorA(), fixture.itemId, { unitRate: 0 });

    const provenance = await prisma.bOQItemRateProvenance.findUniqueOrThrow({ where: { boqItemId: fixture.itemId } });
    const audits = await prisma.auditLog.count({
      where: { companyId: companyAId, entityId: fixture.itemId, action: "UNIT_RATE_CONFIRMED" },
    });
    expect(provenance.sourceType).toBe(RateProvenanceSource.MANUAL_CONFIRMED);
    expect(provenance.confirmedAt).not.toBeNull();
    expect(provenance.confirmedByUserId).toBe(companyAUserId);
    expect(provenance.unitCostSnapshot.toString()).toBe("0");
    expect(audits).toBe(2);
  });

  it("fails closed for missing RBAC capability and cross-tenant item ids", async () => {
    const fixture = await createFixture();

    await expect(
      updateRateOnlyBOQItemUnitRate(actorA(UserRole.DESIGNER), fixture.itemId, { unitRate: "20" }),
    ).rejects.toThrow(PermissionDeniedError);
    await expect(
      updateRateOnlyBOQItemUnitRate(actorB(), fixture.itemId, { unitRate: "20" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects locked current items and editable-but-historical revision items", async () => {
    const lockedFixture = await createFixture();
    await prisma.bOQ.update({
      where: { id: lockedFixture.boqId },
      data: { isLocked: true, status: BOQStatus.LOCKED },
    });
    await expect(
      updateRateOnlyBOQItemUnitRate(actorA(), lockedFixture.itemId, { unitRate: "20" }),
    ).rejects.toMatchObject({ code: "BOQ_LOCKED" });

    const historicalFixture = await createFixture();
    await createBOQRevision(companyAId, historicalFixture.boqId, "Rate Owner A");
    await expect(
      updateRateOnlyBOQItemUnitRate(actorA(), historicalFixture.itemId, { unitRate: "20" }),
    ).rejects.toEqual(expect.objectContaining<Partial<ConflictError>>({ code: "BOQ_REVISION_HISTORICAL" }));
  });
});
