import { DocumentTemplateType, UserRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const currentActorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: currentActorMock,
}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET as activityGET } from "../src/app/api/dashboard/activity/route";
import { GET as metricsGET } from "../src/app/api/dashboard/metrics/route";
import { GET as recentBoqsGET } from "../src/app/api/dashboard/recent-boqs/route";
import { GET as recentClientsGET } from "../src/app/api/dashboard/recent-clients/route";
import { GET as recentDocumentsGET } from "../src/app/api/dashboard/recent-documents/route";
import { GET as recentFilesGET } from "../src/app/api/dashboard/recent-files/route";
import { GET as recentProjectsGET } from "../src/app/api/dashboard/recent-projects/route";
import { GET as subscriptionSummaryGET } from "../src/app/api/dashboard/subscription-summary/route";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { calculateBOQTotals } from "../src/lib/calculations/boq-calculator";
import { prisma } from "../src/lib/db/prisma";
import { UnauthorizedError } from "../src/lib/errors/app-error";
import { createBOQItem } from "../src/lib/repositories/boq-repository";
import { createClient } from "../src/lib/repositories/client-repository";
import {
  getCompanyActivity,
  getCompanyDashboardMetrics,
  getCompanySubscriptionSummary,
  getRecentBoqs,
  getRecentClients,
  getRecentDocuments,
  getRecentFiles,
  getRecentProjects,
} from "../src/lib/repositories/company-dashboard-repository";
import { createTemplate } from "../src/lib/repositories/document-template-repository";
import { generateDocument } from "../src/lib/services/document-generation-service";
import { uploadProjectFile } from "../src/lib/services/project-file-service";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { localDocumentStorageAdapter } from "../src/lib/storage/local-document-storage-adapter";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = `${Date.now()}-${process.pid}`;
const userIdByCompany = new Map<string, string>();
const cleanupStorageKeys: string[] = [];

function actor(companyId: string): CurrentActor {
  const userId = userIdByCompany.get(companyId);
  if (!userId) throw new Error(`No test user seeded for company ${companyId}`);
  return { userId, companyId, role: UserRole.COMPANY_OWNER, fullName: "Dashboard Test Actor", email: "actor@example.com" };
}

async function seedTestUser(companyId: string, emailSuffix: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      companyId,
      email: `${emailSuffix}-${RUN_ID}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: "Dashboard Test Actor",
      role: UserRole.COMPANY_OWNER,
      isActive: true,
    },
  });
  userIdByCompany.set(companyId, user.id);
  return user.id;
}

describe("company operations dashboard (integration, real local Postgres)", () => {
  let companyAId = "";
  let companyBId = "";
  let companyEmptyId = "";
  let clientAId = "";
  let projectADatabaseId = "";
  let boqAId = "";
  let boqAItemSellingRate = 0;
  let templateAId = "";
  let documentAId = "";
  let fileAId = "";

  beforeAll(async () => {
    const [companyA, companyB, companyEmpty] = await Promise.all([
      prisma.company.create({
        data: { legalName: `Dashboard Co A ${RUN_ID}`, tradeName: "Dashboard Co A", email: `dash-a-${RUN_ID}@example.com` },
      }),
      prisma.company.create({
        data: { legalName: `Dashboard Co B ${RUN_ID}`, tradeName: "Dashboard Co B", email: `dash-b-${RUN_ID}@example.com` },
      }),
      prisma.company.create({
        data: { legalName: `Dashboard Co Empty ${RUN_ID}`, tradeName: "Dashboard Co Empty", email: `dash-empty-${RUN_ID}@example.com` },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;
    companyEmptyId = companyEmpty.id;

    await grantUnlimitedPlanForTests(companyAId);
    await grantUnlimitedPlanForTests(companyBId);

    await seedTestUser(companyAId, "dash-owner-a");
    await seedTestUser(companyBId, "dash-owner-b");

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyBId, industryEngineId: construction.id, enabled: true } });

    const clientA = await createClient(companyAId, { name: `Dashboard Client A ${RUN_ID}`, email: `dash-client-a-${RUN_ID}@example.com` });
    clientAId = clientA.id;
    const clientB = await createClient(companyBId, { name: `Dashboard Client B ${RUN_ID}` });

    const { project: projectA, boq: boqA } = await createProjectWithDefaultBoq(actor(companyAId), {
      clientId: clientAId,
      industryEngineId: "construction",
      reference: `DASH-A-${RUN_ID}`,
      name: "Dashboard Test Project A",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectADatabaseId = projectA.databaseId;
    boqAId = boqA.id;

    const { item } = await createBOQItem(companyAId, boqA.sections[0].id, {
      itemNumber: 1,
      itemCode: `DASH-ITEM-${RUN_ID}`,
      category: "Concrete",
      description: "Dashboard fixture item",
      specification: "C40 concrete",
      quantity: "10",
      unit: "m3",
      unitCost: "300",
      marginMode: "MARKUP",
      marginPercentage: "20",
      sortOrder: 1,
    });
    boqAItemSellingRate = item.sellingRate.toNumber();

    await createProjectWithDefaultBoq(actor(companyBId), {
      clientId: clientB.id,
      industryEngineId: "construction",
      reference: `DASH-B-${RUN_ID}`,
      name: "Dashboard Test Project B",
      location: "Abu Dhabi",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });

    const template = await createTemplate(companyAId, {
      name: "Dashboard Test Template",
      code: `dash-test-template-${RUN_ID}`,
      type: DocumentTemplateType.CORPORATE_TECHNICAL,
    });
    templateAId = template.id;

    const document = await generateDocument(actor(companyAId), projectADatabaseId, {
      boqId: boqAId,
      templateId: templateAId,
      documentType: "CSV",
      audience: "CLIENT",
    });
    documentAId = document.id;
    const generatedRow = await prisma.generatedDocument.findUniqueOrThrow({ where: { id: documentAId } });
    if (generatedRow.storageKey) cleanupStorageKeys.push(generatedRow.storageKey);

    const upload = await uploadProjectFile(actor(companyAId), projectADatabaseId, {
      originalName: "dashboard-test-drawing.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("dashboard test file contents"),
    });
    fileAId = upload.file.id;
  });

  beforeEach(() => {
    currentActorMock.mockReset();
  });

  afterAll(async () => {
    for (const key of cleanupStorageKeys) {
      await localDocumentStorageAdapter.deleteObject(key).catch(() => undefined);
    }
    const companyIds = [companyAId, companyBId, companyEmptyId];
    await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.extractionJob.deleteMany({ where: { projectFile: { companyId: { in: companyIds } } } }).catch(() => undefined);
    await prisma.projectFile.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.generatedDocument.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.documentTemplate.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.project.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.client.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.$disconnect();
  });

  describe("repository-level tenant isolation and real-data correctness", () => {
    it("scopes dashboard metrics strictly to the requesting company", async () => {
      const metricsA = await getCompanyDashboardMetrics(companyAId);
      expect(metricsA.activeProjects).toBeGreaterThanOrEqual(1);
      expect(metricsA.totalClients).toBeGreaterThanOrEqual(1);
      expect(metricsA.totalBoqs).toBeGreaterThanOrEqual(1);
      expect(metricsA.totalUploadedFiles).toBeGreaterThanOrEqual(1);
      expect(metricsA.totalGeneratedDocuments).toBeGreaterThanOrEqual(1);

      const metricsEmpty = await getCompanyDashboardMetrics(companyEmptyId);
      expect(metricsEmpty).toEqual({
        activeProjects: 0,
        totalClients: 0,
        totalBoqs: 0,
        totalUploadedFiles: 0,
        totalGeneratedDocuments: 0,
        catalogueItems: 0,
        pendingApprovals: 0,
        failedOperations: 0,
      });
    });

    it("never returns another company's projects, BOQs, files, documents, or clients", async () => {
      const [projectsA, projectsB] = await Promise.all([getRecentProjects(companyAId), getRecentProjects(companyBId)]);
      expect(projectsA.some((project) => project.id === projectADatabaseId)).toBe(true);
      expect(projectsB.some((project) => project.id === projectADatabaseId)).toBe(false);

      const boqsB = await getRecentBoqs(companyBId);
      expect(boqsB.some((boq) => boq.id === boqAId)).toBe(false);

      const filesB = await getRecentFiles(companyBId);
      expect(filesB.some((file) => file.id === fileAId)).toBe(false);

      const documentsB = await getRecentDocuments(companyBId);
      expect(documentsB.some((document) => document.id === documentAId)).toBe(false);

      const clientsB = await getRecentClients(companyBId);
      expect(clientsB.some((client) => client.id === clientAId)).toBe(false);
    });

    it("returns real, non-fabricated zero-data states for a company with no records", async () => {
      expect(await getRecentProjects(companyEmptyId)).toEqual([]);
      expect(await getRecentBoqs(companyEmptyId)).toEqual([]);
      expect(await getRecentFiles(companyEmptyId)).toEqual([]);
      expect(await getRecentDocuments(companyEmptyId)).toEqual([]);
      expect(await getRecentClients(companyEmptyId)).toEqual([]);
      expect(await getCompanyActivity(companyEmptyId)).toEqual([]);

      const subscription = await getCompanySubscriptionSummary(companyEmptyId);
      expect(subscription.status).toBe("NONE");
      expect(subscription.planName).toBeNull();
    });

    it("reuses the real financial engine for BOQ totals instead of recomputing them", async () => {
      const boqs = await getRecentBoqs(companyAId);
      const fixtureBoq = boqs.find((boq) => boq.id === boqAId);
      expect(fixtureBoq).toBeDefined();
      expect(fixtureBoq!.itemCount).toBe(1);

      const expectedTotals = calculateBOQTotals(
        [{ totalAmount: boqAItemSellingRate * 10, landedCost: 0, quantity: 10, status: "DRAFT" }],
        0,
        5,
      );
      expect(fixtureBoq!.subtotal).toBeCloseTo(expectedTotals.subtotal.toNumber(), 2);
      expect(fixtureBoq!.grandTotal).toBeCloseTo(expectedTotals.grandTotal.toNumber(), 2);
      expect(fixtureBoq!.project?.currency).toBe("AED");
    });

    it("returns a real, honest subscription summary with the company's own plan only", async () => {
      const subscriptionA = await getCompanySubscriptionSummary(companyAId);
      expect(subscriptionA.companyName).toBe("Dashboard Co A");
      expect(subscriptionA.status).toBe("ACTIVE");
      expect(subscriptionA.planName).toBeTruthy();
    });

    it("reads real audit log activity for the company, never fabricated events", async () => {
      const activity = await getCompanyActivity(companyAId);
      expect(activity.length).toBeGreaterThan(0);
      expect(activity.some((event) => event.action === "FILE_UPLOADED")).toBe(true);
      expect(activity.every((event) => typeof event.createdAt === "string")).toBe(true);
    });
  });

  describe("API route authorization boundary", () => {
    const handlers = [
      metricsGET,
      recentProjectsGET,
      recentBoqsGET,
      recentFilesGET,
      recentDocumentsGET,
      recentClientsGET,
      activityGET,
      subscriptionSummaryGET,
    ];

    it("rejects every dashboard route with 401 when there is no authenticated session", async () => {
      currentActorMock.mockRejectedValue(new UnauthorizedError());
      for (const handler of handlers) {
        const response = await handler();
        expect(response.status).toBe(401);
      }
    });

    it("serves only the authenticated actor's own company data through the metrics route", async () => {
      currentActorMock.mockResolvedValue(actor(companyAId));
      const response = await metricsGET();
      const body = (await response.json()) as { ok: boolean; data: { activeProjects: number } };
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.activeProjects).toBeGreaterThanOrEqual(1);
    });

    it("never leaks another company's records through the recent-projects route", async () => {
      currentActorMock.mockResolvedValue(actor(companyBId));
      const response = await recentProjectsGET();
      const body = (await response.json()) as { ok: boolean; data: Array<{ id: string }> };
      expect(response.status).toBe(200);
      expect(body.data.some((project) => project.id === projectADatabaseId)).toBe(false);
    });
  });

  describe("presentation-layer safety", () => {
    it("never queries Prisma directly from the dashboard page component", () => {
      const source = readFileSync(join(__dirname, "..", "src", "app", "dashboard", "page.tsx"), "utf-8");
      expect(source).not.toMatch(/from ["']@prisma\/client["']/);
      expect(source).not.toMatch(/from ["']@\/lib\/db\/prisma["']/);
    });

    it("never renders a raw storage/blob URL on the dashboard page", () => {
      const source = readFileSync(join(__dirname, "..", "src", "app", "dashboard", "page.tsx"), "utf-8");
      expect(source).not.toMatch(/vercel-storage\.com/);
      expect(source).not.toMatch(/blob:https?:\/\//);
    });
  });
});
