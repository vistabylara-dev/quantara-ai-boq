import { prisma } from "@/lib/db/prisma";
import { demoIndustries } from "@/config/industries";

/**
 * Production's IndustryEngine reference table can end up empty — this app has never shipped a
 * production-safe seed step separate from the full local dev demo seed (prisma/seed.ts, which
 * also creates a demo company/suppliers/catalogue and must never run against production). When
 * IndustryEngine is empty, registerCompany's own auto-link step (auth-service.ts) has nothing to
 * link to, so every company — new or existing — ends up with zero CompanyIndustryEngine rows and
 * an empty Industry selector, blocking project creation entirely.
 *
 * This uses the same taxonomy already used by the frontend and by prisma/seed.ts
 * (src/config/industries) — reusing the authoritative source rather than inventing a parallel
 * one. It is safe to run repeatedly: IndustryEngine rows are upserted by their unique `key`, and
 * companies are only backfilled if they currently have zero enabled industry links (so a company
 * that deliberately disabled every industry is not silently re-enabled).
 */
export type IndustryBootstrapResult = {
  industriesCreated: number;
  industriesUpdated: number;
  companiesBackfilled: number;
  totalIndustryEngines: number;
};

export async function bootstrapIndustryEngines(): Promise<IndustryBootstrapResult> {
  let industriesCreated = 0;
  let industriesUpdated = 0;
  const industryIds: string[] = [];

  for (const source of demoIndustries) {
    const existing = await prisma.industryEngine.findUnique({ where: { key: source.id }, select: { id: true } });
    const industry = await prisma.industryEngine.upsert({
      where: { key: source.id },
      update: {
        name: source.name,
        description: source.description,
        isActive: source.status === "active",
        configJson: JSON.parse(JSON.stringify(source)),
      },
      create: {
        key: source.id,
        name: source.name,
        description: source.description,
        isActive: source.status === "active",
        configJson: JSON.parse(JSON.stringify(source)),
      },
      select: { id: true },
    });
    if (existing) industriesUpdated += 1;
    else industriesCreated += 1;
    industryIds.push(industry.id);
  }

  // Backfill only companies with zero enabled links — never touch a company that has
  // deliberately disabled industries (enabled: false rows still count as "has links").
  const companiesWithNoLinks = await prisma.company.findMany({
    where: { industryEngines: { none: {} } },
    select: { id: true },
  });

  let companiesBackfilled = 0;
  for (const company of companiesWithNoLinks) {
    await prisma.companyIndustryEngine.createMany({
      data: industryIds.map((industryEngineId) => ({ companyId: company.id, industryEngineId, enabled: true })),
      skipDuplicates: true,
    });
    companiesBackfilled += 1;
  }

  return {
    industriesCreated,
    industriesUpdated,
    companiesBackfilled,
    totalIndustryEngines: industryIds.length,
  };
}
