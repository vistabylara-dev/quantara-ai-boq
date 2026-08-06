import { IndustryPackageStatus, MasterItemVersionStatus, PlatformRole, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import { requireDatasetDefinition, type DatasetDefinition } from "@/lib/services/catalogue-dataset-registry";

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== PlatformRole.PLATFORM_OWNER) {
    throw new PermissionDeniedError("Catalogue activation actions are restricted to the platform owner.");
  }
}

type DatasetScope = {
  dataset: DatasetDefinition;
  disciplineId: string;
};

async function resolveDatasetScope(datasetId: string): Promise<DatasetScope> {
  const dataset = requireDatasetDefinition(datasetId);
  const effectiveDisciplineKey = dataset.disciplineAliases?.[dataset.disciplineKey] ?? dataset.disciplineKey;
  const discipline = await prisma.masterDiscipline.findUnique({ where: { key: effectiveDisciplineKey } });
  if (!discipline) {
    throw new AppError("DISCIPLINE_NOT_FOUND", `Discipline "${effectiveDisciplineKey}" not found for dataset "${datasetId}".`, 409);
  }
  return { dataset, disciplineId: discipline.id };
}

async function getMasterItemsForDataset(dataset: DatasetDefinition, disciplineId: string) {
  return prisma.masterItem.findMany({
    where: {
      disciplineId,
    },
    select: { id: true, itemCode: true, status: true, isPremium: true },
  });
}

export async function publishDatasetValidItems(owner: PlatformActor, datasetId: string) {
  requireOwner(owner);
  const { dataset, disciplineId } = await resolveDatasetScope(datasetId);
  const items = await getMasterItemsForDataset(dataset, disciplineId);
  if (items.length === 0) {
    throw new AppError("NO_IMPORTED_ITEMS", "No imported master items found for this dataset.", 409);
  }

  const itemIds = items.map((item) => item.id);
  const latestVersions = await prisma.masterItemVersion.findMany({
    where: { masterItemId: { in: itemIds } },
    orderBy: [{ masterItemId: "asc" }, { versionNumber: "desc" }],
  });

  const latestByItem = new Map<string, (typeof latestVersions)[number]>();
  for (const version of latestVersions) {
    if (!latestByItem.has(version.masterItemId)) latestByItem.set(version.masterItemId, version);
  }

  let created = 0;
  let published = 0;
  for (const item of items) {
    let version = latestByItem.get(item.id);
    if (!version) {
      version = await prisma.masterItemVersion.create({
        data: {
          masterItemId: item.id,
          versionNumber: 1,
          status: MasterItemVersionStatus.PUBLISHED,
          effectiveDate: new Date(),
          name: item.itemCode,
          shortDescription: "",
          fullDescription: "",
          specificationTemplate: "",
          inclusionTemplate: "",
          exclusionTemplate: "",
          notesTemplate: "",
          primaryUnit: "Each",
          measurementMethod: "",
          quantityBasis: "",
          roundingRule: "",
          changeSummary: "Published via dataset activation",
          approvedByUserId: owner.userId,
        },
      });
      created += 1;
      published += 1;
      continue;
    }

    if (version.status !== MasterItemVersionStatus.PUBLISHED) {
      await prisma.masterItemVersion.update({
        where: { id: version.id },
        data: { status: MasterItemVersionStatus.PUBLISHED, effectiveDate: new Date(), approvedByUserId: owner.userId },
      });
      published += 1;
    }
  }

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "CATALOGUE_DATASET_ITEMS_PUBLISHED",
    targetType: "Dataset",
    targetId: datasetId,
    metadata: { createdVersions: created, publishedVersions: published, totalItems: items.length },
  });

  return { datasetId, totalItems: items.length, createdVersions: created, publishedVersions: published };
}

export async function createOrReuseDatasetPackage(owner: PlatformActor, datasetId: string) {
  requireOwner(owner);
  const { dataset, disciplineId } = await resolveDatasetScope(datasetId);

  const existing = await prisma.industryDataPackage.findUnique({ where: { key: dataset.targetPackageCode } });
  if (existing) {
    return { datasetId, packageId: existing.id, packageKey: existing.key, created: false };
  }

  const created = await prisma.industryDataPackage.create({
    data: {
      key: dataset.targetPackageCode,
      name: dataset.label.replace("Master Catalogue", "Library").trim(),
      description: `Library package for dataset ${dataset.datasetId}`,
      disciplineId,
      packageType: "PROFESSIONAL",
      status: "DRAFT",
      monthlyPrice: 0,
      annualPrice: 0,
      currency: "AED",
      isFeatured: false,
      metadataJson: { datasetId: dataset.datasetId, source: "catalogue-activation" },
    },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "CATALOGUE_PACKAGE_CREATED",
    targetType: "IndustryDataPackage",
    targetId: created.id,
    metadata: { datasetId, packageKey: created.key },
  });

  return { datasetId, packageId: created.id, packageKey: created.key, created: true };
}

export async function assignDatasetItemsToPackage(owner: PlatformActor, datasetId: string) {
  requireOwner(owner);
  const { dataset, disciplineId } = await resolveDatasetScope(datasetId);
  const pkg = await createOrReuseDatasetPackage(owner, datasetId);
  const items = await getMasterItemsForDataset(dataset, disciplineId);
  if (items.length === 0) throw new AppError("NO_IMPORTED_ITEMS", "No imported master items found for this dataset.", 409);

  const existing = await prisma.industryDataPackageItem.findMany({
    where: { packageId: pkg.packageId, masterItemId: { in: items.map((i) => i.id) } },
    select: { masterItemId: true },
  });
  const existingSet = new Set(existing.map((e) => e.masterItemId));
  const toCreate = items.filter((i) => !existingSet.has(i.id));

  if (toCreate.length > 0) {
    await prisma.industryDataPackageItem.createMany({
      data: toCreate.map((i, idx) => ({ packageId: pkg.packageId, masterItemId: i.id, sortOrder: idx })),
      skipDuplicates: true,
    });
  }

  await prisma.industryDataPackage.update({
    where: { id: pkg.packageId },
    data: { itemCount: await prisma.industryDataPackageItem.count({ where: { packageId: pkg.packageId } }) },
  });

  return { datasetId, packageId: pkg.packageId, assignedCount: toCreate.length, totalCandidateItems: items.length };
}

export async function activateDatasetPackage(owner: PlatformActor, datasetId: string) {
  requireOwner(owner);
  const pkg = await createOrReuseDatasetPackage(owner, datasetId);
  const updated = await prisma.industryDataPackage.update({
    where: { id: pkg.packageId },
    data: { status: IndustryPackageStatus.ACTIVE },
  });
  return { datasetId, packageId: updated.id, packageKey: updated.key, status: updated.status };
}

export async function grantPackageAccess(owner: PlatformActor, packageId: string, companyId: string) {
  requireOwner(owner);
  const existing = await prisma.companyPackageSubscription.findFirst({
    where: { companyId, packageId, status: SubscriptionStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { packageId, companyId, subscriptionId: existing.id, status: existing.status, created: false };

  const created = await prisma.companyPackageSubscription.create({
    data: { companyId, packageId, status: SubscriptionStatus.ACTIVE, startsAt: new Date(), source: "platform_owner_activation" },
  });
  return { packageId, companyId, subscriptionId: created.id, status: created.status, created: true };
}

export async function revokePackageAccess(owner: PlatformActor, packageId: string, companyId: string) {
  requireOwner(owner);
  const existing = await prisma.companyPackageSubscription.findFirst({
    where: { companyId, packageId, status: SubscriptionStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) return { packageId, companyId, revoked: false };

  await prisma.companyPackageSubscription.update({
    where: { id: existing.id },
    data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
  });
  return { packageId, companyId, revoked: true };
}
