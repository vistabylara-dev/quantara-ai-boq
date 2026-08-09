import {
  ExtractedEntityStatus,
  ExtractedEntityType,
  ExtractionMethod,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import {
  confirmExtractedEntity,
  correctExtractedEntity,
  rejectExtractedEntity,
} from "../src/lib/services/extracted-entity-service";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";

const RUN_ID = `${Date.now()}-${process.pid}`;
const REVIEWABLE_STATUSES = [
  ExtractedEntityStatus.EXTRACTED,
  ExtractedEntityStatus.NEEDS_REVIEW,
] as const;
const FINALIZED_STATUSES = [
  ExtractedEntityStatus.CONFIRMED,
  ExtractedEntityStatus.CORRECTED,
  ExtractedEntityStatus.REJECTED,
  ExtractedEntityStatus.IMPORTED,
] as const;
const REVIEW_DECISIONS = ["confirm", "correct", "reject"] as const;

type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

function requireIsolatedLocalTestDatabase(): void {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is required for this integration test.");
  const parsed = new URL(rawUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || databaseName !== "quantara_e2e_boq") {
    throw new Error("Refusing review-state-machine integration test outside localhost/quantara_e2e_boq.");
  }
}

describe("Release 1 extracted-entity professional review state machine", () => {
  let actor: CurrentActor;
  let companyId = "";
  let projectId = "";
  let projectFileId = "";
  let entityCounter = 0;

  async function createEntity(status: ExtractedEntityStatus) {
    entityCounter += 1;
    const finalizedAt = new Date("2026-01-02T03:04:05.000Z");
    const isConfirmedFinal = status === ExtractedEntityStatus.CONFIRMED || status === ExtractedEntityStatus.CORRECTED || status === ExtractedEntityStatus.IMPORTED;
    const isRejectedFinal = status === ExtractedEntityStatus.REJECTED;
    const hasCorrection = status === ExtractedEntityStatus.CORRECTED || status === ExtractedEntityStatus.REJECTED || status === ExtractedEntityStatus.IMPORTED;

    return prisma.extractedEntity.create({
      data: {
        companyId,
        projectId,
        projectFileId,
        entityType: ExtractedEntityType.MATERIAL,
        label: `Review state entity ${entityCounter}`,
        normalizedLabel: `review state entity ${entityCounter}`,
        quantity: 2,
        unit: "item",
        confidence: 85,
        extractionMethod: ExtractionMethod.TEXT_LAYER,
        sourceText: "Two material items",
        status,
        confirmedByUserId: isConfirmedFinal ? actor.userId : null,
        confirmedAt: isConfirmedFinal ? finalizedAt : null,
        rejectedByUserId: isRejectedFinal ? actor.userId : null,
        rejectedAt: isRejectedFinal ? finalizedAt : null,
        correctionJson: hasCorrection ? { existingDecision: status, reason: "Existing professional decision" } : undefined,
      },
    });
  }

  async function applyDecision(entityId: string, decision: ReviewDecision) {
    switch (decision) {
      case "confirm":
        return confirmExtractedEntity(actor, entityId);
      case "correct":
        return correctExtractedEntity(actor, entityId, {
          label: "Professionally corrected label",
          quantity: 3,
          unit: "set",
          reason: "Verified against the drawing",
        });
      case "reject":
        return rejectExtractedEntity(actor, entityId, "Not supported by the source");
    }
  }

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: {
        legalName: `Review State Test ${RUN_ID}`,
        tradeName: "Review State Test",
        email: `review-state-${RUN_ID}@example.com`,
      },
    });
    companyId = company.id;
    await prisma.companyIndustryEngine.create({
      data: { companyId, industryEngineId: construction.id, enabled: true },
    });
    const client = await createClient(companyId, {
      name: "Review State Client",
      email: `review-state-client-${RUN_ID}@example.com`,
    });
    const user = await prisma.user.create({
      data: {
        companyId,
        email: `review-state-owner-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: "Review State Owner",
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
      clientId: client.id,
      industryEngineId: "construction",
      reference: `REVIEW-STATE-${RUN_ID}`,
      name: "Review State Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = project.databaseId;
    const projectFile = await prisma.projectFile.create({
      data: {
        companyId,
        projectId,
        uploadedByUserId: user.id,
        originalName: "review-state-source.pdf",
        safeFileName: `review-state-source-${RUN_ID}.pdf`,
        storageKey: `${companyId}/${projectId}/review-state-source-${RUN_ID}.pdf`,
        mimeType: "application/pdf",
        extension: "pdf",
        fileSize: 128,
        checksum: `review-state-${RUN_ID}`,
      },
    });
    projectFileId = projectFile.id;
  });

  afterAll(async () => {
    if (!companyId) return;
    await prisma.auditLog.deleteMany({ where: { companyId } });
    await prisma.extractedEntity.deleteMany({ where: { companyId } });
    await prisma.projectFile.deleteMany({ where: { companyId } });
    await prisma.bOQItem.deleteMany({ where: { companyId } });
    await prisma.bOQSection.deleteMany({ where: { companyId } });
    await prisma.bOQ.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  describe.each(REVIEWABLE_STATUSES)("from reviewable status %s", (startingStatus) => {
    it.each(REVIEW_DECISIONS)("allows the professional decision %s exactly once", async (decision) => {
      const entity = await createEntity(startingStatus);

      const result = await applyDecision(entity.id, decision);

      const expectedStatus = {
        confirm: ExtractedEntityStatus.CONFIRMED,
        correct: ExtractedEntityStatus.CORRECTED,
        reject: ExtractedEntityStatus.REJECTED,
      }[decision];
      const expectedAuditAction = {
        confirm: "ENTITY_CONFIRMED",
        correct: "ENTITY_CORRECTED",
        reject: "ENTITY_REJECTED",
      }[decision];
      expect(result.status).toBe(expectedStatus);
      const reloaded = await prisma.extractedEntity.findUniqueOrThrow({ where: { id: entity.id } });
      expect(reloaded.status).toBe(expectedStatus);
      if (decision === "reject") {
        expect(reloaded.rejectedByUserId).toBe(actor.userId);
        expect(reloaded.rejectedAt).not.toBeNull();
      } else {
        expect(reloaded.confirmedByUserId).toBe(actor.userId);
        expect(reloaded.confirmedAt).not.toBeNull();
      }
      if (decision === "correct") {
        expect(reloaded.label).toBe("Professionally corrected label");
        expect(reloaded.quantity?.toNumber()).toBe(3);
        expect(reloaded.unit).toBe("set");
      }
      expect(
        await prisma.auditLog.count({
          where: { companyId, entityId: entity.id, action: expectedAuditAction },
        }),
      ).toBe(1);
    });
  });

  describe.each(FINALIZED_STATUSES)("from finalized status %s", (startingStatus) => {
    it.each(REVIEW_DECISIONS)("blocks the professional decision %s with zero mutation", async (decision) => {
      const entity = await createEntity(startingStatus);
      const before = await prisma.extractedEntity.findUniqueOrThrow({ where: { id: entity.id } });
      const auditCountBefore = await prisma.auditLog.count({ where: { companyId, entityId: entity.id } });

      await expect(applyDecision(entity.id, decision)).rejects.toMatchObject({
        code: "ENTITY_ALREADY_FINALIZED",
        status: 409,
      });

      const after = await prisma.extractedEntity.findUniqueOrThrow({ where: { id: entity.id } });
      const auditCountAfter = await prisma.auditLog.count({ where: { companyId, entityId: entity.id } });
      expect(after).toEqual(before);
      expect(auditCountAfter).toBe(auditCountBefore);
    });
  });

  it("allows exactly one winner when concurrent professional decisions race for the same entity", async () => {
    const entity = await createEntity(ExtractedEntityStatus.EXTRACTED);

    const decisions = await Promise.allSettled([
      confirmExtractedEntity(actor, entity.id),
      rejectExtractedEntity(actor, entity.id, "Concurrent rejection attempt"),
    ]);

    expect(decisions.filter((decision) => decision.status === "fulfilled")).toHaveLength(1);
    const rejectedDecision = decisions.find((decision) => decision.status === "rejected");
    expect(rejectedDecision).toMatchObject({
      status: "rejected",
      reason: { code: "ENTITY_ALREADY_FINALIZED", status: 409 },
    });
    const reloaded = await prisma.extractedEntity.findUniqueOrThrow({ where: { id: entity.id } });
    expect([ExtractedEntityStatus.CONFIRMED, ExtractedEntityStatus.REJECTED]).toContain(reloaded.status);
    expect(
      await prisma.auditLog.count({
        where: {
          companyId,
          entityId: entity.id,
          action: { in: ["ENTITY_CONFIRMED", "ENTITY_REJECTED"] },
        },
      }),
    ).toBe(1);
  });
});
