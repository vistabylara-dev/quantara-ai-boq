import { prisma } from "@/lib/db/prisma";
import { demoIndustries } from "@/config/industries";
import { isDeepStrictEqual } from "node:util";
import { JOINERY_INDUSTRY_KEY } from "@/lib/furniture/types";
import type { IndustryEngine as ConfiguredIndustryEngine } from "@/types/industry";

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

type AuthoritativeIndustryResult = {
  industriesCreated: number;
  industriesUpdated: number;
  industryIds: string[];
};

type ConfiguredIndustrySyncResult = {
  id: string;
  created: boolean;
  updated: boolean;
};

function industryConfigJson(source: ConfiguredIndustryEngine) {
  return JSON.parse(JSON.stringify(source));
}

/**
 * Synchronizes one configured engine without touching its company links. The
 * value comparison avoids a write (including an updatedAt change) when a
 * repeated synchronization already matches the authoritative configuration.
 */
async function synchronizeConfiguredIndustryEngine(
  source: ConfiguredIndustryEngine,
): Promise<ConfiguredIndustrySyncResult> {
  const configJson = industryConfigJson(source);
  const existing = await prisma.industryEngine.findUnique({
    where: { key: source.id },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      configJson: true,
    },
  });

  if (!existing) {
    const created = await prisma.industryEngine.create({
      data: {
        key: source.id,
        name: source.name,
        description: source.description,
        isActive: source.status === "active",
        configJson,
      },
      select: { id: true },
    });
    return { id: created.id, created: true, updated: false };
  }

  const matches = existing.name === source.name
    && existing.description === source.description
    && existing.isActive === (source.status === "active")
    && isDeepStrictEqual(existing.configJson, configJson);
  if (matches) return { id: existing.id, created: false, updated: false };

  const updated = await prisma.industryEngine.update({
    where: { id: existing.id },
    data: {
      name: source.name,
      description: source.description,
      isActive: source.status === "active",
      configJson,
    },
    select: { id: true },
  });
  return { id: updated.id, created: false, updated: true };
}

/**
 * Refreshes only the industry already enabled for this tenant. This keeps the
 * persisted registry aligned with the authoritative configuration when a new
 * measurement rule starts using an existing canonical BOQ section, without
 * changing any tenant enablement choices.
 */
export async function synchronizeEnabledIndustryEngine(
  companyId: string,
  identifier: string,
): Promise<boolean> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  const link = await prisma.companyIndustryEngine.findFirst({
    where: {
      companyId,
      enabled: true,
      ...(isUuid
        ? { industryEngineId: identifier }
        : { industryEngine: { key: identifier } }),
    },
    select: { industryEngine: { select: { key: true } } },
  });
  if (!link) return false;

  const source = demoIndustries.find((industry) => industry.id === link.industryEngine.key);
  if (!source) return false;
  const result = await synchronizeConfiguredIndustryEngine(source);
  return result.updated;
}

async function synchronizeExistingJoineryIndustryEngine(): Promise<void> {
  const source = demoIndustries.find((industry) => industry.id === JOINERY_INDUSTRY_KEY);
  if (!source) throw new Error("The authoritative Joinery industry configuration is missing.");
  const existing = await prisma.industryEngine.findUnique({
    where: { key: JOINERY_INDUSTRY_KEY },
    select: { id: true },
  });
  if (!existing) return;
  await synchronizeConfiguredIndustryEngine(source);
}

async function upsertAuthoritativeIndustryEngines(): Promise<AuthoritativeIndustryResult> {
  let industriesCreated = 0;
  let industriesUpdated = 0;
  const industryIds: string[] = [];

  for (const source of demoIndustries) {
    const industry = await synchronizeConfiguredIndustryEngine(source);
    if (industry.created) industriesCreated += 1;
    if (industry.updated) industriesUpdated += 1;
    industryIds.push(industry.id);
  }

  return { industriesCreated, industriesUpdated, industryIds };
}

/**
 * Repairs only the current company when it has no industry links at all. Existing enabled or
 * disabled configuration is authoritative and is never changed. This makes the authenticated
 * industry-list boundary safe for companies created while production reference data was empty.
 */
export async function ensureCompanyIndustryEngines(companyId: string): Promise<boolean> {
  const [existingLinks, existingJoineryLinks] = await Promise.all([
    prisma.companyIndustryEngine.count({ where: { companyId } }),
    prisma.companyIndustryEngine.count({
      where: { companyId, industryEngine: { key: JOINERY_INDUSTRY_KEY } },
    }),
  ]);
  if (existingLinks > 0) {
    // Existing tenants keep their exact enabled/disabled link state. Only the
    // established Joinery reference configuration is synchronized in place,
    // and only when this company already has an established Joinery link.
    if (existingJoineryLinks > 0) await synchronizeExistingJoineryIndustryEngine();
    return false;
  }

  const { industryIds } = await upsertAuthoritativeIndustryEngines();
  await prisma.companyIndustryEngine.createMany({
    data: industryIds.map((industryEngineId) => ({ companyId, industryEngineId, enabled: true })),
    skipDuplicates: true,
  });
  return true;
}

export async function bootstrapIndustryEngines(): Promise<IndustryBootstrapResult> {
  const { industriesCreated, industriesUpdated, industryIds } = await upsertAuthoritativeIndustryEngines();

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
