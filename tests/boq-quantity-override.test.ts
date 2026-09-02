import {
  BOQStatus,
  ExtractedEntityStatus,
  MarginMode,
  QuantityProvenanceSource,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import {
  setActorContext,
  withActorRequestContext,
} from "../src/lib/auth/request-context";
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
import {
  isUniversalSystemCalculationIdentity,
} from "../src/lib/repositories/boq-quantity-override-repository";
import { overrideSystemCalculatedBOQItemQuantity } from "../src/lib/services/boq-quantity-override-service";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import type { BOQSystemQuantityOverrideInput } from "../src/lib/validation/boq-quantity-override-schema";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

const RUN_ID = `${Date.now()}-${process.pid}`;
const OPERATION_HASH = "a".repeat(64);
const CALCULATION_HASH = "b".repeat(64);
const CALCULATION_IDENTITY = `UNIVERSAL:autonomous-boq/v1:${OPERATION_HASH}:${CALCULATION_HASH}`;

type Fixture = {
  projectId: string;
  boqId: string;
  sectionId: string;
  itemId: string;
  calculationId: string;
  systemConfirmedAt: Date;
  boqVersion: number;
  revisionNumber: number;
  quantity: string;
  unit: string;
};

describe("audited system quantity override", () => {
  let companyAId: string;
  let companyBId: string;
  let ownerAId: string;
  let ownerBId: string;
  let clientAId: string;
  let sequence = 0;

  function actorA(role: UserRole = UserRole.COMPANY_OWNER): CurrentActor {
    return {
      userId: ownerAId,
      companyId: companyAId,
      role,
      fullName: "Quantity Override Owner",
      email: `quantity-override-a-${RUN_ID}@example.com`,
    };
  }

  function actorB(): CurrentActor {
    return {
      userId: ownerBId,
      companyId: companyBId,
      role: UserRole.COMPANY_OWNER,
      fullName: "Other Tenant Owner",
      email: `quantity-override-b-${RUN_ID}@example.com`,
    };
  }

  const runOverride = withActorRequestContext(async (
    actor: CurrentActor,
    itemId: string,
    input: BOQSystemQuantityOverrideInput,
  ) => {
    setActorContext(actor);
    return overrideSystemCalculatedBOQItemQuantity(actor, itemId, input);
  });

  function overrideInput(
    fixture: Fixture,
    quantity: string,
    reason = "Measured drawing discrepancy confirmed by senior QS",
  ): BOQSystemQuantityOverrideInput {
    return {
      quantityCalculationId: fixture.calculationId,
      quantity,
      reason,
      expected: {
        boqId: fixture.boqId,
        boqVersion: fixture.boqVersion,
        boqRevisionNumber: fixture.revisionNumber,
        itemQuantity: fixture.quantity,
        itemUnit: fixture.unit,
        calculationResultValue: fixture.quantity,
      },
    };
  }

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    const [companyA, companyB] = await Promise.all([
      prisma.company.create({
        data: {
          legalName: `Quantity Override Company A ${RUN_ID}`,
          tradeName: "Quantity Override Company A",
          email: `quantity-override-company-a-${RUN_ID}@example.com`,
        },
      }),
      prisma.company.create({
        data: {
          legalName: `Quantity Override Company B ${RUN_ID}`,
          tradeName: "Quantity Override Company B",
          email: `quantity-override-company-b-${RUN_ID}@example.com`,
        },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyAId);
    await grantUnlimitedPlanForTests(companyBId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({
      where: { key: "construction" },
    });
    await prisma.companyIndustryEngine.createMany({
      data: [
        { companyId: companyAId, industryEngineId: construction.id, enabled: true },
        { companyId: companyBId, industryEngineId: construction.id, enabled: true },
      ],
    });

    const [ownerA, ownerB] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: companyAId,
          email: `quantity-override-a-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "Quantity Override Owner",
          role: UserRole.COMPANY_OWNER,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyBId,
          email: `quantity-override-b-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "Other Tenant Owner",
          role: UserRole.COMPANY_OWNER,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;

    const client = await createClient(companyAId, {
      name: "Quantity Override Client",
      email: `quantity-override-client-${RUN_ID}@example.com`,
    });
    clientAId = client.id;
  });

  afterAll(async () => {
    if (!companyAId || !companyBId) return;
    const companies = [companyAId, companyBId];
    await prisma.verificationException.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.quantityCalculation.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.project.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.client.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.user.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.company.deleteMany({ where: { id: { in: companies } } });
    await prisma.$disconnect();
  });

  async function createFixture(): Promise<Fixture> {
    sequence += 1;
    const { project, boq } = await createProjectWithDefaultBoq(actorA(), {
      clientId: clientAId,
      industryEngineId: "construction",
      reference: `QOV-${RUN_ID}-${sequence}`,
      name: `Quantity Override Project ${sequence}`,
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    const created = await createBOQItem(companyAId, boq.sections[0].id, {
      itemNumber: 1,
      itemCode: `QOV-ITEM-${sequence}`,
      category: "System measured works",
      description: "System-generated measurable work",
      quantity: "10",
      unit: "m2",
      unitCost: "20",
      freightCost: "0",
      installationCost: "0",
      additionalCost: "0",
      marginMode: MarginMode.MARKUP,
      marginPercentage: "0",
      status: "CONFIRMED",
    });
    const item = await prisma.bOQItem.findUniqueOrThrow({
      where: { id: created.item.id },
      include: { section: { include: { boq: true } } },
    });
    const systemConfirmedAt = new Date(Date.now() - 60_000);
    const calculation = await prisma.quantityCalculation.create({
      data: {
        companyId: companyAId,
        projectId: project.databaseId,
        calculationType: "AREA",
        inputValuesJson: { measuredArea: 10 },
        formula: "validated measured area",
        resultValue: item.quantity,
        resultUnit: item.unit,
        confidence: 100,
        status: ExtractedEntityStatus.CONFIRMED,
        calculatedBy: CALCULATION_IDENTITY,
        confirmedByUserId: null,
        confirmedAt: systemConfirmedAt,
      },
    });
    await prisma.bOQItemQuantityProvenance.update({
      where: { boqItemId: item.id },
      data: {
        sourceType: QuantityProvenanceSource.CONFIRMED_CALCULATION,
        extractedEntityId: null,
        quantityCalculationId: calculation.id,
        projectFileId: null,
        sourceBoqItemQuantityProvenanceId: null,
        quantitySnapshot: item.quantity,
        unitSnapshot: item.unit,
        confirmedByUserId: null,
        confirmedByName: "Quantara Autonomous Measurement",
        confirmedAt: systemConfirmedAt,
      },
    });
    await prisma.bOQ.update({
      where: { id: item.section.boqId },
      data: {
        status: BOQStatus.CALCULATED,
        verifiedVersion: item.section.boq.version,
        verifiedAt: systemConfirmedAt,
      },
    });

    return {
      projectId: project.databaseId,
      boqId: item.section.boqId,
      sectionId: item.sectionId,
      itemId: item.id,
      calculationId: calculation.id,
      systemConfirmedAt,
      boqVersion: item.section.boq.version,
      revisionNumber: item.section.boq.revisionNumber,
      quantity: item.quantity.toString(),
      unit: item.unit,
    };
  }

  it("accepts only stable universal system calculation identities", () => {
    expect(isUniversalSystemCalculationIdentity(CALCULATION_IDENTITY)).toBe(true);
    expect(isUniversalSystemCalculationIdentity(`UNIVERSAL:${OPERATION_HASH}:${CALCULATION_HASH}`)).toBe(true);
    expect(isUniversalSystemCalculationIdentity(`TAYQAN:${OPERATION_HASH}:${CALCULATION_HASH}`)).toBe(false);
    expect(isUniversalSystemCalculationIdentity("UNIVERSAL:manual-entry")).toBe(false);
  });

  it("atomically recalculates the item and BOQ, preserves the original across repeated overrides, and appends actor/time audit history", async () => {
    const fixture = await createFixture();
    const firstStartedAt = new Date();
    const first = await runOverride(actorA(), fixture.itemId, overrideInput(fixture, "12.5"));
    const firstFinishedAt = new Date();

    expect(first.override).toMatchObject({
      originalSystemQuantity: "10",
      previousQuantity: "10",
      quantity: "12.5",
      unit: "m2",
      totalAmount: "250",
      actorUserId: ownerAId,
      actorName: "Quantity Override Owner",
    });
    expect(new Date(first.override.overriddenAt).getTime()).toBeGreaterThanOrEqual(firstStartedAt.getTime());
    expect(new Date(first.override.overriddenAt).getTime()).toBeLessThanOrEqual(firstFinishedAt.getTime());
    const returnedItem = first.boq.sections.flatMap((section) => section.items)
      .find((item) => item.id === fixture.itemId);
    expect(returnedItem).toMatchObject({
      quantity: 12.5,
      sellingRate: 20,
      totalAmount: 250,
    });
    expect(first.boq.totals).toMatchObject({
      subtotal: 250,
      taxAmount: 12.5,
      grandTotal: 262.5,
    });

    const [afterFirstCalculation, afterFirstItem, afterFirstProvenance, afterFirstBoq, firstAudit] = await Promise.all([
      prisma.quantityCalculation.findUniqueOrThrow({ where: { id: fixture.calculationId } }),
      prisma.bOQItem.findUniqueOrThrow({ where: { id: fixture.itemId } }),
      prisma.bOQItemQuantityProvenance.findUniqueOrThrow({ where: { boqItemId: fixture.itemId } }),
      prisma.bOQ.findUniqueOrThrow({ where: { id: fixture.boqId } }),
      prisma.auditLog.findFirstOrThrow({
        where: {
          companyId: companyAId,
          entityId: fixture.itemId,
          action: "SYSTEM_QUANTITY_OVERRIDDEN",
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    expect(afterFirstCalculation.manuallyOverridden).toBe(true);
    expect(afterFirstCalculation.originalResultValue?.toString()).toBe("10");
    expect(afterFirstCalculation.resultValue.toString()).toBe("12.5");
    expect(afterFirstCalculation.overrideReason).toBe("Measured drawing discrepancy confirmed by senior QS");
    expect(afterFirstCalculation.confirmedByUserId).toBeNull();
    expect(afterFirstCalculation.confirmedAt).toEqual(fixture.systemConfirmedAt);
    expect(afterFirstItem.quantity.toString()).toBe("12.5");
    expect(afterFirstItem.totalAmount.toString()).toBe("250");
    expect(afterFirstProvenance.quantitySnapshot.toString()).toBe("12.5");
    expect(afterFirstProvenance.confirmedByUserId).toBeNull();
    expect(afterFirstProvenance.confirmedAt).toEqual(fixture.systemConfirmedAt);
    expect(afterFirstBoq.version).toBe(fixture.boqVersion + 1);
    expect(afterFirstBoq.status).toBe(BOQStatus.NEEDS_VERIFICATION);
    expect(afterFirstBoq.verifiedVersion).toBeNull();
    expect(afterFirstBoq.verifiedAt).toBeNull();
    expect(firstAudit.userId).toBe(ownerAId);
    expect(firstAudit.actorName).toBe("Quantity Override Owner");
    expect(firstAudit.payloadJson).toMatchObject({
      originalSystemQuantity: "10",
      previousQuantity: "10",
      newQuantity: "12.5",
      reason: "Measured drawing discrepancy confirmed by senior QS",
      actorUserId: ownerAId,
      actorName: "Quantity Override Owner",
      overriddenAt: first.override.overriddenAt,
    });

    const secondFixture: Fixture = {
      ...fixture,
      boqVersion: afterFirstBoq.version,
      quantity: "12.5",
    };
    await runOverride(
      actorA(),
      fixture.itemId,
      overrideInput(secondFixture, "8.25", "Second documented correction"),
    );
    const [afterSecondCalculation, afterSecondProvenance, overrideAudits] = await Promise.all([
      prisma.quantityCalculation.findUniqueOrThrow({ where: { id: fixture.calculationId } }),
      prisma.bOQItemQuantityProvenance.findUniqueOrThrow({ where: { boqItemId: fixture.itemId } }),
      prisma.auditLog.findMany({
        where: {
          companyId: companyAId,
          entityId: fixture.itemId,
          action: "SYSTEM_QUANTITY_OVERRIDDEN",
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    expect(afterSecondCalculation.originalResultValue?.toString()).toBe("10");
    expect(afterSecondCalculation.resultValue.toString()).toBe("8.25");
    expect(afterSecondCalculation.overrideReason).toBe("Second documented correction");
    expect(afterSecondCalculation.confirmedByUserId).toBeNull();
    expect(afterSecondProvenance.quantitySnapshot.toString()).toBe("8.25");
    expect(afterSecondProvenance.confirmedByUserId).toBeNull();
    expect(overrideAudits).toHaveLength(2);
  });

  it("requires a reason and exact expected BOQ/item/calculation state before writing", async () => {
    const fixture = await createFixture();
    const before = await prisma.quantityCalculation.findUniqueOrThrow({ where: { id: fixture.calculationId } });

    await expect(
      runOverride(actorA(), fixture.itemId, overrideInput(fixture, "11", "   ")),
    ).rejects.toThrow(/reason/i);
    await expect(
      runOverride(actorA(), fixture.itemId, {
        ...overrideInput(fixture, "11"),
        expected: {
          ...overrideInput(fixture, "11").expected,
          itemQuantity: "9",
        },
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<ConflictError>>({ code: "QUANTITY_OVERRIDE_STALE" }));

    const after = await prisma.quantityCalculation.findUniqueOrThrow({ where: { id: fixture.calculationId } });
    expect(after.resultValue.equals(before.resultValue)).toBe(true);
    expect(after.manuallyOverridden).toBe(false);
    expect(await prisma.auditLog.count({
      where: { companyId: companyAId, entityId: fixture.itemId, action: "SYSTEM_QUANTITY_OVERRIDDEN" },
    })).toBe(0);
  });

  it("fails closed for missing combined RBAC authority and cross-tenant access", async () => {
    const fixture = await createFixture();
    await expect(
      runOverride(actorA(UserRole.DESIGNER), fixture.itemId, overrideInput(fixture, "11")),
    ).rejects.toThrow(PermissionDeniedError);
    await expect(
      runOverride(actorA(UserRole.REVIEWER), fixture.itemId, overrideInput(fixture, "11")),
    ).rejects.toThrow(PermissionDeniedError);
    await expect(
      runOverride(actorB(), fixture.itemId, overrideInput(fixture, "11")),
    ).rejects.toThrow(NotFoundError);

    const unchanged = await prisma.quantityCalculation.findUniqueOrThrow({ where: { id: fixture.calculationId } });
    expect(unchanged.resultValue.toString()).toBe("10");
    expect(unchanged.manuallyOverridden).toBe(false);
  });

  it("rejects locked items and editable-but-historical BOQ revisions without changing history", async () => {
    const locked = await createFixture();
    await prisma.bOQ.update({
      where: { id: locked.boqId },
      data: { isLocked: true, status: BOQStatus.LOCKED },
    });
    await expect(
      runOverride(actorA(), locked.itemId, overrideInput(locked, "11")),
    ).rejects.toMatchObject({ code: "BOQ_LOCKED" });

    const historical = await createFixture();
    await createBOQRevision(companyAId, historical.boqId, actorA().fullName);
    await expect(
      runOverride(actorA(), historical.itemId, overrideInput(historical, "11")),
    ).rejects.toEqual(expect.objectContaining<Partial<ConflictError>>({ code: "BOQ_REVISION_HISTORICAL" }));

    const [lockedCalculation, historicalCalculation, audits] = await Promise.all([
      prisma.quantityCalculation.findUniqueOrThrow({ where: { id: locked.calculationId } }),
      prisma.quantityCalculation.findUniqueOrThrow({ where: { id: historical.calculationId } }),
      prisma.auditLog.count({
        where: {
          companyId: companyAId,
          entityId: { in: [locked.itemId, historical.itemId] },
          action: "SYSTEM_QUANTITY_OVERRIDDEN",
        },
      }),
    ]);
    expect(lockedCalculation.manuallyOverridden).toBe(false);
    expect(historicalCalculation.manuallyOverridden).toBe(false);
    expect(audits).toBe(0);
  });

  it("rejects a calculation shared by multiple live items and any provenance mismatch", async () => {
    const shared = await createFixture();
    const second = await createBOQItem(companyAId, shared.sectionId, {
      itemNumber: 2,
      itemCode: `QOV-SHARED-${RUN_ID}-${sequence}`,
      category: "System measured works",
      description: "Incorrect duplicate calculation link",
      quantity: "10",
      unit: "m2",
      unitCost: "0",
      marginMode: MarginMode.MARKUP,
      marginPercentage: "0",
      status: "CONFIRMED",
    });
    await prisma.bOQItemQuantityProvenance.update({
      where: { boqItemId: second.item.id },
      data: {
        sourceType: QuantityProvenanceSource.CONFIRMED_CALCULATION,
        quantityCalculationId: shared.calculationId,
        quantitySnapshot: "10",
        unitSnapshot: "m2",
        confirmedByUserId: null,
        confirmedByName: "Quantara Autonomous Measurement",
        confirmedAt: shared.systemConfirmedAt,
      },
    });
    const currentSharedBoq = await prisma.bOQ.findUniqueOrThrow({ where: { id: shared.boqId } });
    await expect(
      runOverride(actorA(), shared.itemId, overrideInput({ ...shared, boqVersion: currentSharedBoq.version }, "11")),
    ).rejects.toEqual(expect.objectContaining<Partial<ConflictError>>({
      code: "QUANTITY_OVERRIDE_CALCULATION_NOT_EXCLUSIVE",
    }));

    const mismatch = await createFixture();
    const otherCalculation = await prisma.quantityCalculation.create({
      data: {
        companyId: companyAId,
        projectId: mismatch.projectId,
        calculationType: "AREA",
        inputValuesJson: { measuredArea: 10 },
        formula: "different validated measurement",
        resultValue: "10",
        resultUnit: "m2",
        confidence: 100,
        status: ExtractedEntityStatus.CONFIRMED,
        calculatedBy: `UNIVERSAL:autonomous-boq/v1:${"c".repeat(64)}:${"d".repeat(64)}`,
        confirmedByUserId: null,
        confirmedAt: mismatch.systemConfirmedAt,
      },
    });
    await prisma.bOQItemQuantityProvenance.update({
      where: { boqItemId: mismatch.itemId },
      data: { quantityCalculationId: otherCalculation.id },
    });
    await expect(
      runOverride(actorA(), mismatch.itemId, overrideInput(mismatch, "11")),
    ).rejects.toEqual(expect.objectContaining<Partial<ConflictError>>({
      code: "QUANTITY_OVERRIDE_PROVENANCE_MISMATCH",
    }));

    const unchanged = await prisma.quantityCalculation.findMany({
      where: { id: { in: [shared.calculationId, mismatch.calculationId] } },
    });
    expect(unchanged.every((calculation) => !calculation.manuallyOverridden)).toBe(true);
  });
});
