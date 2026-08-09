import {
  ExtractedEntityStatus,
  ExtractedEntityType,
  ExtractionMethod,
  QuantityCalculationType,
  UserRole,
} from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { importExtractedEntityToBoq } from "../src/lib/services/extraction-to-boq-service";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const auditFailure = vi.hoisted(() => ({ failImportAudit: false }));

vi.mock("@/lib/repositories/audit-repository", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/repositories/audit-repository")>();
  return {
    ...original,
    createAuditLog: vi.fn(async (...args: Parameters<typeof original.createAuditLog>) => {
      if (auditFailure.failImportAudit && args[1].action === "ENTITY_IMPORTED_TO_BOQ") {
        throw new Error("forced import audit failure");
      }
      return original.createAuditLog(...args);
    }),
  };
});

const RUN_ID = `${Date.now()}-${process.pid}`;

function requireIsolatedLocalTestDatabase(): void {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is required for this integration test.");
  const parsed = new URL(rawUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || databaseName !== "quantara_e2e_boq") {
    throw new Error("Refusing import-integrity integration test outside localhost/quantara_e2e_boq.");
  }
}

describe("Release 1 entity-to-BOQ import integrity", () => {
  let companyId = "";
  let userId: string;
  let projectAId: string;
  let projectBId: string;
  let boqAId: string;
  let boqBId: string;
  let sectionAId: string;
  let sectionBId: string;
  let projectFileAId: string;
  let projectFileBId: string;

  function actor(): CurrentActor {
    return {
      userId,
      companyId,
      role: UserRole.COMPANY_OWNER,
      fullName: "Import Integrity Owner",
      email: `import-integrity-${RUN_ID}@example.com`,
    };
  }

  function input(sectionId: string, itemCode: string, quantityCalculationId?: string) {
    return {
      sectionId,
      itemNumber: 1,
      itemCode,
      category: "Finishes",
      description: "Professionally reviewed wall finish",
      unit: "m2",
      quantity: 12,
      unitCost: 20,
      marginPercentage: 10,
      ...(quantityCalculationId ? { quantityCalculationId } : {}),
    };
  }

  async function createEntity(
    projectId: string,
    projectFileId: string,
    label: string,
    status: ExtractedEntityStatus = ExtractedEntityStatus.CONFIRMED,
  ) {
    return prisma.extractedEntity.create({
      data: {
        companyId,
        projectId,
        projectFileId,
        entityType: ExtractedEntityType.WALL_FINISH,
        label,
        confidence: 92,
        extractionMethod: ExtractionMethod.VISION_MODEL,
        sourceText: `${label} source evidence`,
        sourceReference: "A-101",
        status,
        confirmedByUserId: status === ExtractedEntityStatus.CONFIRMED ? userId : null,
        confirmedAt: status === ExtractedEntityStatus.CONFIRMED ? new Date() : null,
      },
    });
  }

  async function createConfirmedCalculation(projectId: string, entityId: string, resultValue = 14.5) {
    return prisma.quantityCalculation.create({
      data: {
        companyId,
        projectId,
        extractedEntityId: entityId,
        calculationType: QuantityCalculationType.WALL_AREA,
        inputValuesJson: { wallLength: 5, wallHeight: 3 },
        deductionsJson: { openingsArea: 0.5 },
        formula: "wallLength x wallHeight - openingsArea",
        resultValue,
        resultUnit: "m2",
        confidence: 92,
        status: ExtractedEntityStatus.CONFIRMED,
        confirmedByUserId: userId,
        confirmedAt: new Date(),
      },
    });
  }

  async function mutationSnapshot(entityIds: string[]) {
    return {
      itemCount: await prisma.bOQItem.count({ where: { companyId } }),
      auditCount: await prisma.auditLog.count({
        where: { companyId, action: { in: ["ITEM_ADDED", "ENTITY_IMPORTED_TO_BOQ"] } },
      }),
      entities: await prisma.extractedEntity.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, status: true, updatedAt: true },
        orderBy: { id: "asc" },
      }),
      boqs: await prisma.bOQ.findMany({
        where: { id: { in: [boqAId, boqBId] } },
        select: { id: true, status: true, version: true, verifiedVersion: true, verifiedAt: true },
        orderBy: { id: "asc" },
      }),
    };
  }

  async function expectRejectedWithoutMutation(
    entityIds: string[],
    operation: () => Promise<unknown>,
    code: string,
    status: number,
  ) {
    const before = await mutationSnapshot(entityIds);
    await expect(operation()).rejects.toMatchObject({ code, status });
    expect(await mutationSnapshot(entityIds)).toEqual(before);
  }

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    const company = await prisma.company.create({
      data: {
        legalName: `Import Integrity ${RUN_ID}`,
        tradeName: "Import Integrity",
        email: `import-integrity-company-${RUN_ID}@example.com`,
      },
    });
    companyId = company.id;
    await grantUnlimitedPlanForTests(companyId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });

    const owner = await prisma.user.create({
      data: {
        companyId,
        email: `import-integrity-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: "Import Integrity Owner",
        role: UserRole.COMPANY_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    userId = owner.id;

    const client = await createClient(companyId, {
      name: "Import Integrity Client",
      email: `import-integrity-client-${RUN_ID}@example.com`,
    });
    const projectA = await createProjectWithDefaultBoq(actor(), {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `IMPORT-A-${RUN_ID}`,
      name: "Import Integrity Project A",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    const projectB = await createProjectWithDefaultBoq(actor(), {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `IMPORT-B-${RUN_ID}`,
      name: "Import Integrity Project B",
      location: "Abu Dhabi",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectAId = projectA.project.databaseId;
    projectBId = projectB.project.databaseId;
    boqAId = projectA.boq.databaseId;
    boqBId = projectB.boq.databaseId;
    sectionAId = projectA.boq.sections[0].id;
    sectionBId = projectB.boq.sections[0].id;

    const [fileA, fileB] = await Promise.all([
      prisma.projectFile.create({
        data: {
          companyId,
          projectId: projectAId,
          uploadedByUserId: userId,
          originalName: "project-a.pdf",
          safeFileName: "project-a.pdf",
          storageKey: `tests/${RUN_ID}/project-a.pdf`,
          mimeType: "application/pdf",
          extension: "pdf",
          fileSize: 100,
          checksum: `checksum-a-${RUN_ID}`,
        },
      }),
      prisma.projectFile.create({
        data: {
          companyId,
          projectId: projectBId,
          uploadedByUserId: userId,
          originalName: "project-b.pdf",
          safeFileName: "project-b.pdf",
          storageKey: `tests/${RUN_ID}/project-b.pdf`,
          mimeType: "application/pdf",
          extension: "pdf",
          fileSize: 100,
          checksum: `checksum-b-${RUN_ID}`,
        },
      }),
    ]);
    projectFileAId = fileA.id;
    projectFileBId = fileB.id;
  });

  afterEach(() => {
    auditFailure.failImportAudit = false;
  });

  afterAll(async () => {
    auditFailure.failImportAudit = false;
    if (!companyId) return;
    await prisma.auditLog.deleteMany({ where: { companyId } });
    await prisma.quantityCalculation.deleteMany({ where: { companyId } });
    await prisma.extractedEntity.deleteMany({ where: { companyId } });
    await prisma.projectFile.deleteMany({ where: { companyId } });
    await prisma.bOQItem.deleteMany({ where: { companyId } });
    await prisma.bOQSection.deleteMany({ where: { companyId } });
    await prisma.bOQ.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("rejects every same-company cross-project entity, BOQ, section and calculation binding before mutation", async () => {
    const entityA = await createEntity(projectAId, projectFileAId, "Project A entity");
    const entityB = await createEntity(projectBId, projectFileBId, "Project B entity");
    const calculationFromProjectB = await createConfirmedCalculation(projectBId, entityA.id);
    const calculationForAnotherEntity = await createConfirmedCalculation(projectAId, entityB.id);
    const trackedEntities = [entityA.id, entityB.id];

    await expectRejectedWithoutMutation(
      trackedEntities,
      () => importExtractedEntityToBoq(actor(), boqAId, entityB.id, input(sectionAId, `X-ENTITY-${RUN_ID}`), { id: projectAId }),
      "ENTITY_PROJECT_MISMATCH",
      400,
    );
    await expectRejectedWithoutMutation(
      trackedEntities,
      () => importExtractedEntityToBoq(actor(), boqBId, entityA.id, input(sectionBId, `X-BOQ-${RUN_ID}`), { id: projectAId }),
      "BOQ_PROJECT_MISMATCH",
      400,
    );
    await expectRejectedWithoutMutation(
      trackedEntities,
      () => importExtractedEntityToBoq(actor(), boqAId, entityA.id, input(sectionBId, `X-SECTION-${RUN_ID}`), { id: projectAId }),
      "SECTION_BOQ_MISMATCH",
      400,
    );
    await expectRejectedWithoutMutation(
      trackedEntities,
      () => importExtractedEntityToBoq(actor(), boqAId, entityA.id, input(sectionAId, `X-CALC-P-${RUN_ID}`, calculationFromProjectB.id), { id: projectAId }),
      "CALCULATION_PROJECT_MISMATCH",
      400,
    );
    await expectRejectedWithoutMutation(
      trackedEntities,
      () => importExtractedEntityToBoq(actor(), boqAId, entityA.id, input(sectionAId, `X-CALC-E-${RUN_ID}`, calculationForAnotherEntity.id), { id: projectAId }),
      "CALCULATION_ENTITY_MISMATCH",
      400,
    );
  });

  it("imports a valid same-project entity using the confirmed calculation result", async () => {
    const entity = await createEntity(projectAId, projectFileAId, "Valid same-project entity");
    const calculation = await createConfirmedCalculation(projectAId, entity.id, 14.5);

    const result = await importExtractedEntityToBoq(
      actor(),
      boqAId,
      entity.id,
      { ...input(sectionAId, `VALID-${RUN_ID}`, calculation.id), quantity: 999 },
      { id: projectAId },
    );

    expect(result.item.quantity.toNumber()).toBe(14.5);
    expect(result.item.unit).toBe("m2");
    expect((await prisma.extractedEntity.findUniqueOrThrow({ where: { id: entity.id } })).status).toBe("IMPORTED");
    expect(await prisma.auditLog.count({
      where: { companyId, entityId: result.item.id, action: "ITEM_ADDED" },
    })).toBe(1);
    expect(await prisma.auditLog.count({
      where: { companyId, entityId: result.item.id, action: "ENTITY_IMPORTED_TO_BOQ" },
    })).toBe(1);
  });

  it("rolls back item, BOQ claim, entity claim and audits when the downstream import audit fails", async () => {
    const entity = await createEntity(projectAId, projectFileAId, "Rollback entity");
    const before = await mutationSnapshot([entity.id]);
    auditFailure.failImportAudit = true;

    await expect(importExtractedEntityToBoq(
      actor(),
      boqAId,
      entity.id,
      input(sectionAId, `ROLLBACK-${RUN_ID}`),
      { id: projectAId },
    )).rejects.toThrow("forced import audit failure");

    auditFailure.failImportAudit = false;
    expect(await mutationSnapshot([entity.id])).toEqual(before);
    expect(await prisma.bOQItem.count({ where: { companyId, itemCode: `ROLLBACK-${RUN_ID}` } })).toBe(0);
  });

  it("allows exactly one concurrent import and returns a controlled 409 conflict to the loser", async () => {
    const entity = await createEntity(projectAId, projectFileAId, "Concurrent entity");
    const outcomes = await Promise.allSettled([
      importExtractedEntityToBoq(actor(), boqAId, entity.id, input(sectionAId, `RACE-A-${RUN_ID}`), { id: projectAId }),
      importExtractedEntityToBoq(actor(), boqAId, entity.id, input(sectionAId, `RACE-B-${RUN_ID}`), { id: projectAId }),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "ENTITY_IMPORT_CONFLICT",
      status: 409,
    });

    const items = await prisma.bOQItem.findMany({
      where: { companyId, itemCode: { in: [`RACE-A-${RUN_ID}`, `RACE-B-${RUN_ID}`] } },
    });
    expect(items).toHaveLength(1);
    expect(await prisma.auditLog.count({
      where: { companyId, entityId: items[0].id, action: "ITEM_ADDED" },
    })).toBe(1);
    expect(await prisma.auditLog.count({
      where: { companyId, entityId: items[0].id, action: "ENTITY_IMPORTED_TO_BOQ" },
    })).toBe(1);
    expect((await prisma.extractedEntity.findUniqueOrThrow({ where: { id: entity.id } })).status).toBe("IMPORTED");
  });

  it("rejects a negative authoritative quantity before entity, BOQ, item or audit mutation", async () => {
    const entity = await createEntity(projectAId, projectFileAId, "Negative quantity entity");
    await expectRejectedWithoutMutation(
      [entity.id],
      () => importExtractedEntityToBoq(
        actor(),
        boqAId,
        entity.id,
        { ...input(sectionAId, `NEGATIVE-${RUN_ID}`), quantity: -1 },
        { id: projectAId },
      ),
      "INVALID_CALCULATION_RESULT",
      422,
    );
  });
});
