import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import {
  bootstrapIndustryEngines,
  ensureCompanyIndustryEngines,
} from "../src/lib/services/industry-bootstrap-service";
import { demoIndustries } from "../src/config/industries";
import { joineryEngine } from "../src/config/industries/joinery";

/**
 * Regression coverage for the P0 production incident: the IndustryEngine reference table was
 * never seeded in production, so every company — new or existing — had zero
 * CompanyIndustryEngine links, leaving the Industry selector empty and blocking project
 * creation entirely. This proves the bootstrap is idempotent (safe to trigger from the owner
 * route more than once) and only backfills companies that genuinely have zero links.
 */
const RUN_ID = `${Date.now()}-${process.pid}`;
const createdCompanyIds: string[] = [];
let alreadyLinkedCompanyId: string;

// A fresh, zero-link company created on demand — every earlier test in this file also calls
// bootstrapIndustryEngines(), which would backfill any zero-link company created in beforeAll
// before the "backfills" test below gets a chance to observe the pre-backfill state. Creating it
// lazily, right before use, guarantees no prior call in this file could have touched it yet.
async function createZeroLinkCompany(suffix: string): Promise<string> {
  const company = await prisma.company.create({
    data: { legalName: `Bootstrap Backfill Co ${suffix} ${RUN_ID}`, tradeName: "Backfill", email: `bootstrap-backfill-${suffix}-${RUN_ID}@example.com` },
  });
  createdCompanyIds.push(company.id);
  return company.id;
}

beforeAll(async () => {
  const alreadyLinkedCompany = await prisma.company.create({
    data: { legalName: `Bootstrap Linked Co ${RUN_ID}`, tradeName: "Linked", email: `bootstrap-linked-${RUN_ID}@example.com` },
  });
  alreadyLinkedCompanyId = alreadyLinkedCompany.id;
  createdCompanyIds.push(alreadyLinkedCompanyId);

  // Give this company exactly one disabled link — it "has" a link, so the bootstrap must never
  // touch it, even though zero of its industries are currently enabled.
  const anyIndustry = await prisma.industryEngine.findFirst();
  if (anyIndustry) {
    await prisma.companyIndustryEngine.create({
      data: { companyId: alreadyLinkedCompanyId, industryEngineId: anyIndustry.id, enabled: false },
    });
  }
});

afterAll(async () => {
  await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
  await prisma.$disconnect();
});

describe("industry-bootstrap-service (integration, real local Postgres)", () => {
  it("creates every IndustryEngine row from the authoritative taxonomy with a stable, unique key", async () => {
    await bootstrapIndustryEngines();
    const rows = await prisma.industryEngine.findMany({ where: { key: { in: demoIndustries.map((d) => d.id) } } });
    expect(rows.length).toBe(demoIndustries.length);
    const keys = new Set(rows.map((r) => r.key));
    expect(keys.size).toBe(demoIndustries.length);
  });

  it("a second run creates zero duplicate IndustryEngine rows", async () => {
    await bootstrapIndustryEngines();
    const before = await prisma.industryEngine.count({ where: { key: { in: demoIndustries.map((d) => d.id) } } });
    await bootstrapIndustryEngines();
    const after = await prisma.industryEngine.count({ where: { key: { in: demoIndustries.map((d) => d.id) } } });
    expect(after).toBe(before);
  });

  it("backfills a company that has zero industry links", async () => {
    const backfillCompanyId = await createZeroLinkCompany("target");
    const before = await prisma.companyIndustryEngine.count({ where: { companyId: backfillCompanyId } });
    expect(before).toBe(0);

    const result = await bootstrapIndustryEngines();
    expect(result.companiesBackfilled).toBeGreaterThanOrEqual(1);

    const after = await prisma.companyIndustryEngine.findMany({ where: { companyId: backfillCompanyId } });
    expect(after.length).toBe(demoIndustries.length);
    expect(after.every((link) => link.enabled)).toBe(true);
  });

  it("never touches a company that already has at least one industry link, even if disabled", async () => {
    const before = await prisma.companyIndustryEngine.count({ where: { companyId: alreadyLinkedCompanyId } });
    expect(before).toBe(1);

    await bootstrapIndustryEngines();

    const after = await prisma.companyIndustryEngine.count({ where: { companyId: alreadyLinkedCompanyId } });
    expect(after).toBe(1);
  });

  it("running the backfill twice for the same company creates no duplicate links", async () => {
    const targetCompanyId = await createZeroLinkCompany("repeat");
    await bootstrapIndustryEngines();
    const first = await prisma.companyIndustryEngine.count({ where: { companyId: targetCompanyId } });
    await bootstrapIndustryEngines();
    const second = await prisma.companyIndustryEngine.count({ where: { companyId: targetCompanyId } });
    expect(second).toBe(first);
  });

  it("repairs only the requested zero-link company at the authenticated list boundary", async () => {
    const targetCompanyId = await createZeroLinkCompany("on-demand-target");
    const unrelatedCompanyId = await createZeroLinkCompany("on-demand-unrelated");

    expect(await ensureCompanyIndustryEngines(targetCompanyId)).toBe(true);
    expect(await prisma.companyIndustryEngine.count({ where: { companyId: targetCompanyId } }))
      .toBe(demoIndustries.length);
    expect(await prisma.companyIndustryEngine.count({ where: { companyId: unrelatedCompanyId } }))
      .toBe(0);
    expect(await ensureCompanyIndustryEngines(targetCompanyId)).toBe(false);
  });

  it("synchronizes established Joinery for an existing tenant exactly once without changing another industry", async () => {
    await bootstrapIndustryEngines();
    const targetCompanyId = await createZeroLinkCompany("joinery-sync");
    const [joinery, construction] = await Promise.all([
      prisma.industryEngine.findUniqueOrThrow({ where: { key: "joinery" } }),
      prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } }),
    ]);
    await prisma.companyIndustryEngine.create({
      data: { companyId: targetCompanyId, industryEngineId: joinery.id, enabled: true },
    });
    await prisma.industryEngine.update({
      where: { id: joinery.id },
      data: {
        name: "Legacy Joinery",
        configJson: { legacy: true },
      },
    });
    const unrelatedBefore = await prisma.industryEngine.findUniqueOrThrow({
      where: { id: construction.id },
      select: { configJson: true, updatedAt: true },
    });

    expect(await ensureCompanyIndustryEngines(targetCompanyId)).toBe(false);
    const first = await prisma.industryEngine.findUniqueOrThrow({
      where: { id: joinery.id },
      select: { name: true, configJson: true, updatedAt: true },
    });
    expect(first.name).toBe(joineryEngine.name);
    expect(first.configJson).toEqual(JSON.parse(JSON.stringify(joineryEngine)));

    expect(await ensureCompanyIndustryEngines(targetCompanyId)).toBe(false);
    const second = await prisma.industryEngine.findUniqueOrThrow({
      where: { id: joinery.id },
      select: { configJson: true, updatedAt: true },
    });
    expect(second).toEqual({ configJson: first.configJson, updatedAt: first.updatedAt });

    const unrelatedAfter = await prisma.industryEngine.findUniqueOrThrow({
      where: { id: construction.id },
      select: { configJson: true, updatedAt: true },
    });
    expect(unrelatedAfter).toEqual(unrelatedBefore);
  });
});
