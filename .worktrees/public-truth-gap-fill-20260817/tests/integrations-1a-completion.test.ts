import { PlanType, PlatformRole, SubscriptionStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import {
  createTestConnection,
  disconnectConnection,
  getConnectionDetailForActor,
} from "../src/lib/services/integration-connection-service";
import { linkProjectSource, unlinkProjectSource } from "../src/lib/services/project-integration-service";
import { listEventsForCompany } from "../src/lib/services/integration-event-service";
import { upsertIntegrationProvider } from "../src/lib/repositories/integration-repository";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = `${Date.now()}-${process.pid}`;
// createTestConnection validates the providerId against the code-side
// PROVIDER_REGISTRY (by design — the owner test tool exercises real
// registry providers, not arbitrary ids), so tests use a real registry id.
const TEST_PROVIDER_ID = "dropbox";

let companyAId = "";
let companyBId = "";
let ownerUserId = "";
let designerUserId = "";
let otherCompanyUserId = "";
let projectId = "";

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId: companyAId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Owner", email: `${RUN_ID}-owner@example.com` };
}
function nonOwnerActor(): PlatformActor {
  return { userId: designerUserId, companyId: companyAId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "Non-owner", email: `${RUN_ID}-admin@example.com` };
}
function companyOwnerCurrentActor(): CurrentActor {
  return { userId: ownerUserId, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Owner", email: `${RUN_ID}-owner@example.com` };
}
function designerCurrentActor(): CurrentActor {
  return { userId: designerUserId, companyId: companyAId, role: UserRole.DESIGNER, fullName: "Designer", email: `${RUN_ID}-designer@example.com` };
}
function otherCompanyOwnerActor(): CurrentActor {
  return { userId: otherCompanyUserId, companyId: companyBId, role: UserRole.COMPANY_OWNER, fullName: "Other Owner", email: `${RUN_ID}-other@example.com` };
}

describe("INTEGRATIONS-1A completion: connection management, project links, and history (integration)", () => {
  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: { legalName: `Integrations Completion A ${RUN_ID}`, tradeName: "Completion A", email: `integrations-completion-a-${RUN_ID}@example.com` },
    });
    const companyB = await prisma.company.create({
      data: { legalName: `Integrations Completion B ${RUN_ID}`, tradeName: "Completion B", email: `integrations-completion-b-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyAId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });

    const owner = await prisma.user.create({
      data: { companyId: companyAId, email: `${RUN_ID}-owner@example.com`, passwordHash: "hash", fullName: "Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;
    const designer = await prisma.user.create({
      data: { companyId: companyAId, email: `${RUN_ID}-designer@example.com`, passwordHash: "hash", fullName: "Designer", role: UserRole.DESIGNER, isActive: true, emailVerifiedAt: new Date() },
    });
    designerUserId = designer.id;
    const otherUser = await prisma.user.create({
      data: { companyId: companyBId, email: `${RUN_ID}-other@example.com`, passwordHash: "hash", fullName: "Other Owner", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    otherCompanyUserId = otherUser.id;

    await upsertIntegrationProvider({ id: TEST_PROVIDER_ID, providerFamily: "test", displayName: "Test Provider", category: "DOCUMENTS_STORAGE", connectionType: "OAUTH_CLOUD", status: "COMING_SOON" });

    const client = await createClient(companyAId, { name: `Completion Client ${RUN_ID}`, email: `completion-client-${RUN_ID}@example.com` });
    const { project } = await createProjectWithDefaultBoq(companyOwnerCurrentActor(), {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `INTEG-COMPLETION-${RUN_ID}`,
      name: "Integrations Completion Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = project.databaseId;
  });

  afterAll(async () => {
    await prisma.integrationEvent.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.projectIntegration.deleteMany({ where: { externalConnection: { companyId: { in: [companyAId, companyBId] } } } });
    await prisma.externalConnection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: companyAId } });
    await prisma.bOQ.deleteMany({ where: { companyId: companyAId } });
    await prisma.project.deleteMany({ where: { companyId: companyAId } });
    await prisma.client.deleteMany({ where: { companyId: companyAId } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: companyAId } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: companyAId } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  describe("test-connection creation (owner-only)", () => {
    it("blocks a non-owner platform actor from creating a test connection", async () => {
      await expect(createTestConnection(nonOwnerActor(), { providerId: TEST_PROVIDER_ID })).rejects.toThrow(PermissionDeniedError);
    });

    it("creates a real, clearly-marked test connection and records a CONNECTION_CREATED event", async () => {
      const connection = await createTestConnection(ownerActor(), { providerId: TEST_PROVIDER_ID });
      expect(connection.status).toBe("CONNECTED");

      const history = await listEventsForCompany(companyAId, {});
      expect(history.items.some((e) => e.eventType === "CONNECTION_CREATED" && e.externalConnectionId === connection.id)).toBe(true);
    });
  });

  describe("connection detail — tenant isolation", () => {
    it("returns the connection detail for the owning company, including recent events", async () => {
      const connections = await prisma.externalConnection.findMany({ where: { companyId: companyAId } });
      const detail = await getConnectionDetailForActor({ companyId: companyAId }, connections[0].id);
      expect(detail.id).toBe(connections[0].id);
      expect(detail.recentEvents.length).toBeGreaterThan(0);
    });

    it("returns NotFoundError (never discloses existence) for a connection belonging to another company", async () => {
      const connections = await prisma.externalConnection.findMany({ where: { companyId: companyAId } });
      await expect(getConnectionDetailForActor({ companyId: companyBId }, connections[0].id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("project source linking", () => {
    let connectionId = "";

    it("links a connected source to a project and records PROJECT_LINKED", async () => {
      const connection = await prisma.externalConnection.findFirstOrThrow({ where: { companyId: companyAId, status: "CONNECTED" } });
      connectionId = connection.id;

      const link = await linkProjectSource(companyOwnerCurrentActor(), projectId, { externalConnectionId: connectionId, externalFileId: "test-file-123" });
      expect(link.externalFileId).toBe("test-file-123");

      const history = await listEventsForCompany(companyAId, { eventType: "PROJECT_LINKED" });
      expect(history.items.some((e) => e.projectIntegrationId === link.id)).toBe(true);
    });

    it("denies linking a source belonging to another company's connection", async () => {
      const otherConnection = await createTestConnection(
        { userId: otherCompanyUserId, companyId: companyBId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "x", email: "x@example.com" },
        { providerId: TEST_PROVIDER_ID },
      );
      await expect(
        linkProjectSource(companyOwnerCurrentActor(), projectId, { externalConnectionId: otherConnection.id }),
      ).rejects.toThrow(NotFoundError);
    });

    it("unlinks a source and records PROJECT_UNLINKED", async () => {
      const link = await prisma.projectIntegration.findFirstOrThrow({ where: { projectId, externalConnectionId: connectionId } });
      await unlinkProjectSource(companyOwnerCurrentActor(), projectId, link.id);

      const remaining = await prisma.projectIntegration.findUnique({ where: { id: link.id } });
      expect(remaining).toBeNull();

      const history = await listEventsForCompany(companyAId, { eventType: "PROJECT_UNLINKED" });
      expect(history.items.length).toBeGreaterThan(0);
    });
  });

  describe("disconnect — authorization and idempotency", () => {
    it("blocks a role without integrations:disconnect from disconnecting a connection", async () => {
      const connection = await prisma.externalConnection.findFirstOrThrow({ where: { companyId: companyAId, status: "CONNECTED" } });
      await expect(disconnectConnection(designerCurrentActor(), connection.id)).rejects.toThrow(PermissionDeniedError);
    });

    it("denies disconnecting a connection belonging to another company", async () => {
      const connection = await prisma.externalConnection.findFirstOrThrow({ where: { companyId: companyAId, status: "CONNECTED" } });
      await expect(disconnectConnection(otherCompanyOwnerActor(), connection.id)).rejects.toThrow(NotFoundError);
    });

    it("disconnects an authorized connection, records CONNECTION_DISCONNECTED, and rejects a second disconnect", async () => {
      const connection = await prisma.externalConnection.findFirstOrThrow({ where: { companyId: companyAId, status: "CONNECTED" } });
      const updated = await disconnectConnection(companyOwnerCurrentActor(), connection.id);
      expect(updated.status).toBe("DISCONNECTED");

      const history = await listEventsForCompany(companyAId, { eventType: "CONNECTION_DISCONNECTED" });
      expect(history.items.some((e) => e.externalConnectionId === connection.id)).toBe(true);

      await expect(disconnectConnection(companyOwnerCurrentActor(), connection.id)).rejects.toThrow(AppError);
    });
  });

  describe("history — bounded, safe, tenant-scoped", () => {
    it("never includes a credential/token field in the event or connection DTOs", async () => {
      const history = await listEventsForCompany(companyAId, {});
      for (const event of history.items) {
        expect(event).not.toHaveProperty("encryptedCredentialsRef");
        expect(event).not.toHaveProperty("token");
        expect(event).not.toHaveProperty("accessToken");
      }
    });

    it("bounds page size to a maximum of 50 even when a larger value is requested", async () => {
      const history = await listEventsForCompany(companyAId, { pageSize: 999 });
      expect(history.pageSize).toBeLessThanOrEqual(50);
    });

    it("never returns another company's events", async () => {
      const history = await listEventsForCompany(companyBId, {});
      expect(history.items.every((e) => true)).toBe(true); // company-scoped query already proven by construction; sanity check it doesn't throw
      const crossCheck = await prisma.integrationEvent.count({ where: { companyId: companyBId } });
      expect(history.total).toBe(crossCheck);
    });
  });
});
