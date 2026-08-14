import { ExtractedEntityType, ExtractionMethod, Prisma, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { hashPassword } from "../src/lib/auth/password";
import {
  getRequiredDimensions,
  type DimensionValue,
} from "../src/lib/calculations/required-dimensions-registry";
import { assertValidFormulaResult } from "../src/lib/calculations/quantity-domain-validator";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { updateBOQItem } from "../src/lib/repositories/boq-repository";
import { runBOQVerification } from "../src/lib/repositories/verification-repository";
import {
  confirmCalculation,
  createCalculation,
  overrideCalculationResult,
  prefillDimensionValues,
  previewCalculation,
} from "../src/lib/services/quantity-calculation-service";
import {
  confirmCalculatedQuantityForItem,
  proposeCalculatedQuantityForItem,
} from "../src/lib/services/boq-quantity-update-service";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import {
  overrideCalculationSchema,
  previewCalculationSchema,
} from "../src/lib/validation/quantity-calculation-schema";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

const RUN_ID = `${Date.now()}-${process.pid}`;


function dim(
  key: string,
  label: string,
  unit: string | null,
  required: boolean,
  value: number | null,
): DimensionValue {
  return {
    key,
    label,
    unit,
    required,
    value,
    source: value === null ? null : "manual_professional_input",
    confidence: value === null ? null : 100,
    reviewStatus: value === null ? "MISSING" : "MANUAL_ENTRY",
  };
}

function schemaDimension(key: string, value: number) {
  return {
    key,
    label: key,
    unit: key.toLowerCase().includes("percentage") ? "%" : "m",
    required: false,
    value,
    source: "manual_professional_input" as const,
    confidence: 100,
    reviewStatus: "MANUAL_ENTRY" as const,
  };
}

describe("Release 1 quantity integrity - validation boundaries", () => {
  it("rejects negative dimensions and overrides at the Zod boundary", () => {
    const negativeDimension = previewCalculationSchema.safeParse({
      calculationType: "FLOOR_AREA",
      dimensionValues: [schemaDimension("wastagePercentage", -1)],
    });
    expect(negativeDimension.success).toBe(false);

    const negativeOverride = overrideCalculationSchema.safeParse({
      resultValue: -0.01,
      reason: "Site correction",
    });
    expect(negativeOverride.success).toBe(false);
  });

  it("rejects negative required, optional, and percentage values through the service boundary", () => {
    expect(() => previewCalculation("CONCRETE_VOLUME", [
      dim("length", "Length", "m", true, -1),
      dim("width", "Width", "m", true, 2),
      dim("depth", "Depth", "m", true, 3),
    ])).toThrowError(expect.objectContaining({ code: "INVALID_DIMENSION_VALUE", status: 422 }));

    expect(() => previewCalculation("WALL_AREA", [
      dim("wallLength", "Wall Length", "m", true, 5),
      dim("wallHeight", "Wall Height", "m", true, 3),
      dim("openingsArea", "Openings", "m2", false, -0.5),
    ])).toThrowError(expect.objectContaining({ code: "INVALID_DIMENSION_VALUE", status: 422 }));

    expect(() => previewCalculation("FLOOR_AREA", [
      dim("netFloorArea", "Net Floor Area", "m2", true, 10),
      dim("wastagePercentage", "Wastage", "%", false, -5),
    ])).toThrowError(expect.objectContaining({ code: "INVALID_DIMENSION_VALUE", status: 422 }));
  });

  it("rejects non-finite values and fractional count-like dimensions without imposing a cap", () => {
    expect(() => previewCalculation("FLOOR_AREA", [
      dim("netFloorArea", "Net Floor Area", "m2", true, Number.POSITIVE_INFINITY),
    ])).toThrowError(expect.objectContaining({ code: "INVALID_DIMENSION_VALUE" }));

    for (const [calculationType, values] of [
      ["COUNT", [dim("verifiedCount", "Verified Count", null, true, 2.5)]],
      ["PAINT_AREA", [dim("wallArea", "Wall Area", "m2", true, 10), dim("coats", "Coats", null, true, 1.5)]],
      ["PARTITION_AREA", [dim("length", "Length", "m", true, 3), dim("height", "Height", "m", true, 2), dim("faces", "Faces", null, true, 1.5)]],
    ] as const) {
      expect(() => previewCalculation(calculationType, [...values])).toThrowError(
        expect.objectContaining({ code: "INVALID_COUNT_DIMENSION", status: 422 }),
      );
    }

    const uncapped = previewCalculation("COUNT", [
      dim("verifiedCount", "Verified Count", null, true, Number.MAX_SAFE_INTEGER),
    ]);
    expect(uncapped.result?.resultValue).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("allows zero boundaries and preserves normal positive deterministic results", () => {
    const zero = previewCalculation("COUNT", [dim("verifiedCount", "Verified Count", null, true, 0)]);
    expect(zero.result?.resultValue).toBe(0);

    const positive = previewCalculation("CONCRETE_VOLUME", [
      dim("length", "Length", "m", true, 2),
      dim("width", "Width", "m", true, 3),
      dim("depth", "Depth", "m", true, 0.5),
    ]);
    expect(positive.result?.resultValue).toBe(3);
  });

  it("rejects negative deductions, allowances, and computed results", () => {
    expect(() => assertValidFormulaResult({
      formula: "invalid deduction",
      resultValue: 1,
      resultUnit: "m",
      inputValues: { length: 1 },
      deductions: { opening: -1 },
    })).toThrowError(expect.objectContaining({ code: "INVALID_CALCULATION_RESULT" }));

    expect(() => assertValidFormulaResult({
      formula: "invalid allowance",
      resultValue: 1,
      resultUnit: "m",
      inputValues: { length: 1 },
      allowances: { wastage: -1 },
    })).toThrowError(expect.objectContaining({ code: "INVALID_CALCULATION_RESULT" }));

    expect(() => assertValidFormulaResult({
      formula: "invalid result",
      resultValue: -1,
      resultUnit: "m",
      inputValues: { length: 1 },
    })).toThrowError(expect.objectContaining({ code: "INVALID_CALCULATION_RESULT" }));
  });
});

describe("Release 1 quantity integrity - persistence and atomic audit", () => {
  let companyId = "";
  let userId: string;
  let projectId: string;
  let projectFileId: string;
  let boqId: string;
  let sectionId: string;
  let itemNumber = 1_000;

  function actor(): CurrentActor {
    return {
      userId,
      companyId,
      role: UserRole.COMPANY_OWNER,
      fullName: "Quantity Integrity Owner",
      email: `quantity-integrity-${RUN_ID}@example.com`,
    };
  }

  async function createItem(quantity = 10, unit = "m") {
    const unitCost = 10;
    const sellingRate = 11;
    itemNumber += 1;
    return prisma.bOQItem.create({
      data: {
        companyId,
        sectionId,
        itemNumber,
        itemCode: `QTY-${RUN_ID}-${itemNumber}`,
        category: "General",
        description: "Quantity integrity test item",
        specification: "Verified specification",
        quantity,
        unit,
        unitCost,
        landedCost: unitCost,
        marginPercentage: 10,
        sellingRate,
        totalAmount: quantity * sellingRate,
        confidenceScore: 100,
        drawingReference: "A-101",
        sortOrder: itemNumber,
      },
    });
  }

  async function createPositiveCalculation() {
    return createCalculation(actor(), {
      projectId,
      calculationType: "FLOOR_AREA",
      dimensionValues: [
        dim("netFloorArea", "Net Floor Area", "m2", true, 20),
        dim("wastagePercentage", "Wastage", "%", false, 5),
      ],
    });
  }

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    const company = await prisma.company.create({
      data: {
        legalName: `Quantity Integrity ${RUN_ID}`,
        tradeName: "Quantity Integrity",
        email: `quantity-integrity-company-${RUN_ID}@example.com`,
      },
    });
    companyId = company.id;
    await grantUnlimitedPlanForTests(companyId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({
      data: { companyId, industryEngineId: construction.id, enabled: true },
    });

    const user = await prisma.user.create({
      data: {
        companyId,
        email: `quantity-integrity-${RUN_ID}@example.com`,
        passwordHash: await hashPassword("Release1IntegrityTestPassword!123"),
        fullName: "Quantity Integrity Owner",
        role: UserRole.COMPANY_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;

    const client = await createClient(companyId, {
      name: "Quantity Integrity Client",
      email: `quantity-integrity-client-${RUN_ID}@example.com`,
    });
    const created = await createProjectWithDefaultBoq(actor(), {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `QTY-${RUN_ID}`,
      name: "Quantity Integrity Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = created.project.databaseId;
    boqId = created.boq.databaseId;
    sectionId = created.boq.sections[0].id;
    const projectFile = await prisma.projectFile.create({
      data: {
        companyId,
        projectId,
        uploadedByUserId: userId,
        originalName: "negative-prefill.pdf",
        safeFileName: "negative-prefill.pdf",
        storageKey: `tests/${RUN_ID}/negative-prefill.pdf`,
        mimeType: "application/pdf",
        extension: "pdf",
        fileSize: 1_024,
        checksum: `negative-prefill-${RUN_ID}`,
      },
    });
    projectFileId = projectFile.id;
  });

  afterAll(async () => {
    if (!companyId) return;
    await prisma.auditLog.deleteMany({ where: { companyId } });
    await prisma.bOQItem.deleteMany({ where: { companyId } });
    await prisma.quantityCalculation.deleteMany({ where: { companyId } });
    await prisma.extractedEntity.deleteMany({ where: { companyId } });
    await prisma.projectFile.deleteMany({ where: { companyId } });
    await prisma.verificationException.deleteMany({ where: { companyId } });
    await prisma.bOQRevisionSnapshot.deleteMany({ where: { companyId } });
    await prisma.bOQSection.deleteMany({ where: { companyId } });
    await prisma.bOQ.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("rejects invalid internal calculation inputs before creating a calculation or audit", async () => {
    const calculationsBefore = await prisma.quantityCalculation.count({ where: { companyId } });
    const auditsBefore = await prisma.auditLog.count({ where: { companyId, action: "CALCULATION_CREATED" } });

    await expect(createCalculation(actor(), {
      projectId,
      calculationType: "WALL_AREA",
      dimensionValues: [
        dim("wallLength", "Wall Length", "m", true, 5),
        dim("wallHeight", "Wall Height", "m", true, 3),
        dim("openingsArea", "Openings", "m2", false, -1),
      ],
    })).rejects.toMatchObject({ code: "INVALID_DIMENSION_VALUE", status: 422 });

    expect(await prisma.quantityCalculation.count({ where: { companyId } })).toBe(calculationsBefore);
    expect(await prisma.auditLog.count({ where: { companyId, action: "CALCULATION_CREATED" } })).toBe(auditsBefore);
  });

  it("does not clamp negative extracted evidence and blocks it at preview and create boundaries", async () => {
    const entity = await prisma.extractedEntity.create({
      data: {
        companyId,
        projectId,
        projectFileId,
        entityType: ExtractedEntityType.FLOOR_FINISH,
        label: "Invalid negative floor evidence",
        confidence: 90,
        extractionMethod: ExtractionMethod.VISION_MODEL,
        technicalDataJson: { netFloorArea: -20, wastagePercentage: 5 },
      },
    });
    const prefills = await prefillDimensionValues(companyId, "FLOOR_AREA", {
      projectId,
      extractedEntityId: entity.id,
    });
    expect(prefills.find((value) => value.key === "netFloorArea")?.value).toBe(-20);

    expect(() => previewCalculation("FLOOR_AREA", prefills))
      .toThrowError(expect.objectContaining({ code: "INVALID_DIMENSION_VALUE", status: 422 }));

    const calculationsBefore = await prisma.quantityCalculation.count({ where: { companyId } });
    await expect(createCalculation(actor(), {
      projectId,
      calculationType: "FLOOR_AREA",
      extractedEntityId: entity.id,
      dimensionValues: prefills,
    })).rejects.toMatchObject({ code: "INVALID_DIMENSION_VALUE", status: 422 });
    expect(await prisma.quantityCalculation.count({ where: { companyId } })).toBe(calculationsBefore);
  });

  it("does not persist a formula that produces a negative result", async () => {
    const definition = getRequiredDimensions("CONCRETE_VOLUME")!;
    const originalCompute = definition.compute;
    const calculationsBefore = await prisma.quantityCalculation.count({ where: { companyId } });
    const auditsBefore = await prisma.auditLog.count({ where: { companyId, action: "CALCULATION_CREATED" } });
    definition.compute = (values) => ({ ...originalCompute(values), resultValue: -1 });

    try {
      await expect(createCalculation(actor(), {
        projectId,
        calculationType: "CONCRETE_VOLUME",
        dimensionValues: [
          dim("length", "Length", "m", true, 2),
          dim("width", "Width", "m", true, 3),
          dim("depth", "Depth", "m", true, 0.5),
        ],
      })).rejects.toMatchObject({ code: "INVALID_CALCULATION_RESULT", status: 422 });
    } finally {
      definition.compute = originalCompute;
    }

    expect(await prisma.quantityCalculation.count({ where: { companyId } })).toBe(calculationsBefore);
    expect(await prisma.auditLog.count({ where: { companyId, action: "CALCULATION_CREATED" } })).toBe(auditsBefore);
  });

  it("rejects a negative professional override with no result or audit mutation", async () => {
    const calculation = await createPositiveCalculation();
    const before = await prisma.quantityCalculation.findUniqueOrThrow({ where: { id: calculation.id } });
    const auditsBefore = await prisma.auditLog.count({
      where: { companyId, entityId: calculation.id, action: "CALCULATION_OVERRIDDEN" },
    });

    await expect(overrideCalculationResult(actor(), calculation.id, -1, "Invalid negative override"))
      .rejects.toMatchObject({ code: "INVALID_CALCULATION_OVERRIDE", status: 422 });

    const after = await prisma.quantityCalculation.findUniqueOrThrow({ where: { id: calculation.id } });
    expect(after.resultValue.equals(before.resultValue)).toBe(true);
    expect(after.manuallyOverridden).toBe(before.manuallyOverridden);
    expect(after.overrideReason).toBe(before.overrideReason);
    expect(await prisma.auditLog.count({
      where: { companyId, entityId: calculation.id, action: "CALCULATION_OVERRIDDEN" },
    })).toBe(auditsBefore);
  });

  it("blocks a persisted negative result before professional confirmation", async () => {
    const calculation = await createPositiveCalculation();
    await prisma.quantityCalculation.update({ where: { id: calculation.id }, data: { resultValue: -1 } });

    await expect(confirmCalculation(actor(), calculation.id))
      .rejects.toMatchObject({ code: "INVALID_CALCULATION_RESULT", status: 422 });

    const after = await prisma.quantityCalculation.findUniqueOrThrow({ where: { id: calculation.id } });
    expect(after.status).toBe("EXTRACTED");
    expect(after.confirmedAt).toBeNull();
    expect(await prisma.auditLog.count({
      where: { companyId, entityId: calculation.id, action: "CALCULATION_CONFIRMED" },
    })).toBe(0);
  });

  it("blocks a persisted negative result before proposal or BOQ application with no BOQ/audit mutation", async () => {
    const item = await createItem(12, "m2");
    const calculation = await createPositiveCalculation();
    await confirmCalculation(actor(), calculation.id);
    await prisma.quantityCalculation.update({ where: { id: calculation.id }, data: { resultValue: -2 } });
    const itemBefore = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });
    const boqBefore = await prisma.bOQ.findUniqueOrThrow({ where: { id: boqId } });
    const auditsBefore = await prisma.auditLog.count({ where: { companyId, entityId: item.id } });

    await expect(proposeCalculatedQuantityForItem(actor(), item.id, calculation.id))
      .rejects.toMatchObject({ code: "INVALID_CALCULATION_RESULT", status: 422 });
    await expect(confirmCalculatedQuantityForItem(actor(), item.id, calculation.id))
      .rejects.toMatchObject({ code: "INVALID_CALCULATION_RESULT", status: 422 });

    const itemAfter = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });
    const boqAfter = await prisma.bOQ.findUniqueOrThrow({ where: { id: boqId } });
    expect(itemAfter.quantity.equals(itemBefore.quantity)).toBe(true);
    expect(itemAfter.unit).toBe(itemBefore.unit);
    expect(itemAfter.totalAmount.equals(itemBefore.totalAmount)).toBe(true);
    expect(boqAfter.version).toBe(boqBefore.version);
    expect(boqAfter.verifiedVersion).toBe(boqBefore.verifiedVersion);
    expect(boqAfter.verifiedAt).toEqual(boqBefore.verifiedAt);
    expect(await prisma.auditLog.count({ where: { companyId, entityId: item.id } })).toBe(auditsBefore);
  });

  it("rolls back quantity, commercial totals, BOQ verification state, and audits when the additional audit fails", async () => {
    const item = await createItem(8, "m");
    await runBOQVerification(companyId, boqId);
    const itemBefore = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });
    const boqBefore = await prisma.bOQ.findUniqueOrThrow({ where: { id: boqId } });
    const auditsBefore = await prisma.auditLog.count({ where: { companyId, entityId: item.id } });
    const intentionallyNotJson: Record<string, unknown> = {};
    intentionallyNotJson.self = intentionallyNotJson;

    await expect(updateBOQItem(
      companyId,
      item.id,
      { quantity: 99, unit: "m2" },
      {
        additionalAudit: {
          action: "BOQ_QUANTITY_UPDATED_FROM_CALCULATION",
          payload: intentionallyNotJson as Prisma.InputJsonValue,
        },
      },
    )).rejects.toThrow();

    const itemAfter = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });
    const boqAfter = await prisma.bOQ.findUniqueOrThrow({ where: { id: boqId } });
    expect(itemAfter.quantity.equals(itemBefore.quantity)).toBe(true);
    expect(itemAfter.unit).toBe(itemBefore.unit);
    expect(itemAfter.landedCost.equals(itemBefore.landedCost)).toBe(true);
    expect(itemAfter.sellingRate.equals(itemBefore.sellingRate)).toBe(true);
    expect(itemAfter.totalAmount.equals(itemBefore.totalAmount)).toBe(true);
    expect(boqAfter.version).toBe(boqBefore.version);
    expect(boqAfter.verifiedVersion).toBe(boqBefore.verifiedVersion);
    expect(boqAfter.verifiedAt).toEqual(boqBefore.verifiedAt);
    expect(boqAfter.status).toBe(boqBefore.status);
    expect(await prisma.auditLog.count({ where: { companyId, entityId: item.id } })).toBe(auditsBefore);
  });

  it("commits the BOQ mutation with exactly one normal audit and one calculation-trace audit", async () => {
    const item = await createItem(4, "m");
    const calculation = await createPositiveCalculation();
    await confirmCalculation(actor(), calculation.id);
    const itemChangedBefore = await prisma.auditLog.count({
      where: { companyId, entityId: item.id, action: "ITEM_CHANGED" },
    });
    const traceBefore = await prisma.auditLog.count({
      where: { companyId, entityId: item.id, action: "BOQ_QUANTITY_UPDATED_FROM_CALCULATION" },
    });

    await confirmCalculatedQuantityForItem(actor(), item.id, calculation.id);

    const updated = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.quantity.toNumber()).toBe(21);
    expect(updated.unit).toBe("m2");
    expect(updated.sellingRate.toNumber()).toBe(11);
    expect(updated.totalAmount.toNumber()).toBe(231);
    expect(await prisma.auditLog.count({
      where: { companyId, entityId: item.id, action: "ITEM_CHANGED" },
    })).toBe(itemChangedBefore + 1);
    expect(await prisma.auditLog.count({
      where: { companyId, entityId: item.id, action: "BOQ_QUANTITY_UPDATED_FROM_CALCULATION" },
    })).toBe(traceBefore + 1);

    const trace = await prisma.auditLog.findFirstOrThrow({
      where: { companyId, entityId: item.id, action: "BOQ_QUANTITY_UPDATED_FROM_CALCULATION" },
      orderBy: { createdAt: "desc" },
    });
    expect(trace.payloadJson).toMatchObject({
      calculationId: calculation.id,
      calculationType: "FLOOR_AREA",
      previousQuantity: 4,
      newQuantity: 21,
      unit: "m2",
    });
  });
});
