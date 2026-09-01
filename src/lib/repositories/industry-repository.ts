import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export const RETIRED_COMBINED_INDUSTRY_KEY = "furniture-joinery-cabinetry";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function listIndustryEngines(companyId: string) {
  const links = await prisma.companyIndustryEngine.findMany({
    where: {
      companyId,
      industryEngine: { key: { not: RETIRED_COMBINED_INDUSTRY_KEY } },
    },
    include: { industryEngine: true },
    orderBy: { industryEngine: { name: "asc" } },
  });

  return links.map(({ industryEngine, enabled, id }) => ({
    id: industryEngine.key,
    databaseId: industryEngine.id,
    companyIndustryEngineId: id,
    key: industryEngine.key,
    name: industryEngine.name,
    description: industryEngine.description,
    isActive: industryEngine.isActive,
    enabled,
    configJson: industryEngine.configJson,
  }));
}

export async function setIndustryEnabled(companyId: string, industryId: string, enabled: boolean) {
  if (industryId === RETIRED_COMBINED_INDUSTRY_KEY) {
    throw new NotFoundError("Industry engine is not available for this company.");
  }
  const identifierFilter = isUuid(industryId)
    ? {
        OR: [{ id: industryId }, { industryEngineId: industryId }],
        industryEngine: { key: { not: RETIRED_COMBINED_INDUSTRY_KEY } },
      }
    : { industryEngine: { key: industryId } };
  const link = await prisma.companyIndustryEngine.findFirst({
    where: {
      companyId,
      ...identifierFilter,
    },
  });
  if (!link) throw new NotFoundError("Industry engine is not available for this company.");

  return prisma.companyIndustryEngine.update({
    where: { id: link.id, companyId },
    data: { enabled },
    include: { industryEngine: true },
  });
}

export async function getEnabledIndustry(companyId: string, identifier: string) {
  if (identifier === RETIRED_COMBINED_INDUSTRY_KEY) {
    throw new NotFoundError("Enabled industry engine not found.");
  }
  const identifierFilter = isUuid(identifier)
    ? {
        industryEngineId: identifier,
        industryEngine: { key: { not: RETIRED_COMBINED_INDUSTRY_KEY } },
      }
    : { industryEngine: { key: identifier } };
  const link = await prisma.companyIndustryEngine.findFirst({
    where: {
      companyId,
      enabled: true,
      ...identifierFilter,
    },
    include: { industryEngine: true },
  });
  if (!link) throw new NotFoundError("Enabled industry engine not found.");
  return link.industryEngine;
}
