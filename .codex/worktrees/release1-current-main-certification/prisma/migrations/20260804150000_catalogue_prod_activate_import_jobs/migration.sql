-- CATALOGUE-PROD-ACTIVATE: resumable, checkpointed production dataset activation jobs.
-- Additive only. No existing table, column, or row is altered or dropped.

-- CreateEnum
CREATE TYPE "MasterCatalogueImportJobStatus" AS ENUM ('REGISTERED', 'VALIDATING', 'DRY_RUN_RUNNING', 'DRY_RUN_COMPLETE', 'AWAITING_CONFIRMATION', 'IMPORT_RUNNING', 'PAUSED', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "MasterCatalogueImportJob" (
    "id" UUID NOT NULL,
    "datasetId" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "actorUserId" UUID NOT NULL,
    "disciplineId" UUID NOT NULL,
    "legacyBatchId" UUID,
    "status" "MasterCatalogueImportJobStatus" NOT NULL DEFAULT 'REGISTERED',
    "sourceChecksum" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "dryRunReportJson" JSONB,
    "batchSize" INTEGER NOT NULL DEFAULT 200,
    "currentRowCursor" INTEGER NOT NULL DEFAULT 0,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "versionsCreated" INTEGER NOT NULL DEFAULT 0,
    "classificationsCreated" INTEGER NOT NULL DEFAULT 0,
    "hierarchyNodesCreated" INTEGER NOT NULL DEFAULT 0,
    "categoriesCreated" INTEGER NOT NULL DEFAULT 0,
    "currentFileName" TEXT,
    "lastErrorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCatalogueImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterCatalogueImportJob_datasetId_idx" ON "MasterCatalogueImportJob"("datasetId");

-- CreateIndex
CREATE INDEX "MasterCatalogueImportJob_status_idx" ON "MasterCatalogueImportJob"("status");

-- CreateIndex
CREATE INDEX "MasterCatalogueImportJob_actorUserId_idx" ON "MasterCatalogueImportJob"("actorUserId");

-- CreateIndex
CREATE INDEX "MasterCatalogueImportJob_datasetId_status_idx" ON "MasterCatalogueImportJob"("datasetId", "status");

-- AddForeignKey
ALTER TABLE "MasterCatalogueImportJob" ADD CONSTRAINT "MasterCatalogueImportJob_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCatalogueImportJob" ADD CONSTRAINT "MasterCatalogueImportJob_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "MasterDiscipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCatalogueImportJob" ADD CONSTRAINT "MasterCatalogueImportJob_legacyBatchId_fkey" FOREIGN KEY ("legacyBatchId") REFERENCES "MasterCatalogueImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
