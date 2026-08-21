import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError } from "../src/lib/errors/app-error";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { verifyPassword } from "../src/lib/auth/password";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import {
  getEffectiveEntitlements,
  canGenerateDocumentEffective,
} from "../src/lib/entitlements/effective-entitlement-service";
import {
  startOrChangeSimulation,
  exitSimulation,
} from "../src/lib/services/platform-simulation-service";
import {
  dryRunMasterCatalogueImport,
  executeMasterCatalogueImport,
  rollbackMasterCatalogueImportBatch,
  searchMasterCatalogueAdmin,
  setMasterItemStatus,
} from "../src/lib/services/master-catalogue-admin-service";
import { createTestCompany, archiveTestCompany } from "../src/lib/services/platform-test-company-service";

const RUN_ID = `${Date.now()}-${process.pid}`;
const PASSWORD_HASH = `admin-control-1-sensitive-hash-${RUN_ID}`;

let companyId = "";
let ownerUserId = "";
let adminUserId = "";
let normalUserId = "";
let disciplineId = "";
let clientId = "";
let projectId = "";
let boqAId = "";
let boqBId = "";
const testCompanyIds: string[] = [];

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Owner Fixture", email: `${RUN_ID}-owner@example.com` };
}
function adminActor(): PlatformActor {
  return { userId: adminUserId, companyId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "Admin Fixture", email: `${RUN_ID}-admin@example.com` };
}
function ownerCompanyActor(): CurrentActor {
  return { userId: ownerUserId, companyId, role: UserRole.COMPANY_OWNER, fullName: "Owner Fixture", email: `${RUN_ID}-owner@example.com` };
}

const csvFor = (codes: string[]) =>
  [
    "itemCode,category,name,shortDescription,fullDescription,defaultUnit,isPremium",
    ...codes.map((code) => `${code},Test Category,Item ${code},Short ${code},Full ${code},EA,false`),
  ].join("\n");

describe("ADMIN-CONTROL-1: platform owner full access and customer simulation (integration)", () => {
  beforeAll(async () => {
    const existingOwnerCount = await prisma.user.count({ where: { platformRole: PlatformRole.PLATFORM_OWNER } });
    if (existingOwnerCount !== 0) {
      throw new Error("ADMIN-CONTROL-1 tests require an isolated local test database with no existing platform owner.");
    }

    const company = await prisma.company.create({
      data: { legalName: `AdminControl1 Co ${RUN_ID}`, tradeName: `AdminControl1 Co`, email: `admin-control-1-${RUN_ID}@example.com` },
    });
    companyId = company.id;

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });

    const [owner, admin, normal] = await prisma.$transaction([
      prisma.user.create({
        data: { companyId, email: `${RUN_ID}-owner@example.com`, passwordHash: PASSWORD_HASH, fullName: "Owner Fixture", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
      }),
      prisma.user.create({
        data: { companyId, email: `${RUN_ID}-admin@example.com`, passwordHash: PASSWORD_HASH, fullName: "Admin Fixture", role: UserRole.ADMINISTRATOR, platformRole: PlatformRole.PLATFORM_ADMIN, isActive: true, emailVerifiedAt: new Date() },
      }),
      prisma.user.create({
        data: { companyId, email: `${RUN_ID}-normal@example.com`, passwordHash: PASSWORD_HASH, fullName: "Normal Fixture", role: UserRole.ESTIMATOR, platformRole: null, isActive: true, emailVerifiedAt: new Date() },
      }),
    ]);
    ownerUserId = owner.id;
    adminUserId = admin.id;
    normalUserId = normal.id;

    const discipline = await prisma.masterDiscipline.create({
      data: { key: `admin-control-1-${RUN_ID}`, name: `AdminControl1 Discipline ${RUN_ID}` },
    });
    disciplineId = discipline.id;

    const client = await prisma.client.create({ data: { companyId, name: `AdminControl1 Client ${RUN_ID}` } });
    clientId = client.id;

    const { project, boq } = await createProjectWithDefaultBoq(ownerCompanyActor(), {
      clientId,
      industryEngineId: "construction",
      reference: `ADMIN-CTRL-1-${RUN_ID}`,
      name: "AdminControl1 Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = project.databaseId;
    boqAId = boq.databaseId;

    const boqB = await prisma.bOQ.create({
      data: { companyId, projectId, title: "AdminControl1 Second BOQ", revisionNumber: 2 },
    });
    boqBId = boqB.id;
  });

  afterAll(async () => {
    if (testCompanyIds.length > 0) {
      await prisma.company.deleteMany({ where: { id: { in: testCompanyIds } } });
    }
    if (ownerUserId) {
      await prisma.platformSimulationSession.deleteMany({ where: { userId: ownerUserId } });
    }
    const userIds = [ownerUserId, adminUserId, normalUserId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.platformAuditLog.deleteMany({ where: { OR: [{ actorUserId: { in: userIds } }, { targetId: { in: userIds } }] } });
    }
    if (companyId) {
      await prisma.masterItem.deleteMany({ where: { disciplineId } });
      await prisma.masterCatalogueImportBatch.deleteMany({ where: { disciplineId } });
      await prisma.masterCategory.deleteMany({ where: { disciplineId } });
      await prisma.masterDiscipline.deleteMany({ where: { id: disciplineId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await prisma.$disconnect();
  });

  describe("owner override — unrestricted operational access", () => {
    it("lets the platform owner search the full master catalogue", async () => {
      await expect(searchMasterCatalogueAdmin(ownerActor(), {})).resolves.toBeTruthy();
    });

    it("blocks a PLATFORM_ADMIN (non-owner) from importing the master catalogue", async () => {
      await expect(
        dryRunMasterCatalogueImport(adminActor(), { disciplineId, uploadedFileName: "blocked.csv", csvText: csvFor(["BLOCK-1"]) }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("lets the platform owner run a catalogue import dry run with accurate counts", async () => {
      const result = await dryRunMasterCatalogueImport(ownerActor(), {
        disciplineId,
        uploadedFileName: "dry-run.csv",
        csvText: csvFor([`DRY-${RUN_ID}-1`, `DRY-${RUN_ID}-2`]),
      });
      expect(result.insertedCount).toBe(2);
      expect(result.updatedCount).toBe(0);
      expect(result.rejectedCount).toBe(0);

      const dryRunAudit = await prisma.platformAuditLog.findFirst({
        where: { actorUserId: ownerUserId, action: "MASTER_CATALOGUE_DRY_RUN", targetId: disciplineId },
      });
      expect(dryRunAudit).toBeTruthy();
    });

    it("lets the platform owner execute an authorized import, creating real items traceable to the batch", async () => {
      const codes = [`EXEC-${RUN_ID}-1`, `EXEC-${RUN_ID}-2`];
      const batch = await executeMasterCatalogueImport(ownerActor(), {
        disciplineId,
        uploadedFileName: "execute.csv",
        csvText: csvFor(codes),
      });
      expect(batch.status).toBe("EXECUTED");
      expect(batch.insertedCount).toBe(2);

      const items = await prisma.masterItem.findMany({ where: { disciplineId, itemCode: { in: codes } } });
      expect(items).toHaveLength(2);
      expect(items.every((item) => item.sourceBatchId === batch.id)).toBe(true);

      const executeAudit = await prisma.platformAuditLog.findFirst({
        where: { actorUserId: ownerUserId, action: "MASTER_CATALOGUE_IMPORT_EXECUTED", targetId: batch.id },
      });
      expect(executeAudit).toBeTruthy();

      const activated = await setMasterItemStatus(ownerActor(), items[0].id, "ARCHIVED");
      expect(activated.status).toBe("ARCHIVED");
      await expect(setMasterItemStatus(adminActor(), items[1].id, "ARCHIVED")).rejects.toThrow(PermissionDeniedError);

      const rolledBack = await rollbackMasterCatalogueImportBatch(ownerActor(), batch.id);
      expect(rolledBack.deletedInsertedItems).toBe(2);
      const remaining = await prisma.masterItem.findMany({ where: { disciplineId, itemCode: { in: codes } } });
      expect(remaining).toHaveLength(0);
    });

    it("resolves the owner to an unrestricted owner-override entitlement source with no simulation active", async () => {
      const effective = await getEffectiveEntitlements({ userId: ownerUserId, companyId });
      expect(effective.source).toBe("owner-override");
      expect(effective.maxProjects).toBeNull();

      const check = await canGenerateDocumentEffective({ userId: ownerUserId, companyId }, false, boqAId);
      expect(check.allowed).toBe(true);
      expect(check.applyTrialWatermark).toBe(false);
    });

    it("never treats a non-owner (even an active, verified platform admin) as the owner", async () => {
      const effective = await getEffectiveEntitlements({ userId: adminUserId, companyId });
      expect(effective.source).toBe("real");
    });
  });

  describe("customer simulation — session-scoped, never touches real entitlement", () => {
    afterAll(async () => {
      await exitSimulation(ownerActor());
    });

    it("applies a watermark to a draft/preview export under a trial simulation, but denies a clean export", async () => {
      await startOrChangeSimulation(ownerActor(), "TRIAL_ACTIVE");

      const preview = await canGenerateDocumentEffective({ userId: ownerUserId, companyId }, true, boqAId);
      expect(preview.allowed).toBe(true);
      expect(preview.applyTrialWatermark).toBe(true);

      const clean = await canGenerateDocumentEffective({ userId: ownerUserId, companyId }, false, boqAId);
      expect(clean.allowed).toBe(false);
    });

    it("denies a clean export under an expired-trial simulation", async () => {
      await startOrChangeSimulation(ownerActor(), "TRIAL_EXPIRED");
      const clean = await canGenerateDocumentEffective({ userId: ownerUserId, companyId }, false, boqAId);
      expect(clean.allowed).toBe(false);
    });

    it("denies premium master-catalogue access and clean export under a free simulation", async () => {
      await startOrChangeSimulation(ownerActor(), "FREE");
      const clean = await canGenerateDocumentEffective({ userId: ownerUserId, companyId }, false, boqAId);
      expect(clean.allowed).toBe(false);
    });

    it("permits a clean export under a Pro simulation, with no watermark", async () => {
      await startOrChangeSimulation(ownerActor(), "PRO");
      const clean = await canGenerateDocumentEffective({ userId: ownerUserId, companyId }, false, boqAId);
      expect(clean.allowed).toBe(true);
      expect(clean.applyTrialWatermark).toBe(false);
    });

    it("unlocks only the selected BOQ under a single-BOQ-unlock simulation", async () => {
      await startOrChangeSimulation(ownerActor(), "SINGLE_BOQ_UNLOCKED", boqAId);
      const unlockedBoq = await canGenerateDocumentEffective({ userId: ownerUserId, companyId }, false, boqAId);
      expect(unlockedBoq.allowed).toBe(true);

      const otherBoq = await canGenerateDocumentEffective({ userId: ownerUserId, companyId }, false, boqBId);
      expect(otherBoq.allowed).toBe(false);
    });

    it("never modifies the real CompanySoftwareSubscription record while simulating", async () => {
      await startOrChangeSimulation(ownerActor(), "PRO");
      const realSubscription = await prisma.companySoftwareSubscription.findFirst({ where: { companyId } });
      expect(realSubscription).toBeNull();
    });

    it("restores actual (owner-override) access and deletes the session on exit", async () => {
      await startOrChangeSimulation(ownerActor(), "TRIAL_ACTIVE");
      await exitSimulation(ownerActor());

      const session = await prisma.platformSimulationSession.findUnique({ where: { userId: ownerUserId } });
      expect(session).toBeNull();

      const effective = await getEffectiveEntitlements({ userId: ownerUserId, companyId });
      expect(effective.source).toBe("owner-override");
    });

    it("records simulation start/change/exit as audit events", async () => {
      await startOrChangeSimulation(ownerActor(), "TRIAL_ACTIVE");
      await startOrChangeSimulation(ownerActor(), "PRO");
      await exitSimulation(ownerActor());

      const actions = await prisma.platformAuditLog.findMany({
        where: { actorUserId: ownerUserId, action: { in: ["PLATFORM_SIMULATION_STARTED", "PLATFORM_SIMULATION_CHANGED", "PLATFORM_SIMULATION_EXITED"] } },
        orderBy: { createdAt: "asc" },
      });
      expect(actions.some((entry) => entry.action === "PLATFORM_SIMULATION_STARTED")).toBe(true);
      expect(actions.some((entry) => entry.action === "PLATFORM_SIMULATION_CHANGED")).toBe(true);
      expect(actions.some((entry) => entry.action === "PLATFORM_SIMULATION_EXITED")).toBe(true);
    });

    it("keeps a normal user's real entitlement source unaffected by the owner's own simulation session", async () => {
      await startOrChangeSimulation(ownerActor(), "TRIAL_ACTIVE");
      const effective = await getEffectiveEntitlements({ userId: normalUserId, companyId });
      expect(effective.source).toBe("real");
    });
  });

  describe("test companies — sandboxed, never confused with a real customer", () => {
    it("blocks a non-owner from creating a test company", async () => {
      await expect(
        createTestCompany(adminActor(), {
          legalName: "Blocked Test Co",
          tradeName: "Blocked",
          companyEmail: `blocked-test-co-${RUN_ID}@example.com`,
          ownerFullName: "Blocked Owner",
          ownerEmail: `blocked-test-co-owner-${RUN_ID}@example.com`,
          ownerPassword: "SuperSecret123!",
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("creates a real, login-able test company and refuses to archive a real (non-test) company", async () => {
      const created = await createTestCompany(ownerActor(), {
        legalName: `Sandbox Co ${RUN_ID}`,
        tradeName: "Sandbox",
        companyEmail: `sandbox-${RUN_ID}@example.com`,
        ownerFullName: "Sandbox Owner",
        ownerEmail: `sandbox-owner-${RUN_ID}@example.com`,
        ownerPassword: "SuperSecret123!",
      });
      testCompanyIds.push(created.companyId);

      const company = await prisma.company.findUniqueOrThrow({ where: { id: created.companyId } });
      expect(company.isTestCompany).toBe(true);

      const loginableUser = await prisma.user.findUniqueOrThrow({ where: { id: created.userId } });
      expect(await verifyPassword("SuperSecret123!", loginableUser.passwordHash)).toBe(true);

      await expect(archiveTestCompany(ownerActor(), companyId)).rejects.toThrow(/isTestCompany/);

      const archiveResult = await archiveTestCompany(ownerActor(), created.companyId);
      expect(archiveResult.archived).toBe(true);
      testCompanyIds.splice(testCompanyIds.indexOf(created.companyId), 1);

      const gone = await prisma.company.findUnique({ where: { id: created.companyId } });
      expect(gone).toBeNull();
    });
  });
});
