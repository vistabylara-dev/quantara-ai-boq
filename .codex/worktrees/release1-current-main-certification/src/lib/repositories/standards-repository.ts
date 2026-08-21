import type { MasterItemStandardApplicability, StandardAuthority } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

/** MASTER-SCALE-1A — standards/approval authorities and item applicability. */

function toAuthorityDTO(row: StandardAuthority) {
  return { id: row.id, name: row.name, country: row.country, website: row.website, createdAt: row.createdAt.toISOString() };
}

export async function listStandardAuthorities() {
  const rows = await prisma.standardAuthority.findMany({ orderBy: { name: "asc" } });
  return rows.map(toAuthorityDTO);
}

/** Idempotent on name — safe to call repeatedly from a seed or admin form. */
export async function createStandardAuthority(input: { name: string; country?: string; website?: string }) {
  const existing = await prisma.standardAuthority.findUnique({ where: { name: input.name } });
  if (existing) return toAuthorityDTO(existing);
  const created = await prisma.standardAuthority.create({ data: { name: input.name, country: input.country, website: input.website } });
  return toAuthorityDTO(created);
}

function toApplicabilityDTO(row: MasterItemStandardApplicability & { standardAuthority: StandardAuthority }) {
  return {
    id: row.id,
    masterItemId: row.masterItemId,
    standardAuthority: toAuthorityDTO(row.standardAuthority),
    clauseReference: row.clauseReference,
    region: row.region,
    applicabilityType: row.applicabilityType,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    supersededDate: row.supersededDate?.toISOString() ?? null,
    sourceDocumentReference: row.sourceDocumentReference,
    verificationState: row.verificationState,
  };
}

export async function listApplicabilitiesForItem(masterItemId: string) {
  const rows = await prisma.masterItemStandardApplicability.findMany({
    where: { masterItemId },
    include: { standardAuthority: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toApplicabilityDTO);
}

export type AddStandardApplicabilityInput = {
  masterItemId: string;
  standardAuthorityId: string;
  clauseReference?: string;
  region?: "UAE" | "GCC" | "INTERNATIONAL" | "COUNTRY_SPECIFIC";
  applicabilityType?: "MANDATORY" | "ADVISORY";
  sourceDocumentReference: string;
};

/** Upsert on (masterItemId, standardAuthorityId, clauseReference, region) — never asserts approval without sourceDocumentReference. */
export async function addStandardApplicability(input: AddStandardApplicabilityInput) {
  const authority = await prisma.standardAuthority.findUnique({ where: { id: input.standardAuthorityId } });
  if (!authority) throw new NotFoundError("Standard authority not found.");

  const clauseReference = input.clauseReference ?? "";
  const region = input.region ?? null;

  const row = await prisma.masterItemStandardApplicability.upsert({
    where: {
      masterItemId_standardAuthorityId_clauseReference: {
        masterItemId: input.masterItemId,
        standardAuthorityId: input.standardAuthorityId,
        clauseReference,
      },
    },
    update: {
      region,
      applicabilityType: input.applicabilityType ?? "ADVISORY",
      sourceDocumentReference: input.sourceDocumentReference,
    },
    create: {
      masterItemId: input.masterItemId,
      standardAuthorityId: input.standardAuthorityId,
      clauseReference,
      region,
      applicabilityType: input.applicabilityType ?? "ADVISORY",
      sourceDocumentReference: input.sourceDocumentReference,
    },
    include: { standardAuthority: true },
  });
  return toApplicabilityDTO(row);
}
