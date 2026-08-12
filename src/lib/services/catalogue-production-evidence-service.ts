import { MasterCatalogueImportJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { PermissionDeniedError } from "@/lib/errors/app-error";
import { listDatasetDefinitions } from "@/lib/services/catalogue-dataset-registry";
import { getDatasetBatchIds } from "@/lib/services/industry-package-activation-service";

/**
 * CATALOGUE-100-VERIFY — single read-only pass computing the entire
 * production evidence table the verification order asks for, per dataset:
 * file manifest, latest job, real item/version/hierarchy/classification
 * counts SCOPED TO THAT JOB'S OWN BATCH (not discipline-wide — several
 * datasets share a disciplineKey, e.g. most of the construction datasets,
 * so a discipline-wide count would double-count across datasets), package
 * state, and a single-word pipeline-stage classification. Never mutates
 * anything. Only the platform owner may call this (production DB access
 * requires a real session — no service-token path exists, by design).
 */
function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Production catalogue evidence is restricted to the platform owner.");
  }
}

type PipelineStage =
  | "SOURCE_ONLY"
  | "DRY_RUN_ONLY"
  | "IMPORTING"
  | "IMPORTED"
  | "PACKAGED"
  | "CUSTOMER_ACTIVE"
  | "FAILED";

function classifyStage(input: {
  hasJob: boolean;
  jobStatus: MasterCatalogueImportJobStatus | null;
  itemCount: number;
  packageActive: boolean;
  packageItemCount: number;
}): PipelineStage {
  if (!input.hasJob) return "SOURCE_ONLY";
  if (input.jobStatus === "FAILED") return "FAILED";
  if (input.jobStatus === "DRY_RUN_COMPLETE" || input.jobStatus === "REGISTERED" || input.jobStatus === "VALIDATING" || input.jobStatus === "DRY_RUN_RUNNING") return "DRY_RUN_ONLY";
  if (input.jobStatus === "PAUSED" || input.jobStatus === "IMPORT_RUNNING" || input.jobStatus === "AWAITING_CONFIRMATION") return "IMPORTING";
  // COMPLETED / COMPLETED_WITH_WARNINGS / CANCELLED / ROLLED_BACK from here
  if (input.packageActive && input.packageItemCount > 0) return "CUSTOMER_ACTIVE";
  if (input.packageItemCount > 0) return "PACKAGED";
  return "IMPORTED";
}

export async function getProductionCatalogueEvidence(owner: PlatformActor) {
  requireOwner(owner);
  const datasets = listDatasetDefinitions();

  const rows = await Promise.all(
    datasets.map(async (dataset) => {
      const discipline = await prisma.masterDiscipline.findUnique({ where: { key: dataset.disciplineKey } });
      const job = await prisma.masterCatalogueImportJob.findFirst({ where: { datasetId: dataset.datasetId }, orderBy: { createdAt: "desc" } });

      // Scoped through the batch relation rather than a `masterItemId: { in: itemIds } }`
      // list — for a large dataset (e.g. 80k+ rows) that list would exceed
      // Postgres' 65,535 bind-parameter limit and 500 the whole route.
      const batchIds = job ? await getDatasetBatchIds(dataset.datasetId) : [];
      const itemCount = batchIds.length > 0 ? await prisma.masterItem.count({ where: { sourceBatchId: { in: batchIds } } }) : 0;
      const publishedVersionCount = batchIds.length > 0
        ? await prisma.masterItemVersion.count({ where: { status: "PUBLISHED", masterItem: { sourceBatchId: { in: batchIds } } } })
        : 0;

      const pkg = await prisma.industryDataPackage.findUnique({ where: { key: dataset.targetPackageCode } });
      const packageActive = pkg?.status === "ACTIVE";
      const packageItemCount = pkg?.itemCount ?? 0;

      const stage = classifyStage({
        hasJob: Boolean(job),
        jobStatus: job?.status ?? null,
        itemCount,
        packageActive,
        packageItemCount,
      });

      return {
        datasetId: dataset.datasetId,
        label: dataset.label,
        industryCode: dataset.industryCode,
        disciplineKey: dataset.disciplineKey,
        disciplineExists: Boolean(discipline),
        targetPackageCode: dataset.targetPackageCode,
        files: dataset.files.map((f) => ({ fileName: f.fileName, approvedChecksum: f.approvedChecksum, expectedRowCount: f.expectedRowCount })),
        fileCount: dataset.files.length,
        expectedRowCount: dataset.files.reduce((sum, f) => sum + f.expectedRowCount, 0),
        job: job
          ? {
              id: job.id,
              status: job.status,
              totalRows: job.totalRows,
              processedRows: job.processedRows,
              insertedCount: job.insertedCount,
              updatedCount: job.updatedCount,
              unchangedCount: job.unchangedCount,
              rejectedCount: job.rejectedCount,
              warningCount: job.warningCount,
              itemsCreated: job.itemsCreated,
              versionsCreated: job.versionsCreated,
              classificationsCreated: job.classificationsCreated,
              hierarchyNodesCreated: job.hierarchyNodesCreated,
              lastErrorMessage: job.lastErrorMessage,
              completedAt: job.completedAt?.toISOString() ?? null,
            }
          : null,
        itemCount,
        publishedVersionCount,
        package: pkg
          ? { id: pkg.id, key: pkg.key, name: pkg.name, status: pkg.status, itemCount: pkg.itemCount, isFeatured: pkg.isFeatured }
          : null,
        marketplaceVisible: packageActive && packageItemCount > 0,
        stage,
      };
    }),
  );

  const summary = {
    totalDatasets: rows.length,
    totalFiles: rows.reduce((sum, r) => sum + r.fileCount, 0),
    totalExpectedRows: rows.reduce((sum, r) => sum + r.expectedRowCount, 0),
    datasetsWithAnyJob: rows.filter((r) => r.job !== null).length,
    datasetsCompleted: rows.filter((r) => r.job?.status === "COMPLETED" || r.job?.status === "COMPLETED_WITH_WARNINGS").length,
    datasetsFailed: rows.filter((r) => r.job?.status === "FAILED").length,
    totalItemsCreated: rows.reduce((sum, r) => sum + r.itemCount, 0),
    totalPublishedVersions: rows.reduce((sum, r) => sum + r.publishedVersionCount, 0),
    totalPackagesActive: rows.filter((r) => r.package?.status === "ACTIVE").length,
    totalPackagesMarketplaceVisible: rows.filter((r) => r.marketplaceVisible).length,
  };

  return { generatedAt: new Date().toISOString(), summary, datasets: rows };
}
