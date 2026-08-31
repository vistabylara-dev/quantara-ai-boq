import { Prisma, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoIndustries } from "../src/config/industries";
import { furnitureEngine } from "../src/config/industries/furniture";
import { furnitureJoineryCabinetryEngine } from "../src/config/industries/furniture-joinery-cabinetry";
import { joineryEngine } from "../src/config/industries/joinery";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import {
  FURNITURE_DISCIPLINE_SELECTED_ACTION,
  getFurnitureProjectDiscipline,
  recordInitialFurnitureProjectDiscipline,
} from "../src/lib/furniture/project-discipline";
import {
  FURNITURE_JOINERY_INDUSTRY_KEY,
  FURNITURE_JOINERY_INDUSTRY_NAME,
  FurnitureDiscipline,
} from "../src/lib/furniture/types";
import { createClient } from "../src/lib/repositories/client-repository";
import { projectReferenceExists } from "../src/lib/repositories/project-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { bootstrapIndustryEngines } from "../src/lib/services/industry-bootstrap-service";
import { projectCreateRequestSchema, projectUpdateRequestSchema } from "../src/app/api/_shared/project-payload";
import { projectSchema as projectFormSchema } from "../src/lib/validation/project-schema";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = Date.now();
const SAMPLE_CLIENT_ID = "00000000-0000-4000-8000-000000000001";
const SECTION_TITLES = [
  "PROJECT SUMMARY",
  "BOARD / SHEET MATERIAL — ORDER QUANTITIES",
  "HARDWARE & ACCESSORIES — ORDER QUANTITIES",
  "FULL CUTTING LIST — ALL ROOMS",
  "NOTES, ASSUMPTIONS & VERIFICATION ITEMS",
];

function actor(companyId: string, role: UserRole = UserRole.COMPANY_OWNER): CurrentActor {
  return {
    userId: "test-user",
    companyId,
    role,
    fullName: "Furniture Test Actor",
    email: "furniture-test@example.com",
  };
}

function requestPayload(industryId: string, discipline?: FurnitureDiscipline) {
  return {
    clientId: SAMPLE_CLIENT_ID,
    industryId,
    discipline,
    reference: `FJC-PAYLOAD-${RUN_ID}`,
    name: "Furniture Selection Project",
    description: "",
    location: "Dubai, UAE",
    currency: "AED",
    taxRate: "5",
    language: "English",
  };
}

function formPayload(industryEngineId: string, discipline?: FurnitureDiscipline) {
  return {
    clientId: SAMPLE_CLIENT_ID,
    industryEngineId,
    discipline,
    reference: `FJC-FORM-${RUN_ID}`,
    name: "Furniture Selection Project",
    description: "",
    location: "Dubai, UAE",
    currency: "AED",
    taxRate: 5,
    language: "English",
  };
}

describe("Furniture, Joinery & Cabinetry industry configuration", () => {
  it("registers one additive engine with the two disciplines and exact output sections", () => {
    expect(furnitureJoineryCabinetryEngine).toMatchObject({
      id: FURNITURE_JOINERY_INDUSTRY_KEY,
      name: FURNITURE_JOINERY_INDUSTRY_NAME,
      status: "active",
    });
    expect(furnitureJoineryCabinetryEngine.disciplines?.map((discipline) => discipline.id)).toEqual([
      FurnitureDiscipline.FURNITURE,
      FurnitureDiscipline.JOINERY_CABINETRY,
    ]);
    expect(furnitureJoineryCabinetryEngine.boqSections.map((section) => section.title)).toEqual(SECTION_TITLES);
    expect(demoIndustries.filter((industry) => industry.id === FURNITURE_JOINERY_INDUSTRY_KEY)).toHaveLength(1);
  });

  it("does not replace or alter the existing Furniture and Joinery engines", () => {
    expect(furnitureEngine).toMatchObject({ id: "furniture", name: "Furniture" });
    expect(furnitureEngine.boqSections.map((section) => section.code)).toEqual(["EXE", "WRK", "SEA", "STO"]);
    expect(joineryEngine).toMatchObject({ id: "joinery", name: "Joinery" });
    expect(joineryEngine.boqSections.map((section) => section.code)).toEqual(["KTN", "WRD", "RCP", "WPL"]);
  });
});

describe("Furniture project discipline request validation", () => {
  it.each([
    FurnitureDiscipline.FURNITURE,
    FurnitureDiscipline.JOINERY_CABINETRY,
  ])("accepts the %s discipline for the combined industry", (discipline) => {
    expect(projectCreateRequestSchema.safeParse(requestPayload(FURNITURE_JOINERY_INDUSTRY_KEY, discipline)).success).toBe(true);
    expect(projectFormSchema.safeParse(formPayload(FURNITURE_JOINERY_INDUSTRY_KEY, discipline)).success).toBe(true);
  });

  it("requires a discipline for the combined industry", () => {
    const apiResult = projectCreateRequestSchema.safeParse(requestPayload(FURNITURE_JOINERY_INDUSTRY_KEY));
    const formResult = projectFormSchema.safeParse(formPayload(FURNITURE_JOINERY_INDUSTRY_KEY));
    expect(apiResult.success).toBe(false);
    expect(formResult.success).toBe(false);
  });

  it("preserves existing-industry creation without a discipline and rejects a furniture-only field there", () => {
    expect(projectCreateRequestSchema.safeParse(requestPayload("construction")).success).toBe(true);
    expect(projectFormSchema.safeParse(formPayload("construction")).success).toBe(true);
    expect(projectCreateRequestSchema.safeParse(requestPayload("construction", FurnitureDiscipline.FURNITURE)).success).toBe(false);
    expect(projectFormSchema.safeParse(formPayload("construction", FurnitureDiscipline.FURNITURE)).success).toBe(false);
  });

  it("keeps discipline immutable through the strict project-update contract", () => {
    const result = projectUpdateRequestSchema.safeParse({
      name: "Renamed project",
      discipline: FurnitureDiscipline.JOINERY_CABINETRY,
    });
    expect(result.success).toBe(false);
  });
});

describe("Furniture project discipline persistence (isolated test database)", () => {
  let companyAId: string;
  let companyBId: string;
  let clientAId: string;
  let furnitureIndustryId: string;

  beforeAll(async () => {
    // The full development seed intentionally has its own fixed demo taxonomy.
    // Register the additive runtime engine before creating these isolated tenants.
    await bootstrapIndustryEngines();
    const [companyA, companyB] = await Promise.all([
      prisma.company.create({
        data: {
          legalName: `Furniture Selection A ${RUN_ID}`,
          tradeName: `Furniture Selection A ${RUN_ID}`,
          email: `furniture-selection-a-${RUN_ID}@example.com`,
        },
      }),
      prisma.company.create({
        data: {
          legalName: `Furniture Selection B ${RUN_ID}`,
          tradeName: `Furniture Selection B ${RUN_ID}`,
          email: `furniture-selection-b-${RUN_ID}@example.com`,
        },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyAId);
    await grantUnlimitedPlanForTests(companyBId);

    const [furnitureIndustry, constructionIndustry] = await Promise.all([
      prisma.industryEngine.findUniqueOrThrow({ where: { key: FURNITURE_JOINERY_INDUSTRY_KEY } }),
      prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } }),
    ]);
    furnitureIndustryId = furnitureIndustry.id;
    await prisma.companyIndustryEngine.createMany({
      data: [
        { companyId: companyAId, industryEngineId: furnitureIndustry.id, enabled: true },
        { companyId: companyAId, industryEngineId: constructionIndustry.id, enabled: true },
        { companyId: companyBId, industryEngineId: furnitureIndustry.id, enabled: true },
      ],
    });
    const client = await createClient(companyAId, {
      name: "Furniture Selection Client",
      email: `furniture-client-${RUN_ID}@example.com`,
    });
    clientAId = client.id;
  });

  afterAll(async () => {
    const companyIds = [companyAId, companyBId].filter(Boolean);
    if (companyIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.bOQSection.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.bOQ.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.project.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.client.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    }
    await prisma.$disconnect();
  });

  it.each([
    FurnitureDiscipline.FURNITURE,
    FurnitureDiscipline.JOINERY_CABINETRY,
  ])("creates a %s project, exact sections, and one readable discipline event", async (discipline) => {
    const result = await createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: FURNITURE_JOINERY_INDUSTRY_KEY,
      discipline,
      reference: `FJC-${discipline}-${RUN_ID}`,
      name: `${discipline} Project`,
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });

    expect(result.boq.sections.map((section) => section.title)).toEqual(SECTION_TITLES);
    expect(await getFurnitureProjectDiscipline(companyAId, result.project.databaseId)).toBe(discipline);
    const events = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        entityId: result.project.databaseId,
        action: FURNITURE_DISCIPLINE_SELECTED_ACTION,
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0].payloadJson).toEqual({
      schemaVersion: 1,
      industryKey: FURNITURE_JOINERY_INDUSTRY_KEY,
      discipline,
    });
  });

  it("rejects combined-industry creation without a discipline before writing", async () => {
    const reference = `FJC-MISSING-${RUN_ID}`;
    await expect(createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: FURNITURE_JOINERY_INDUSTRY_KEY,
      reference,
      name: "Missing Discipline Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    })).rejects.toMatchObject({ code: "FURNITURE_DISCIPLINE_REQUIRED" });
    expect(await projectReferenceExists(companyAId, reference)).toBe(false);
  });

  it("keeps the initial discipline immutable and retry-idempotent", async () => {
    const result = await createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: FURNITURE_JOINERY_INDUSTRY_KEY,
      discipline: FurnitureDiscipline.FURNITURE,
      reference: `FJC-IMMUTABLE-${RUN_ID}`,
      name: "Immutable Discipline Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });

    await prisma.$transaction((tx) => recordInitialFurnitureProjectDiscipline(
      companyAId,
      result.project.databaseId,
      FurnitureDiscipline.FURNITURE,
      tx,
      "Furniture Test Actor",
    ));
    await expect(prisma.$transaction((tx) => recordInitialFurnitureProjectDiscipline(
      companyAId,
      result.project.databaseId,
      FurnitureDiscipline.JOINERY_CABINETRY,
      tx,
      "Furniture Test Actor",
    ))).rejects.toMatchObject({ code: "FURNITURE_DISCIPLINE_IMMUTABLE" });

    expect(await prisma.auditLog.count({
      where: {
        companyId: companyAId,
        entityId: result.project.databaseId,
        action: FURNITURE_DISCIPLINE_SELECTED_ACTION,
      },
    })).toBe(1);
    expect(await getFurnitureProjectDiscipline(companyAId, result.project.databaseId)).toBe(FurnitureDiscipline.FURNITURE);
  });

  it("rolls back the project and discipline event if default BOQ section creation fails", async () => {
    const industry = await prisma.industryEngine.findUniqueOrThrow({
      where: { id: furnitureIndustryId },
      select: { configJson: true },
    });
    const beforeEventCount = await prisma.auditLog.count({
      where: { companyId: companyAId, action: FURNITURE_DISCIPLINE_SELECTED_ACTION },
    });
    const reference = `FJC-ATOMIC-${RUN_ID}`;
    const brokenConfig = {
      ...(industry.configJson as Prisma.JsonObject),
      boqSections: [
        { code: "DUP", title: "First", order: 1 },
        { code: "DUP", title: "Second", order: 2 },
      ],
    };

    try {
      await prisma.industryEngine.update({
        where: { id: furnitureIndustryId },
        data: { configJson: brokenConfig },
      });
      await expect(createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: FURNITURE_JOINERY_INDUSTRY_KEY,
        discipline: FurnitureDiscipline.JOINERY_CABINETRY,
        reference,
        name: "Atomic Rollback Project",
        location: "Dubai, UAE",
        currency: "AED",
        taxRate: "5",
        language: "English",
      })).rejects.toThrow();
    } finally {
      await prisma.industryEngine.update({
        where: { id: furnitureIndustryId },
        data: { configJson: industry.configJson as Prisma.InputJsonValue },
      });
    }

    expect(await projectReferenceExists(companyAId, reference)).toBe(false);
    expect(await prisma.auditLog.count({
      where: { companyId: companyAId, action: FURNITURE_DISCIPLINE_SELECTED_ACTION },
    })).toBe(beforeEventCount);
  });

  it("does not expose another tenant's project discipline", async () => {
    const result = await createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: FURNITURE_JOINERY_INDUSTRY_KEY,
      discipline: FurnitureDiscipline.JOINERY_CABINETRY,
      reference: `FJC-TENANT-${RUN_ID}`,
      name: "Tenant Scoped Discipline Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    await expect(getFurnitureProjectDiscipline(companyBId, result.project.databaseId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("preserves authorization and existing-industry creation behavior", async () => {
    await expect(createProjectWithDefaultBoq(actor(companyAId, UserRole.DESIGNER), {
      clientId: clientAId,
      industryEngineId: FURNITURE_JOINERY_INDUSTRY_KEY,
      discipline: FurnitureDiscipline.FURNITURE,
      reference: `FJC-UNAUTHORIZED-${RUN_ID}`,
      name: "Unauthorized Furniture Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    })).rejects.toBeInstanceOf(PermissionDeniedError);

    const existingIndustry = await createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: "construction",
      reference: `FJC-CONSTRUCTION-${RUN_ID}`,
      name: "Existing Industry Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    expect(existingIndustry.project.industryId).toBe("construction");
    expect(await prisma.auditLog.count({
      where: {
        companyId: companyAId,
        entityId: existingIndustry.project.databaseId,
        action: FURNITURE_DISCIPLINE_SELECTED_ACTION,
      },
    })).toBe(0);
  });

  it("rejects a furniture discipline passed directly to another industry", async () => {
    await expect(createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: "construction",
      discipline: FurnitureDiscipline.FURNITURE,
      reference: `FJC-WRONG-INDUSTRY-${RUN_ID}`,
      name: "Wrong Industry Discipline",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    })).rejects.toBeInstanceOf(AppError);
  });
});
