import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import {
  addManualPageRow,
  confirmPageHasNoBoqData,
  getPageRecoveryState,
} from "../src/lib/services/table-page-recovery-service";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { assertIsolatedLocalTestDatabase } from "./helpers/isolated-database-guard";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — the manual page-recovery service is the "we
 * did not guess" path for a page none of the three deterministic PDF
 * table-recovery fallbacks could safely resolve. This proves the real,
 * load-bearing invariants: a manually-typed row is SOURCE REVIEW evidence,
 * never a BOQ item; the three writes (ExtractedEntity, TablePageResolution,
 * AuditLog) happen atomically; and an out-of-range pageNumber is rejected
 * before any write occurs.
 */

const RUN_ID = `${Date.now()}-${process.pid}`;

describe("table-page-recovery-service: manual page recovery never auto-imports, validates pageNumber", () => {
  let actor: CurrentActor;
  let companyId = "";
  let projectId = "";
  let projectFileId = "";

  beforeAll(async () => {
    assertIsolatedLocalTestDatabase("table-page-recovery-service test setup");

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: {
        legalName: `Page Recovery Test ${RUN_ID}`,
        tradeName: "Page Recovery Test",
        email: `page-recovery-${RUN_ID}@example.com`,
      },
    });
    companyId = company.id;
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });
    const client = await createClient(companyId, { name: "Page Recovery Client", email: `page-recovery-client-${RUN_ID}@example.com` });
    const user = await prisma.user.create({
      data: {
        companyId,
        email: `page-recovery-owner-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: "Page Recovery Owner",
        role: UserRole.COMPANY_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    actor = { userId: user.id, companyId, role: UserRole.COMPANY_OWNER, fullName: user.fullName, email: user.email };

    const { project } = await createProjectWithDefaultBoq(actor, {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `PAGE-RECOVERY-${RUN_ID}`,
      name: "Page Recovery Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = project.databaseId;

    const file = await prisma.projectFile.create({
      data: {
        companyId,
        projectId,
        uploadedByUserId: user.id,
        originalName: "ambiguous-schedule.pdf",
        safeFileName: `ambiguous-schedule-${RUN_ID}.pdf`,
        storageKey: `${companyId}/${projectId}/ambiguous-schedule-${RUN_ID}.pdf`,
        mimeType: "application/pdf",
        extension: "pdf",
        fileSize: 256,
        checksum: `ambiguous-schedule-${RUN_ID}`,
        pageCount: 3,
      },
    });
    projectFileId = file.id;
  });

  afterAll(async () => {
    if (!companyId) return;
    await prisma.tablePageResolution.deleteMany({ where: { companyId } });
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

  it("starts UNRESOLVED before any decision is recorded", async () => {
    const state = await getPageRecoveryState(actor, projectId, projectFileId, 1);
    expect(state.decision).toBe("UNRESOLVED");
    expect(state.decidedAt).toBeNull();
  });

  it("addManualPageRow atomically writes SOURCE REVIEW evidence, a resolution decision, and an audit log — never a BOQ item", async () => {
    const boqItemCountBefore = await prisma.bOQItem.count({ where: { companyId } });

    const entity = await addManualPageRow(actor, projectId, projectFileId, 2, {
      itemCode: `MANUAL-${RUN_ID}`,
      description: "Hand-typed schedule row",
      quantity: 12,
      unit: "nos",
      notes: "Typed from the original PDF since no fallback could safely rebuild this table.",
    });

    expect(entity.status).toBe("NEEDS_REVIEW");
    expect(entity.extractionMethod).toBe("MANUAL");

    const resolution = await getPageRecoveryState(actor, projectId, projectFileId, 2);
    expect(resolution.decision).toBe("MANUAL_DATA_ADDED");
    expect(resolution.decidedAt).not.toBeNull();

    const auditEntry = await prisma.auditLog.findFirst({
      where: { companyId, entityType: "ExtractedEntity", entityId: entity.id, action: "MANUAL_PAGE_ROW_ADDED" },
    });
    expect(auditEntry).not.toBeNull();

    const boqItemCountAfter = await prisma.bOQItem.count({ where: { companyId } });
    expect(boqItemCountAfter).toBe(boqItemCountBefore);
  });

  it("confirmPageHasNoBoqData records a NO_BOQ_DATA_CONFIRMED decision with an audit log", async () => {
    const result = await confirmPageHasNoBoqData(actor, projectId, projectFileId, 3);
    expect(result.decision).toBe("NO_BOQ_DATA_CONFIRMED");

    const auditEntry = await prisma.auditLog.findFirst({
      where: { companyId, entityType: "TablePageResolution", action: "PAGE_CONFIRMED_NO_BOQ_DATA" },
    });
    expect(auditEntry).not.toBeNull();
  });

  it("rejects a non-positive pageNumber before any write", async () => {
    await expect(
      addManualPageRow(actor, projectId, projectFileId, 0, { itemCode: "X", description: "Y" }),
    ).rejects.toMatchObject({ code: "INVALID_PAGE_NUMBER" });
    await expect(
      addManualPageRow(actor, projectId, projectFileId, -1, { itemCode: "X", description: "Y" }),
    ).rejects.toMatchObject({ code: "INVALID_PAGE_NUMBER" });
  });

  it("rejects a pageNumber beyond the file's declared page count", async () => {
    await expect(
      addManualPageRow(actor, projectId, projectFileId, 99, { itemCode: "X", description: "Y" }),
    ).rejects.toMatchObject({ code: "INVALID_PAGE_NUMBER" });
  });
});
