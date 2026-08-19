import { ExtractionMethod, ExtractedEntityType, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { listEntitiesForProject } from "../src/lib/services/extracted-entity-service";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

const RUN_ID = `${Date.now()}-${process.pid}`;

describe("listEntitiesForProject additive ids filter (TAYQAN PR3)", () => {
  let actorA: CurrentActor;
  let companyAId = "";
  let companyBId = "";
  let projectAId = "";
  let entityAId = "";
  let entityAId2 = "";
  let entityBId = "";

  async function makeCompanyWithProject(label: string) {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: {
        legalName: `Ids Filter Test ${label} ${RUN_ID}`,
        tradeName: `Ids Filter Test ${label}`,
        email: `ids-filter-${label}-${RUN_ID}@example.com`,
      },
    });
    await prisma.companyIndustryEngine.create({
      data: { companyId: company.id, industryEngineId: construction.id, enabled: true },
    });
    const client = await createClient(company.id, {
      name: `Ids Filter Client ${label}`,
      email: `ids-filter-client-${label}-${RUN_ID}@example.com`,
    });
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `ids-filter-owner-${label}-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: `Ids Filter Owner ${label}`,
        role: UserRole.COMPANY_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    const actor: CurrentActor = {
      userId: user.id,
      companyId: company.id,
      role: UserRole.COMPANY_OWNER,
      fullName: user.fullName,
      email: user.email,
    };
    const { project } = await createProjectWithDefaultBoq(actor, {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `IDS-FILTER-${label}-${RUN_ID}`,
      name: `Ids Filter Project ${label}`,
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    const source = await prisma.projectFile.create({
      data: {
        companyId: company.id,
        projectId: project.databaseId,
        uploadedByUserId: user.id,
        originalName: `ids-filter-${label}.pdf`,
        safeFileName: `ids-filter-${label}-${RUN_ID}.pdf`,
        storageKey: `${company.id}/${project.databaseId}/ids-filter-${label}-${RUN_ID}.pdf`,
        mimeType: "application/pdf",
        extension: "pdf",
        fileSize: 128,
        checksum: `ids-filter-${label}-${RUN_ID}`,
      },
    });
    return { actor, companyId: company.id, projectId: project.databaseId, sourceId: source.id };
  }

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();

    const companyA = await makeCompanyWithProject("A");
    actorA = companyA.actor;
    companyAId = companyA.companyId;
    projectAId = companyA.projectId;

    const companyB = await makeCompanyWithProject("B");
    companyBId = companyB.companyId;

    const baseEntityA = {
      companyId: companyAId,
      projectId: projectAId,
      projectFileId: companyA.sourceId,
      entityType: ExtractedEntityType.MATERIAL,
      quantity: 1,
      unit: "item",
      confidence: 85,
      extractionMethod: ExtractionMethod.TEXT_LAYER,
      sourceText: "One material item",
    };
    const entityA1 = await prisma.extractedEntity.create({
      data: { ...baseEntityA, label: "Company A entity 1", normalizedLabel: "company a entity 1" },
    });
    const entityA2 = await prisma.extractedEntity.create({
      data: { ...baseEntityA, label: "Company A entity 2", normalizedLabel: "company a entity 2" },
    });
    entityAId = entityA1.id;
    entityAId2 = entityA2.id;

    const entityB = await prisma.extractedEntity.create({
      data: {
        companyId: companyBId,
        projectId: companyB.projectId,
        projectFileId: companyB.sourceId,
        entityType: ExtractedEntityType.MATERIAL,
        quantity: 1,
        unit: "item",
        confidence: 85,
        extractionMethod: ExtractionMethod.TEXT_LAYER,
        sourceText: "Company B item",
        label: "Company B entity",
        normalizedLabel: "company b entity",
      },
    });
    entityBId = entityB.id;
  });

  afterAll(async () => {
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.extractedEntity.deleteMany({ where: { companyId } });
      await prisma.projectFile.deleteMany({ where: { companyId } });
      await prisma.bOQItem.deleteMany({ where: { companyId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.auditLog.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await prisma.$disconnect();
  });

  it("returns only the requested ids when the ids filter is supplied", async () => {
    const result = await listEntitiesForProject(actorA, projectAId, { ids: [entityAId] });
    expect(result.map((entity) => entity.id)).toEqual([entityAId]);
  });

  it("never returns another company's entity even if its id is requested", async () => {
    const result = await listEntitiesForProject(actorA, projectAId, { ids: [entityAId, entityBId] });
    expect(result.map((entity) => entity.id)).toEqual([entityAId]);
    expect(result.some((entity) => entity.id === entityBId)).toBe(false);
  });

  it("preserves existing behavior (returns every entity) when ids is omitted", async () => {
    const result = await listEntitiesForProject(actorA, projectAId, {});
    expect(result.map((entity) => entity.id).sort()).toEqual([entityAId, entityAId2].sort());
  });

  it("returns an empty list when ids is an empty array, matching the omitted-filter fallback", async () => {
    const result = await listEntitiesForProject(actorA, projectAId, { ids: [] });
    expect(result.map((entity) => entity.id).sort()).toEqual([entityAId, entityAId2].sort());
  });
});
