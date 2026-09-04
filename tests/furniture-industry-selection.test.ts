import { UserRole } from "@prisma/client";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projectCreateRequestSchema } from "../src/app/api/_shared/project-payload";
import { demoIndustries } from "../src/config/industries";
import { furnitureEngine } from "../src/config/industries/furniture";
import { joineryEngine } from "../src/config/industries/joinery";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import {
  JOINERY_INDUSTRY_KEY,
  JOINERY_INDUSTRY_NAME,
} from "../src/lib/furniture/types";
import { createClient } from "../src/lib/repositories/client-repository";
import { getBOQRecord, lockBOQ } from "../src/lib/repositories/boq-repository";
import {
  getEnabledIndustry,
  listIndustryEngines,
} from "../src/lib/repositories/industry-repository";
import {
  getProjectRecord,
  listProjects,
} from "../src/lib/repositories/project-repository";
import { bootstrapIndustryEngines } from "../src/lib/services/industry-bootstrap-service";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { projectSchema as projectFormSchema } from "../src/lib/validation/project-schema";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const FORBIDDEN_COMBINED_INDUSTRY_KEY = "furniture-joinery-cabinetry";
const RUN_ID = `${Date.now()}-${process.pid}`;
const SAMPLE_CLIENT_ID = "00000000-0000-4000-8000-000000000001";
const RETIRED_PROJECT_SLUG = `retired-combined-${RUN_ID}`;
const JOINERY_SECTION_TITLES = [
  "PROJECT SUMMARY",
  "BOARD / SHEET MATERIAL — ORDER QUANTITIES",
  "HARDWARE & ACCESSORIES — ORDER QUANTITIES",
  "FULL CUTTING LIST — ALL ROOMS",
  "NOTES, ASSUMPTIONS & VERIFICATION ITEMS",
];

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function actor(companyId: string): CurrentActor {
  return {
    userId: "test-user",
    companyId,
    role: UserRole.COMPANY_OWNER,
    fullName: "Joinery Test Actor",
    email: "joinery-test@example.com",
  };
}

function requestPayload(industryId: string) {
  return {
    clientId: SAMPLE_CLIENT_ID,
    industryId,
    reference: `IND-PAYLOAD-${RUN_ID}`,
    name: "Industry Identity Project",
    description: "",
    location: "Dubai, UAE",
    currency: "AED",
    taxRate: "5",
    language: "English",
  };
}

function formPayload(industryEngineId: string) {
  return {
    clientId: SAMPLE_CLIENT_ID,
    industryEngineId,
    reference: `IND-FORM-${RUN_ID}`,
    name: "Industry Identity Project",
    description: "",
    location: "Dubai, UAE",
    currency: "AED",
    taxRate: 5,
    language: "English",
  };
}

describe("Furniture and Joinery industry identities", () => {
  it("registers only the two established identities and no combined third engine", () => {
    expect(demoIndustries.filter((industry) => industry.id === "furniture")).toHaveLength(1);
    expect(demoIndustries.filter((industry) => industry.id === JOINERY_INDUSTRY_KEY)).toHaveLength(1);
    expect(demoIndustries.some((industry) => industry.id === FORBIDDEN_COMBINED_INDUSTRY_KEY)).toBe(false);
    expect(new Set(demoIndustries.map((industry) => industry.id)).size).toBe(demoIndustries.length);
  });

  it("keeps Furniture active and separate without an automatic cutting list", () => {
    expect(furnitureEngine).toMatchObject({ id: "furniture", name: "Furniture", status: "active" });
    expect(furnitureEngine.boqSections.map((section) => section.code)).toEqual(["EXE", "WRK", "SEA", "STO"]);
    expect(furnitureEngine.boqSections.some((section) => section.code === "CUT")).toBe(false);
    expect(furnitureEngine.calculationTypes).not.toContain("edgeBandingLength");
  });

  it("attaches the exact five cutting-list sections to established Joinery", () => {
    expect(joineryEngine).toMatchObject({
      id: JOINERY_INDUSTRY_KEY,
      name: JOINERY_INDUSTRY_NAME,
      status: "active",
    });
    expect(joineryEngine.boqSections.map((section) => section.title)).toEqual(JOINERY_SECTION_TITLES);
    expect(joineryEngine.boqSections.map((section) => section.code)).toEqual(["PRJ", "BRD", "HWA", "CUT", "VER"]);
  });

  it("keeps every unrelated configured industry equivalent to the autonomous workflow baseline", () => {
    const unrelated = demoIndustries
      .filter((industry) => !["furniture", JOINERY_INDUSTRY_KEY].includes(industry.id))
      .sort((left, right) => left.id.localeCompare(right.id));
    const digest = createHash("sha256").update(stableJson(unrelated)).digest("hex");
    expect(digest).toBe("81569ec1a9c9bf7153ca0fba9ede89ea88aa77726b6a1f2ae5465811e88ba95e");
  });
});

describe("Project creation without combined-industry discipline plumbing", () => {
  it.each(["furniture", JOINERY_INDUSTRY_KEY])("accepts established %s directly", (industryKey) => {
    expect(projectCreateRequestSchema.safeParse(requestPayload(industryKey)).success).toBe(true);
    expect(projectFormSchema.safeParse(formPayload(industryKey)).success).toBe(true);
  });

  it("does not accept the removed discipline selector field at the strict API boundary", () => {
    expect(projectCreateRequestSchema.safeParse({
      ...requestPayload(JOINERY_INDUSTRY_KEY),
      discipline: "JOINERY_CABINETRY",
    }).success).toBe(false);
  });
});

describe("Established Furniture and Joinery project persistence", () => {
  let companyId: string;
  let clientId: string;
  let retiredBoqId: string;

  beforeAll(async () => {
    await bootstrapIndustryEngines();
    const company = await prisma.company.create({
      data: {
        legalName: `Industry Identity ${RUN_ID}`,
        tradeName: `Industry Identity ${RUN_ID}`,
        email: `industry-identity-${RUN_ID}@example.com`,
      },
    });
    companyId = company.id;
    await grantUnlimitedPlanForTests(companyId);
    const industries = await prisma.industryEngine.findMany({
      where: { key: { in: ["furniture", JOINERY_INDUSTRY_KEY] } },
      select: { id: true },
    });
    await prisma.companyIndustryEngine.createMany({
      data: industries.map((industry) => ({
        companyId,
        industryEngineId: industry.id,
        enabled: true,
      })),
    });
    const retiredCombined = await prisma.industryEngine.upsert({
      where: { key: FORBIDDEN_COMBINED_INDUSTRY_KEY },
      update: { isActive: true },
      create: {
        key: FORBIDDEN_COMBINED_INDUSTRY_KEY,
        name: "Retired Combined Test Engine",
        description: "Test-only stale reference row.",
        isActive: true,
        configJson: { id: FORBIDDEN_COMBINED_INDUSTRY_KEY },
      },
    });
    await prisma.companyIndustryEngine.createMany({
      data: [{ companyId, industryEngineId: retiredCombined.id, enabled: true }],
      skipDuplicates: true,
    });
    const client = await createClient(companyId, {
      name: "Industry Identity Client",
      email: `industry-client-${RUN_ID}@example.com`,
    });
    clientId = client.id;
    const retiredProject = await prisma.project.create({
      data: {
        companyId,
        clientId,
        industryEngineId: retiredCombined.id,
        reference: `RETIRED-${RUN_ID}`,
        slug: RETIRED_PROJECT_SLUG,
        name: "Retired Combined Project",
        location: "Dubai, UAE",
        currency: "AED",
        taxRate: "5",
        language: "English",
      },
    });
    const retiredBoq = await prisma.bOQ.create({
      data: {
        companyId,
        projectId: retiredProject.id,
        title: "Retired Combined BOQ",
        taxRate: "5",
      },
    });
    retiredBoqId = retiredBoq.id;
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.auditLog.deleteMany({ where: { companyId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
    await prisma.industryEngine.deleteMany({ where: { key: FORBIDDEN_COMBINED_INDUSTRY_KEY } });
    await prisma.$disconnect();
  });

  it("creates Joinery with five sections and Furniture with its separate schedule", async () => {
    const joinery = await createProjectWithDefaultBoq(actor(companyId), {
      clientId,
      industryEngineId: JOINERY_INDUSTRY_KEY,
      reference: `JNY-${RUN_ID}`,
      name: "Joinery Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    const furniture = await createProjectWithDefaultBoq(actor(companyId), {
      clientId,
      industryEngineId: "furniture",
      reference: `FUR-${RUN_ID}`,
      name: "Furniture Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });

    expect(joinery.project.industryId).toBe(JOINERY_INDUSTRY_KEY);
    expect(joinery.boq.sections.map((section) => section.title)).toEqual(JOINERY_SECTION_TITLES);
    expect(furniture.project.industryId).toBe("furniture");
    expect(furniture.boq.sections.map((section) => section.code)).toEqual(["EXE", "WRK", "SEA", "STO"]);
  });

  it("does not expose or resolve a stale combined database row", async () => {
    const listed = await listIndustryEngines(companyId);
    expect(listed.map((industry) => industry.key)).not.toContain(FORBIDDEN_COMBINED_INDUSTRY_KEY);
    await expect(getEnabledIndustry(companyId, FORBIDDEN_COMBINED_INDUSTRY_KEY))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not expose or resolve a project persisted against the retired combined identity", async () => {
    expect((await listProjects(companyId)).map((project) => project.id)).not.toContain(RETIRED_PROJECT_SLUG);
    await expect(getProjectRecord(companyId, RETIRED_PROJECT_SLUG))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not read or enter the lock flow for a BOQ persisted against the retired identity", async () => {
    await expect(getBOQRecord(companyId, retiredBoqId))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(lockBOQ(companyId, retiredBoqId))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    const persisted = await prisma.bOQ.findUniqueOrThrow({
      where: { id: retiredBoqId },
      select: { isLocked: true, lockedAt: true },
    });
    expect(persisted).toEqual({ isLocked: false, lockedAt: null });
  });
});
