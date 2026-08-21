import { ExtractionMethod, ExtractedEntityType, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { confirmExtractedEntity, rejectExtractedEntity } from "../src/lib/services/extracted-entity-service";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";

const RUN_ID = `${Date.now()}-${process.pid}`;

function requireIsolatedLocalTestDatabase(): void {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is required for this integration test.");
  const parsed = new URL(rawUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || databaseName !== "quantara_e2e_boq") {
    throw new Error("Refusing extraction-review integration test outside localhost/quantara_e2e_boq.");
  }
}

describe("extraction review actions never import into the BOQ", () => {
  let actor: CurrentActor;
  let companyId = "";
  let projectId = "";
  let clientId = "";
  let confirmedEntityId = "";
  let rejectedEntityId = "";

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: {
        legalName: `Source Review Test ${RUN_ID}`,
        tradeName: "Source Review Test",
        email: `source-review-${RUN_ID}@example.com`,
      },
    });
    companyId = company.id;
    await prisma.companyIndustryEngine.create({
      data: { companyId, industryEngineId: construction.id, enabled: true },
    });
    const client = await createClient(companyId, {
      name: "Source Review Client",
      email: `source-review-client-${RUN_ID}@example.com`,
    });
    clientId = client.id;
    const user = await prisma.user.create({
      data: {
        companyId,
        email: `source-review-owner-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: "Source Review Owner",
        role: UserRole.COMPANY_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    actor = {
      userId: user.id,
      companyId,
      role: UserRole.COMPANY_OWNER,
      fullName: user.fullName,
      email: user.email,
    };
    const { project } = await createProjectWithDefaultBoq(actor, {
      clientId,
      industryEngineId: "construction",
      reference: `SOURCE-REVIEW-${RUN_ID}`,
      name: "Source Review Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = project.databaseId;
    const source = await prisma.projectFile.create({
      data: {
        companyId,
        projectId,
        uploadedByUserId: user.id,
        originalName: "source-review.pdf",
        safeFileName: `source-review-${RUN_ID}.pdf`,
        storageKey: `${companyId}/${projectId}/source-review-${RUN_ID}.pdf`,
        mimeType: "application/pdf",
        extension: "pdf",
        fileSize: 128,
        checksum: `source-review-${RUN_ID}`,
      },
    });
    const baseEntity = {
      companyId,
      projectId,
      projectFileId: source.id,
      entityType: ExtractedEntityType.MATERIAL,
      quantity: 1,
      unit: "item",
      confidence: 85,
      extractionMethod: ExtractionMethod.TEXT_LAYER,
      sourceText: "One material item",
    };
    const confirmed = await prisma.extractedEntity.create({
      data: {
        ...baseEntity,
        label: "Candidate to confirm",
        normalizedLabel: "candidate to confirm",
      },
    });
    const rejected = await prisma.extractedEntity.create({
      data: {
        ...baseEntity,
        label: "Candidate to reject",
        normalizedLabel: "candidate to reject",
      },
    });
    confirmedEntityId = confirmed.id;
    rejectedEntityId = rejected.id;
  });

  afterAll(async () => {
    if (!companyId) return;
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
    await prisma.$disconnect();
  });

  it("keeps the BOQ item count unchanged after confirm and reject", async () => {
    const beforeCount = await prisma.bOQItem.count({ where: { companyId } });

    const confirmed = await confirmExtractedEntity(actor, confirmedEntityId);
    const rejected = await rejectExtractedEntity(actor, rejectedEntityId, "Not relevant to the BOQ scope");

    const afterCount = await prisma.bOQItem.count({ where: { companyId } });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(rejected.status).toBe("REJECTED");
    expect(afterCount).toBe(beforeCount);
  });
});
