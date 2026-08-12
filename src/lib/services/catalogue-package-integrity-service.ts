import { createHash } from "node:crypto";
import { MasterCatalogueImportJobStatus, MasterItemVersionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { AppError, PermissionDeniedError } from "@/lib/errors/app-error";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import { listDatasetDefinitions, type DatasetDefinition } from "@/lib/services/catalogue-dataset-registry";
import { getDatasetBatchIds } from "@/lib/services/industry-package-activation-service";

/**
 * CATALOGUE-PHASE7-STRICT-CLOSEOUT — single canonical integrity engine for
 * the governed 15-package catalogue. Replaces the "package ACTIVE + itemCount
 * > 0" shortcut with the actual explicit-membership set comparison: expected
 * dataset items (via batchIds -> MasterItem.sourceBatchId, never
 * disciplineId — several datasets share the construction discipline) versus
 * actual IndustryDataPackageItem rows for the target package. Every caller
 * that needs to know whether a dataset's commercial package is genuinely
 * correct (not just non-empty) goes through here — never re-derive this
 * elsewhere.
 */
function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Catalogue package integrity is restricted to the platform owner.");
  }
}

const SAMPLE_CAP = 50;

export type PackageMembershipSample = { masterItemId: string; itemCode: string; sourceBatchId: string | null };
export type ExtraMembershipSample = PackageMembershipSample & { membershipId: string; owningDatasetId: string | null };

export type CataloguePackageIntegrity = {
  datasetId: string;
  packageKey: string;
  packageId: string | null;
  expectedRowCount: number;
  datasetItemCount: number;
  actualPackageMembershipCount: number;
  expectedItemsPresentInPackageCount: number;
  missingMembershipCount: number;
  extraMembershipCount: number;
  publishedDistinctItemCount: number;
  packageCounterCount: number;
  packageStatus: string | null;
  hasCompletedGovernedJob: boolean;
  strictComplete: boolean;
  missingSample: PackageMembershipSample[];
  extraSample: ExtraMembershipSample[];
  integrityFingerprint: string;
};

function expectedRowCountOf(dataset: DatasetDefinition): number {
  return dataset.files.reduce((sum, f) => sum + f.expectedRowCount, 0);
}

/** Resolves which registered dataset's import batches own a given legacyBatchId — used to identify foreign/stale membership. */
async function resolveOwningDatasetIds(batchIds: string[]): Promise<Map<string, string>> {
  if (batchIds.length === 0) return new Map();
  const jobs = await prisma.masterCatalogueImportJob.findMany({
    where: { legacyBatchId: { in: batchIds } },
    select: { legacyBatchId: true, datasetId: true },
  });
  const map = new Map<string, string>();
  for (const j of jobs) if (j.legacyBatchId) map.set(j.legacyBatchId, j.datasetId);
  return map;
}

export async function computePackageIntegrity(dataset: DatasetDefinition): Promise<CataloguePackageIntegrity> {
  const expectedRowCount = expectedRowCountOf(dataset);
  const batchIds = await getDatasetBatchIds(dataset.datasetId);

  const hasCompletedGovernedJob = Boolean(
    await prisma.masterCatalogueImportJob.findFirst({
      where: {
        datasetId: dataset.datasetId,
        status: { in: [MasterCatalogueImportJobStatus.COMPLETED, MasterCatalogueImportJobStatus.COMPLETED_WITH_WARNINGS] },
      },
      select: { id: true },
    }),
  );

  const pkg = await prisma.industryDataPackage.findUnique({ where: { key: dataset.targetPackageCode } });

  // Expected set: every MasterItem this dataset's own governed jobs ever produced.
  const expectedItems = batchIds.length > 0
    ? await prisma.masterItem.findMany({ where: { sourceBatchId: { in: batchIds } }, select: { id: true, itemCode: true, sourceBatchId: true } })
    : [];
  const expectedById = new Map(expectedItems.map((i) => [i.id, i]));

  // Actual set: the real explicit join-table rows for this package — never inferred from disciplineId.
  const actualMembership = pkg
    ? await prisma.industryDataPackageItem.findMany({ where: { packageId: pkg.id }, select: { id: true, masterItemId: true } })
    : [];
  const actualByMasterItemId = new Map(actualMembership.map((m) => [m.masterItemId, m]));

  const missingIds = expectedItems.filter((i) => !actualByMasterItemId.has(i.id)).map((i) => i.id);
  const extraIds = actualMembership.filter((m) => !expectedById.has(m.masterItemId)).map((m) => m.masterItemId);

  const missingSample: PackageMembershipSample[] = missingIds.slice(0, SAMPLE_CAP).map((id) => {
    const item = expectedById.get(id)!;
    return { masterItemId: item.id, itemCode: item.itemCode, sourceBatchId: item.sourceBatchId };
  });

  let extraSample: ExtraMembershipSample[] = [];
  if (extraIds.length > 0) {
    const extraSlice = extraIds.slice(0, SAMPLE_CAP);
    const extraItems = await prisma.masterItem.findMany({
      where: { id: { in: extraSlice } },
      select: { id: true, itemCode: true, sourceBatchId: true },
    });
    const extraItemById = new Map(extraItems.map((i) => [i.id, i]));
    const extraBatchIds = [...new Set(extraItems.map((i) => i.sourceBatchId).filter((id): id is string => Boolean(id)))];
    const owningDatasetByBatchId = await resolveOwningDatasetIds(extraBatchIds);
    extraSample = extraSlice.map((masterItemId) => {
      const membership = actualByMasterItemId.get(masterItemId)!;
      const item = extraItemById.get(masterItemId);
      return {
        membershipId: membership.id,
        masterItemId,
        itemCode: item?.itemCode ?? "(unknown — MasterItem missing)",
        sourceBatchId: item?.sourceBatchId ?? null,
        owningDatasetId: item?.sourceBatchId ? owningDatasetByBatchId.get(item.sourceBatchId) ?? null : null,
      };
    });
  }

  const publishedDistinct = batchIds.length > 0
    ? await prisma.masterItemVersion.findMany({
        where: { status: MasterItemVersionStatus.PUBLISHED, masterItem: { sourceBatchId: { in: batchIds } } },
        select: { masterItemId: true },
        distinct: ["masterItemId"],
      })
    : [];

  const datasetItemCount = expectedItems.length;
  const actualPackageMembershipCount = actualMembership.length;
  const expectedItemsPresentInPackageCount = expectedItems.length - missingIds.length;
  const missingMembershipCount = missingIds.length;
  const extraMembershipCount = extraIds.length;
  const publishedDistinctItemCount = publishedDistinct.length;
  const packageCounterCount = pkg?.itemCount ?? 0;
  const packageStatus = pkg?.status ?? null;

  const strictComplete =
    datasetItemCount === expectedRowCount &&
    actualPackageMembershipCount === expectedRowCount &&
    expectedItemsPresentInPackageCount === expectedRowCount &&
    missingMembershipCount === 0 &&
    extraMembershipCount === 0 &&
    packageCounterCount === expectedRowCount &&
    publishedDistinctItemCount === expectedRowCount &&
    packageStatus === "ACTIVE" &&
    hasCompletedGovernedJob;

  const fingerprintInput = [
    dataset.datasetId,
    pkg?.id ?? "",
    String(expectedRowCount),
    expectedItems.map((i) => i.id).sort().join(","),
    actualMembership.map((m) => m.masterItemId).sort().join(","),
    String(packageCounterCount),
  ].join("|");
  const integrityFingerprint = createHash("sha256").update(fingerprintInput).digest("hex");

  return {
    datasetId: dataset.datasetId,
    packageKey: dataset.targetPackageCode,
    packageId: pkg?.id ?? null,
    expectedRowCount,
    datasetItemCount,
    actualPackageMembershipCount,
    expectedItemsPresentInPackageCount,
    missingMembershipCount,
    extraMembershipCount,
    publishedDistinctItemCount,
    packageCounterCount,
    packageStatus,
    hasCompletedGovernedJob,
    strictComplete,
    missingSample,
    extraSample,
    integrityFingerprint,
  };
}

export async function computeAllPackageIntegrity(owner: PlatformActor): Promise<CataloguePackageIntegrity[]> {
  requireOwner(owner);
  const datasets = listDatasetDefinitions();
  return Promise.all(datasets.map((d) => computePackageIntegrity(d)));
}

export type CrossPackageOverlap = { packageKeyA: string; packageKeyB: string; sharedCount: number };

/**
 * Real Production overlap — a database-side self join on the explicit
 * IndustryDataPackageItem table, never inferred from sourceBatchId (a
 * MasterItem can legitimately be an explicit member of more than one
 * package). Package keys are parameterized from the committed registry
 * only, never from request input.
 */
export async function computeCrossPackageOverlap(owner: PlatformActor): Promise<CrossPackageOverlap[]> {
  requireOwner(owner);
  const packageKeys = listDatasetDefinitions().map((d) => d.targetPackageCode);
  const rows = await prisma.$queryRaw<Array<{ keyA: string; keyB: string; sharedCount: bigint }>>(Prisma.sql`
    SELECT p1.key AS "keyA", p2.key AS "keyB", COUNT(*)::bigint AS "sharedCount"
    FROM "IndustryDataPackageItem" a
    JOIN "IndustryDataPackageItem" b
      ON a."masterItemId" = b."masterItemId"
     AND a."packageId" < b."packageId"
    JOIN "IndustryDataPackage" p1 ON p1.id = a."packageId"
    JOIN "IndustryDataPackage" p2 ON p2.id = b."packageId"
    WHERE p1.key IN (${Prisma.join(packageKeys)})
      AND p2.key IN (${Prisma.join(packageKeys)})
    GROUP BY p1.key, p2.key
    HAVING COUNT(*) > 0
  `);
  return rows.map((r) => ({ packageKeyA: r.keyA, packageKeyB: r.keyB, sharedCount: Number(r.sharedCount) }));
}

export type ReconcileResult = {
  datasetId: string;
  packageKey: string;
  beforeMembershipCount: number;
  expectedCount: number;
  missingAdded: number;
  extrasRemoved: number;
  afterMembershipCount: number;
  beforePackageCounter: number;
  afterPackageCounter: number;
};

/**
 * Reconciles ONE governed package's explicit membership to exactly match its
 * dataset's expected item set: adds missing rows, removes proven foreign/
 * stale rows, and corrects the denormalized counter. Never deletes
 * MasterItem/MasterItemVersion, never touches sourceBatchId, never touches
 * import jobs, never mutates any other package. Requires the caller to
 * supply the exact fingerprint from a GET computed immediately before —
 * stale evidence is rejected rather than applied blind.
 */
export async function reconcileGovernedPackageMembership(
  owner: PlatformActor,
  packageKey: string,
  expectedFingerprint: string,
): Promise<ReconcileResult> {
  requireOwner(owner);
  const dataset = listDatasetDefinitions().find((d) => d.targetPackageCode === packageKey);
  if (!dataset) throw new AppError("UNKNOWN_PACKAGE", `No governed dataset targets package "${packageKey}".`, 404);

  const before = await computePackageIntegrity(dataset);
  if (before.integrityFingerprint !== expectedFingerprint) {
    throw new AppError("INTEGRITY_CHANGED", "Package integrity changed since this fingerprint was computed. Re-fetch GET package-integrity before retrying.", 409);
  }
  if (!before.packageId) {
    throw new AppError("PACKAGE_NOT_FOUND", `Package "${packageKey}" does not exist yet — nothing to reconcile.`, 409);
  }
  if (before.datasetItemCount !== before.expectedRowCount) {
    throw new AppError(
      "DATASET_PROVENANCE_DEFECT",
      `Dataset "${dataset.datasetId}" itself has ${before.datasetItemCount} items, expected ${before.expectedRowCount} — this is a provenance defect, not a membership defect. Refusing to reconcile package membership.`,
      409,
    );
  }

  const batchIds = await getDatasetBatchIds(dataset.datasetId);
  const expectedItems = await prisma.masterItem.findMany({ where: { sourceBatchId: { in: batchIds } }, select: { id: true } });
  const expectedIdSet = new Set(expectedItems.map((i) => i.id));
  const actualMembership = await prisma.industryDataPackageItem.findMany({ where: { packageId: before.packageId }, select: { id: true, masterItemId: true } });
  const actualIdSet = new Set(actualMembership.map((m) => m.masterItemId));

  const missingItemIds = expectedItems.filter((i) => !actualIdSet.has(i.id)).map((i) => i.id);
  const extraMembershipIds = actualMembership.filter((m) => !expectedIdSet.has(m.masterItemId)).map((m) => m.id);

  const packageId = before.packageId;
  const result = await prisma.$transaction(async (tx) => {
    // Re-verify inside the transaction to close the race window between the pre-check above and this write.
    const currentCount = await tx.industryDataPackageItem.count({ where: { packageId } });
    if (currentCount !== before.actualPackageMembershipCount) {
      throw new AppError("INTEGRITY_CHANGED", "Package membership changed between fingerprint verification and the write — aborting.", 409);
    }

    if (missingItemIds.length > 0) {
      await tx.industryDataPackageItem.createMany({
        data: missingItemIds.map((masterItemId, index) => ({ packageId, masterItemId, sortOrder: index })),
        skipDuplicates: true,
      });
    }
    if (extraMembershipIds.length > 0) {
      await tx.industryDataPackageItem.deleteMany({ where: { id: { in: extraMembershipIds }, packageId } });
    }

    const afterMembershipCount = await tx.industryDataPackageItem.count({ where: { packageId } });
    await tx.industryDataPackage.update({ where: { id: packageId }, data: { itemCount: afterMembershipCount } });

    if (afterMembershipCount !== before.expectedRowCount) {
      throw new AppError(
        "RECONCILE_INCOMPLETE",
        `After reconciliation, package "${packageKey}" has ${afterMembershipCount} members, expected ${before.expectedRowCount}.`,
        500,
      );
    }

    return { afterMembershipCount };
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "CATALOGUE_PACKAGE_MEMBERSHIP_RECONCILED",
    targetType: "IndustryDataPackage",
    targetId: packageId,
    metadata: {
      datasetId: dataset.datasetId,
      packageKey,
      beforeMembershipCount: before.actualPackageMembershipCount,
      expectedCount: before.expectedRowCount,
      missingAdded: missingItemIds.length,
      extrasRemoved: extraMembershipIds.length,
      afterMembershipCount: result.afterMembershipCount,
      beforePackageCounter: before.packageCounterCount,
      afterPackageCounter: result.afterMembershipCount,
      integrityFingerprintBefore: before.integrityFingerprint,
    },
  });

  return {
    datasetId: dataset.datasetId,
    packageKey,
    beforeMembershipCount: before.actualPackageMembershipCount,
    expectedCount: before.expectedRowCount,
    missingAdded: missingItemIds.length,
    extrasRemoved: extraMembershipIds.length,
    afterMembershipCount: result.afterMembershipCount,
    beforePackageCounter: before.packageCounterCount,
    afterPackageCounter: result.afterMembershipCount,
  };
}
