import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { canCreateProject } from "../src/lib/entitlements/entitlement-service";

/**
 * STRIPE-COMMERCIAL-15 — canCreateProject previously gave every non-trial
 * limited plan the same "The free plan allows one draft project" wording,
 * even a genuine paid plan (Starter/Professional) with its own distinct
 * maxProjects limit. The denial message must name the actual plan and its
 * actual limit. Trial and true-Free (status "NONE") wording must report
 * their canonical limits.
 *
 * The paid-plan case uses a maxProjects: 0 fixture plan so "at limit" is
 * reachable with zero projects. Trial and Free use canonical limits rather
 * than SoftwarePlan.maxProjects.
 */
const RUN_ID = `${Date.now()}-${process.pid}-planmsg`;

async function getOrCreateAnyIndustryEngineId(): Promise<string> {
  const existing = await prisma.industryEngine.findFirst({ select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.industryEngine.create({
    data: { key: `test_planmsg_industry_${RUN_ID}`, name: "Test Industry", description: "", isActive: true, configJson: {} },
  });
  return created.id;
}

describe("canCreateProject — plan-aware denial message", () => {
  let paidCompanyId: string;
  let freeCompanyId: string;
  let trialCompanyId: string;
  let paidPlanId: string;
  let trialPlanId: string;
  const projectIds: string[] = [];
  const clientIds: string[] = [];

  beforeAll(async () => {
    const industryEngineId = await getOrCreateAnyIndustryEngineId();

    const paidPlan = await prisma.softwarePlan.create({
      data: { key: `test_paidmsg_plan_${RUN_ID}`, name: "Starter", planType: "PRO", maxProjects: 0 },
    });
    paidPlanId = paidPlan.id;
    const trialPlan = await prisma.softwarePlan.create({
      data: { key: `test_trialmsg_plan_${RUN_ID}`, name: "Pro Trial", planType: "TRIAL" },
    });
    trialPlanId = trialPlan.id;

    const paidCompany = await prisma.company.create({ data: { legalName: `Paid Plan Co ${RUN_ID}`, tradeName: "Paid Plan Co", email: `paidmsg-${RUN_ID}@example.com` } });
    paidCompanyId = paidCompany.id;
    await prisma.companySoftwareSubscription.create({
      data: { companyId: paidCompanyId, softwarePlanId: paidPlanId, status: "ACTIVE", source: "stripe" },
    });

    const trialCompany = await prisma.company.create({ data: { legalName: `Trial Co ${RUN_ID}`, tradeName: "Trial Co", email: `trialmsg-${RUN_ID}@example.com` } });
    trialCompanyId = trialCompany.id;
    await prisma.companySoftwareSubscription.create({
      data: { companyId: trialCompanyId, softwarePlanId: trialPlanId, status: "TRIAL", source: "self-service", trialStartedAt: new Date(), trialExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    });

    const freeCompany = await prisma.company.create({ data: { legalName: `Free Co ${RUN_ID}`, tradeName: "Free Co", email: `freemsg-${RUN_ID}@example.com` } });
    freeCompanyId = freeCompany.id; // no subscription row at all -> status "NONE"

    for (const [companyId, projectCount] of [[trialCompanyId, 3], [freeCompanyId, 1]] as const) {
      const client = await prisma.client.create({ data: { companyId, name: `Test Client ${RUN_ID}-${companyId}` } });
      clientIds.push(client.id);
      for (let index = 0; index < projectCount; index += 1) {
        const project = await prisma.project.create({
          data: {
            companyId,
            clientId: client.id,
            industryEngineId,
            slug: `test-planmsg-${companyId}-${index}`,
            reference: `TEST-PLANMSG-${RUN_ID}-${index}`,
            name: `Test Project ${index + 1}`,
          },
        });
        projectIds.push(project.id);
      }
    }
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: [paidCompanyId, trialCompanyId, freeCompanyId] } } });
    await prisma.softwarePlan.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.company.deleteMany({ where: { id: { in: [paidCompanyId, trialCompanyId, freeCompanyId] } } });
    await prisma.industryEngine.deleteMany({ where: { key: `test_planmsg_industry_${RUN_ID}` } });
    await prisma.$disconnect();
  });

  it("names the actual paid plan and its actual limit for a genuine paid subscription", async () => {
    const result = await canCreateProject(paidCompanyId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Starter allows 0 projects. Upgrade to create additional projects.");
    expect(result.reason).not.toMatch(/free plan/i);
  });

  it("reports the canonical three-project trial limit", async () => {
    const result = await canCreateProject(trialCompanyId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("The 3-day Pro trial allows 3 projects. Upgrade to create additional projects.");
  });

  it("preserves the exact free-plan (no subscription) wording", async () => {
    const result = await canCreateProject(freeCompanyId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("The free plan allows one draft project. Upgrade to create additional projects.");
  });
});
