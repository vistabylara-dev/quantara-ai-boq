import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { PermissionDeniedError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";
import { getMasterItemRecord } from "@/lib/repositories/master-item-repository";

/**
 * MASTER-SCALE-1A — a computed completeness profile per item (spec section
 * 14: "Do not treat incomplete records as fully verified... Expose
 * appropriate completeness only to platform/master-data administrators").
 * Deliberately computed on read rather than a stored/denormalized table —
 * at the current record count (tens, not hundreds of thousands) a stored
 * profile would just be another thing to keep in sync for no real benefit
 * yet; if catalogue growth (M2+) makes per-request computation too slow,
 * this is the natural place to add a materialized/stored version.
 */

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Completeness profiles are restricted to the platform owner.");
  }
}

export type CompletenessProfile = {
  masterItemId: string;
  identityComplete: boolean;
  hierarchyComplete: boolean;
  descriptionComplete: boolean;
  unitVerified: boolean;
  classificationVerified: boolean;
  attributesComplete: boolean;
  standardsVerified: boolean;
  manufacturerVerified: boolean;
  regionalApplicabilityVerified: boolean;
  drawingMappingReviewed: boolean;
  score: number;
};

export async function computeCompletenessProfile(owner: PlatformActor, masterItemId: string): Promise<CompletenessProfile> {
  requireOwner(owner);
  const item = await getMasterItemRecord(masterItemId);

  const [classificationCount, attributeCount, standardCount, publishedVersion, drawingProfile, modelCount] = await Promise.all([
    prisma.masterItemClassification.count({ where: { masterItemId } }),
    prisma.masterItemAttributeValue.count({ where: { masterItemId } }),
    prisma.masterItemStandardApplicability.count({ where: { masterItemId, verificationState: "VERIFIED" } }),
    prisma.masterItemVersion.findFirst({ where: { masterItemId, status: "PUBLISHED" } }),
    prisma.masterItemDrawingProfile.findUnique({ where: { masterItemId } }),
    prisma.productModel.count({ where: { masterItemVersion: { masterItemId }, verificationState: "VERIFIED" } }),
  ]);
  const regionalCount = await prisma.masterItemRegionalApplicability.count({ where: { masterItemId } });

  const profile: CompletenessProfile = {
    masterItemId,
    identityComplete: Boolean(item.itemCode && item.name),
    hierarchyComplete: Boolean(item.hierarchyNodeId),
    descriptionComplete: Boolean(item.shortDescription || publishedVersion?.shortDescription),
    unitVerified: Boolean(item.defaultUnit),
    classificationVerified: classificationCount > 0,
    attributesComplete: attributeCount > 0,
    standardsVerified: standardCount > 0,
    manufacturerVerified: modelCount > 0,
    regionalApplicabilityVerified: regionalCount > 0,
    drawingMappingReviewed: Boolean(drawingProfile),
    score: 0,
  };

  const flags = [
    profile.identityComplete, profile.hierarchyComplete, profile.descriptionComplete, profile.unitVerified,
    profile.classificationVerified, profile.attributesComplete, profile.standardsVerified,
    profile.manufacturerVerified, profile.regionalApplicabilityVerified, profile.drawingMappingReviewed,
  ];
  profile.score = Math.round((flags.filter(Boolean).length / flags.length) * 100);

  return profile;
}

export type CatalogueGrowthSnapshot = {
  totalMasterItems: number;
  publishedVersions: number;
  itemsWithClassification: number;
  itemsWithHierarchy: number;
  manufacturers: number;
  verifiedProductModels: number;
  standardAuthorities: number;
  disciplines: number;
  hierarchyNodes: number;
};

/** Truthful, un-inflated counts for the catalogue-growth milestone report (spec: "Report... Do not claim M4/M5 because schema capacity exists"). */
export async function getCatalogueGrowthSnapshot(owner: PlatformActor): Promise<CatalogueGrowthSnapshot> {
  requireOwner(owner);
  const [totalMasterItems, publishedVersions, itemsWithClassification, itemsWithHierarchy, manufacturers, verifiedProductModels, standardAuthorities, disciplines, hierarchyNodes] =
    await Promise.all([
      prisma.masterItem.count(),
      prisma.masterItemVersion.count({ where: { status: "PUBLISHED" } }),
      prisma.masterItem.count({ where: { classifications: { some: {} } } }),
      prisma.masterItem.count({ where: { hierarchyNodeId: { not: null } } }),
      prisma.manufacturer.count(),
      prisma.productModel.count({ where: { verificationState: "VERIFIED" } }),
      prisma.standardAuthority.count(),
      prisma.masterDiscipline.count(),
      prisma.masterHierarchyNode.count(),
    ]);

  return { totalMasterItems, publishedVersions, itemsWithClassification, itemsWithHierarchy, manufacturers, verifiedProductModels, standardAuthorities, disciplines, hierarchyNodes };
}

export type HvacMasterDataSummary = {
  itemCount: number;
  familyCount: number;
  variantCount: number;
  publishedCount: number;
  draftCount: number;
  hierarchyNodeCount: number;
  categoryCount: number;
  classificationCount: number;
  recentBatches: {
    id: string;
    uploadedFileName: string;
    status: string;
    totalRows: number;
    insertedCount: number;
    updatedCount: number;
    unchangedCount: number;
    rejectedCount: number;
    warningRows: number;
    executedAt: string | null;
  }[];
};

/**
 * MASTER-SCALE-1B admin review dashboard — the smallest useful set of real
 * counts for the HVAC import (item/family/variant/published/draft/hierarchy/
 * classification counts + recent batch summaries). No 100%-complete claim is
 * ever computed here; that stays the per-item job of computeCompletenessProfile.
 */
export async function getHvacMasterDataSummary(owner: PlatformActor): Promise<HvacMasterDataSummary> {
  requireOwner(owner);
  const mechanical = await prisma.masterDiscipline.findUnique({ where: { key: "mechanical" } });
  const disciplineId = mechanical?.id;

  const [itemCount, familyCount, variantCount, publishedCount, draftCount, hierarchyNodeCount, categoryCount, classificationCount, batches] = await Promise.all([
    disciplineId ? prisma.masterItem.count({ where: { disciplineId } }) : 0,
    prisma.masterHierarchyNode.count({ where: { nodeType: "ITEM_FAMILY" } }),
    prisma.masterItemVariant.count(),
    disciplineId ? prisma.masterItemVersion.count({ where: { status: "PUBLISHED", masterItem: { disciplineId } } }) : 0,
    disciplineId ? prisma.masterItemVersion.count({ where: { status: { in: ["DRAFT", "REVIEW", "APPROVED"] }, masterItem: { disciplineId } } }) : 0,
    disciplineId ? prisma.masterHierarchyNode.count({ where: { code: { startsWith: "construction.mechanical.hvac" } } }) : 0,
    disciplineId ? prisma.masterCategory.count({ where: { disciplineId } }) : 0,
    disciplineId ? prisma.masterItemClassification.count({ where: { masterItem: { disciplineId } } }) : 0,
    prisma.masterCatalogueImportBatch.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return {
    itemCount,
    familyCount,
    variantCount,
    publishedCount,
    draftCount,
    hierarchyNodeCount,
    categoryCount,
    classificationCount,
    recentBatches: batches.map((batch) => {
      const report = batch.validationReportJson as { summary?: { warningRows?: number } } | null;
      return {
        id: batch.id,
        uploadedFileName: batch.uploadedFileName,
        status: batch.status,
        totalRows: batch.totalRows,
        insertedCount: batch.insertedCount,
        updatedCount: batch.updatedCount,
        unchangedCount: batch.unchangedCount,
        rejectedCount: batch.rejectedCount,
        warningRows: report?.summary?.warningRows ?? 0,
        executedAt: batch.executedAt?.toISOString() ?? null,
      };
    }),
  };
}
