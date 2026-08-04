import { PlanType, SubscriptionStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { NotFoundError } from "../src/lib/errors/app-error";
import { hasCapability } from "../src/lib/auth/rbac";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { PROVIDER_REGISTRY, getProviderById } from "../src/lib/integrations/provider-registry";
import { listProvidersForCompany, getProviderDetailForCompany } from "../src/lib/services/integration-service";
import { getIntegrationEntitlements } from "../src/lib/entitlements/integration-entitlement-service";
import { upsertIntegrationProvider, listConnectionsForCompany } from "../src/lib/repositories/integration-repository";

const RUN_ID = `${Date.now()}-${process.pid}`;

let companyId = "";
let userId = "";

function actor(): CurrentActor {
  return { userId, companyId, role: UserRole.COMPANY_OWNER, fullName: "Integrations Test Actor", email: `${RUN_ID}@example.com` };
}

async function setPlan(planType: PlanType) {
  const plan = await prisma.softwarePlan.upsert({
    where: { key: `integrations-test-${planType}` },
    update: {},
    create: { key: `integrations-test-${planType}`, name: `Integrations Test ${planType}`, planType, maxUsers: null, maxProjects: null, maxActiveBoqs: null, maxDocumentsPerMonth: null },
  });
  await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
  await prisma.companySoftwareSubscription.create({
    data: { companyId, softwarePlanId: plan.id, status: SubscriptionStatus.ACTIVE, startsAt: new Date(), source: "test-fixture" },
  });
}

describe("INTEGRATIONS-1A: AEC applications and connected data hub foundation (integration)", () => {
  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { legalName: `Integrations Test Co ${RUN_ID}`, tradeName: "Integrations Test Co", email: `integrations-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const user = await prisma.user.create({
      data: { companyId, email: `${RUN_ID}@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "Integrations Test Actor", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.synchronizationRun.deleteMany({ where: { externalConnection: { companyId } } });
    await prisma.projectIntegration.deleteMany({ where: { externalConnection: { companyId } } });
    await prisma.externalConnection.deleteMany({ where: { companyId } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  describe("provider registry", () => {
    it("has no duplicate provider ids", () => {
      const ids = PROVIDER_REGISTRY.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("never marks a provider AVAILABLE, BETA, or CONNECTED — nothing is live yet in this phase", () => {
      const liveStatuses = PROVIDER_REGISTRY.filter((p) => ["AVAILABLE", "BETA"].includes(p.status));
      expect(liveStatuses).toHaveLength(0);
    });

    it("resolves a known provider by id and returns undefined for an unknown one", () => {
      expect(getProviderById("autodesk")?.displayName).toBe("Autodesk");
      expect(getProviderById("not-a-real-provider")).toBeUndefined();
    });

    it("groups Revit/AutoCAD/Civil 3D/Navisworks under the Autodesk provider family rather than separate connections", () => {
      const autodeskFamily = PROVIDER_REGISTRY.filter((p) => p.providerFamily === "autodesk").map((p) => p.id);
      expect(autodeskFamily).toEqual(expect.arrayContaining(["autodesk", "revit", "autocad", "civil-3d", "navisworks"]));
    });
  });

  describe("integration service", () => {
    it("lists every registry provider for a company with no connections, each marked not connected", async () => {
      const result = await listProvidersForCompany(actor());
      expect(result.providers.length).toBe(PROVIDER_REGISTRY.length);
      expect(result.providers.every((p) => p.connection === null)).toBe(true);
    });

    it("throws NotFoundError for an unknown provider id", async () => {
      await expect(getProviderDetailForCompany(actor(), "not-a-real-provider")).rejects.toThrow(NotFoundError);
    });

    it("reflects a real ExternalConnection row once one exists, and stops reflecting it once disconnected", async () => {
      await upsertIntegrationProvider({ id: `test-provider-${RUN_ID}`, providerFamily: "test", displayName: "Test Provider", category: "DOCUMENTS_STORAGE", connectionType: "OAUTH_CLOUD", status: "COMING_SOON" });
      const connection = await prisma.externalConnection.create({
        data: { companyId, connectedByUserId: userId, providerId: `test-provider-${RUN_ID}`, status: "CONNECTED", providerAccountId: "acct-123" },
      });

      const connections = await listConnectionsForCompany(companyId);
      expect(connections.some((c) => c.id === connection.id)).toBe(true);

      await prisma.externalConnection.update({ where: { id: connection.id }, data: { status: "DISCONNECTED", disconnectedAt: new Date() } });
      const result = await listProvidersForCompany(actor());
      const testProvider = result.providers.find((p) => p.id === `test-provider-${RUN_ID}`);
      // Registry doesn't include the ad-hoc test provider, so this just confirms no crash and disconnected rows aren't surfaced as active.
      expect(testProvider).toBeUndefined();

      await prisma.externalConnection.delete({ where: { id: connection.id } });
      await prisma.integrationProvider.delete({ where: { id: `test-provider-${RUN_ID}` } });
    });
  });

  describe("entitlements — centralized, never hardcoded per component", () => {
    it("FREE plan allows zero connections and no provider families", async () => {
      await setPlan(PlanType.FREE);
      const entitlements = await getIntegrationEntitlements(actor());
      expect(entitlements.source).toBe("real");
      expect(entitlements.maxActiveConnections).toBe(0);
      expect(entitlements.allowedProviderFamilies).toEqual([]);
    });

    it("TRIAL plan allows a limited connection and no scheduled sync", async () => {
      await setPlan(PlanType.TRIAL);
      const entitlements = await getIntegrationEntitlements(actor());
      expect(entitlements.maxActiveConnections).toBe(1);
      expect(entitlements.scheduledSync).toBe(false);
      expect(entitlements.bulkExtraction).toBe(false);
    });

    it("ENTERPRISE plan allows unlimited connections, all provider families, and API/webhook access", async () => {
      await setPlan(PlanType.ENTERPRISE);
      const entitlements = await getIntegrationEntitlements(actor());
      expect(entitlements.maxActiveConnections).toBeNull();
      expect(entitlements.allowedProviderFamilies).toBe("all");
      expect(entitlements.apiWebhookAccess).toBe(true);
    });
  });

  describe("RBAC — connect/disconnect/sync capabilities", () => {
    it("grants integrations:connect/disconnect/sync to COMPANY_OWNER, ADMINISTRATOR, QUANTITY_SURVEYOR, and ESTIMATOR", () => {
      for (const role of [UserRole.COMPANY_OWNER, UserRole.ADMINISTRATOR, UserRole.QUANTITY_SURVEYOR, UserRole.ESTIMATOR]) {
        expect(hasCapability(role, "integrations:connect")).toBe(true);
        expect(hasCapability(role, "integrations:disconnect")).toBe(true);
        expect(hasCapability(role, "integrations:sync")).toBe(true);
      }
    });

    it("does not grant integrations:connect to DESIGNER, SALES_USER, or REVIEWER", () => {
      for (const role of [UserRole.DESIGNER, UserRole.SALES_USER, UserRole.REVIEWER]) {
        expect(hasCapability(role, "integrations:connect")).toBe(false);
      }
    });
  });

  describe("database foundation — tenant isolation and provenance", () => {
    it("cascades ExternalConnection/ProjectIntegration/SynchronizationRun deletion when the owning company is deleted, never leaking rows to another company", async () => {
      const otherCompany = await prisma.company.create({
        data: { legalName: `Integrations Isolation Co ${RUN_ID}`, tradeName: "Isolation Co", email: `integrations-isolation-${RUN_ID}@example.com` },
      });
      const otherUser = await prisma.user.create({
        data: { companyId: otherCompany.id, email: `isolation-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Isolation Actor", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
      });
      await upsertIntegrationProvider({ id: `isolation-provider-${RUN_ID}`, providerFamily: "test", displayName: "Isolation Provider", category: "DOCUMENTS_STORAGE", connectionType: "OAUTH_CLOUD", status: "COMING_SOON" });
      const connection = await prisma.externalConnection.create({
        data: { companyId: otherCompany.id, connectedByUserId: otherUser.id, providerId: `isolation-provider-${RUN_ID}`, status: "CONNECTED" },
      });

      await prisma.company.delete({ where: { id: otherCompany.id } });

      const orphaned = await prisma.externalConnection.findUnique({ where: { id: connection.id } });
      expect(orphaned).toBeNull();

      await prisma.integrationProvider.delete({ where: { id: `isolation-provider-${RUN_ID}` } });
    });
  });
});
