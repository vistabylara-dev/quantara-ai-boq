import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient, findClientByEmail } from "../src/lib/repositories/client-repository";
import {
  createProject,
  projectReferenceExists,
} from "../src/lib/repositories/project-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { createClientForCompany } from "../src/lib/services/client-service";
import { ConflictError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = Date.now();

function actor(companyId: string, role: UserRole = UserRole.COMPANY_OWNER): CurrentActor {
  return { userId: "test-user", companyId, role, fullName: "Test Actor", email: "actor@example.com" };
}

describe("client and project services (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let constructionIndustryId: string;

  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: { legalName: `Phase3 Test Co A ${RUN_ID}`, tradeName: `Phase3 Co A`, email: `phase3-a-${RUN_ID}@example.com` },
    });
    const companyB = await prisma.company.create({
      data: { legalName: `Phase3 Test Co B ${RUN_ID}`, tradeName: `Phase3 Co B`, email: `phase3-b-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    await grantUnlimitedPlanForTests(companyAId);
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyBId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    constructionIndustryId = construction.id;
    await prisma.companyIndustryEngine.create({
      data: { companyId: companyAId, industryEngineId: constructionIndustryId, enabled: true },
    });
    // Company B intentionally has no enabled industries, to test the validation path.
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.client.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  describe("client repository and service", () => {
    it("creates a client and detects a duplicate email within the same company", async () => {
      const client = await createClient(companyAId, {
        name: "Apex Holdings",
        email: `apex-${RUN_ID}@example.com`,
      });
      expect(client.companyId).toBe(companyAId);

      await expect(
        createClient(companyAId, { name: "Apex Holdings (again)", email: `apex-${RUN_ID}@example.com` }),
      ).rejects.toThrow(ConflictError);
    });

    it("allows the same email to be used by a client in a different company (tenant isolation)", async () => {
      const email = `shared-${RUN_ID}@example.com`;
      await createClient(companyAId, { name: "Shared Co (A)", email });
      const clientB = await createClient(companyBId, { name: "Shared Co (B)", email });
      expect(clientB.companyId).toBe(companyBId);

      const foundInA = await findClientByEmail(companyAId, email);
      const foundInB = await findClientByEmail(companyBId, email);
      expect(foundInA?.companyId).toBe(companyAId);
      expect(foundInB?.companyId).toBe(companyBId);
      expect(foundInA?.id).not.toBe(foundInB?.id);
    });

    it("blocks a role without clients:manage from creating a client", async () => {
      await expect(
        createClientForCompany(actor(companyAId, UserRole.DESIGNER), {
          name: "Blocked Client",
          email: `blocked-${RUN_ID}@example.com`,
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("allows a project-creating role to create the client required by the new-project workflow", async () => {
      const client = await createClientForCompany(actor(companyAId, UserRole.QUANTITY_SURVEYOR), {
        name: "Project Workflow Client",
        email: `project-workflow-client-${RUN_ID}@example.com`,
      });

      expect(client).toMatchObject({
        companyId: companyAId,
        name: "Project Workflow Client",
      });
    });
  });

  describe("project service: atomic project + default R01 BOQ", () => {
    it("creates a project with a default R01 BOQ and industry-specific sections in one transaction", async () => {
      const client = await createClient(companyAId, { name: "Apex Structural", email: `apex-structural-${RUN_ID}@example.com` });

      const result = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: client.id,
        industryEngineId: "construction",
        reference: `APEX-CON-${RUN_ID}`,
        name: "Apex Office Structural Package",
        location: "Dubai, UAE",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });

      expect(result.project.reference).toBe(`APEX-CON-${RUN_ID}`);
      expect(result.boq.revision).toBe("R01");
      expect(result.boq.sections.length).toBeGreaterThan(0);

      const auditActions = await prisma.auditLog.findMany({
        where: { companyId: companyAId, entityId: { in: [result.project.databaseId, result.boq.databaseId] } },
      });
      expect(auditActions.some((entry) => entry.action === "PROJECT_CREATED")).toBe(true);
      expect(auditActions.some((entry) => entry.action === "BOQ_CREATED")).toBe(true);
    });

    it("rejects a duplicate project reference", async () => {
      const client = await createClient(companyAId, { name: "Dup Client", email: `dup-${RUN_ID}@example.com` });
      const reference = `DUP-REF-${RUN_ID}`;
      await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: client.id,
        industryEngineId: "construction",
        reference,
        name: "First Project",
        location: "Dubai, UAE",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });

      expect(await projectReferenceExists(companyAId, reference)).toBe(true);

      await expect(
        createProjectWithDefaultBoq(actor(companyAId), {
          clientId: client.id,
          industryEngineId: "construction",
          reference,
          name: "Second Project",
          location: "Dubai, UAE",
          currency: "AED",
          taxRate: "5",
          language: "English",
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("rejects a client that belongs to a different company", async () => {
      const foreignClient = await createClient(companyBId, { name: "Foreign Client", email: `foreign-${RUN_ID}@example.com` });

      await expect(
        createProjectWithDefaultBoq(actor(companyAId), {
          clientId: foreignClient.id,
          industryEngineId: "construction",
          reference: `CROSS-TENANT-${RUN_ID}`,
          name: "Cross Tenant Attempt",
          location: "Dubai, UAE",
          currency: "AED",
          taxRate: "5",
          language: "English",
        }),
      ).rejects.toThrow();
    });

    it("rejects an industry engine that is not enabled for the company", async () => {
      const client = await createClient(companyBId, { name: "No Industry Client", email: `noindustry-${RUN_ID}@example.com` });

      await expect(
        createProjectWithDefaultBoq(actor(companyBId), {
          clientId: client.id,
          industryEngineId: "construction",
          reference: `NO-INDUSTRY-${RUN_ID}`,
          name: "No Industry Project",
          location: "Dubai, UAE",
          currency: "AED",
          taxRate: "5",
          language: "English",
        }),
      ).rejects.toThrow();
    });

    it("blocks a role without projects:create from creating a project", async () => {
      const client = await createClient(companyAId, { name: "Blocked Project Client", email: `blockedproj-${RUN_ID}@example.com` });

      await expect(
        createProjectWithDefaultBoq(actor(companyAId, UserRole.DESIGNER), {
          clientId: client.id,
          industryEngineId: "construction",
          reference: `BLOCKED-${RUN_ID}`,
          name: "Blocked Project",
          location: "Dubai, UAE",
          currency: "AED",
          taxRate: "5",
          language: "English",
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("rolls back project creation entirely if the surrounding transaction fails", async () => {
      const client = await createClient(companyAId, { name: "Rollback Client", email: `rollback-${RUN_ID}@example.com` });
      const reference = `ROLLBACK-${RUN_ID}`;

      await expect(
        prisma.$transaction(async (tx) => {
          await createProject(
            companyAId,
            {
              clientId: client.id,
              industryEngineId: "construction",
              reference,
              name: "Rollback Project",
              location: "Dubai, UAE",
              currency: "AED",
              taxRate: "5",
              language: "English",
            },
            tx,
          );
          throw new Error("forced failure after project create");
        }),
      ).rejects.toThrow("forced failure after project create");

      expect(await projectReferenceExists(companyAId, reference)).toBe(false);
    });
  });
});
