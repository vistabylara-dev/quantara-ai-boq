-- CreateEnum
CREATE TYPE "SimulationMode" AS ENUM ('TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'FREE', 'PRO', 'SINGLE_BOQ_UNLOCKED');

-- CreateEnum
CREATE TYPE "MasterCatalogueImportStatus" AS ENUM ('DRY_RUN', 'EXECUTED', 'ROLLED_BACK');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "isTestCompany" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MasterItem" ADD COLUMN     "sourceBatchId" UUID;

-- CreateTable
CREATE TABLE "PlatformSimulationSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mode" "SimulationMode" NOT NULL,
    "targetBoqId" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSimulationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterCatalogueImportBatch" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "disciplineId" UUID NOT NULL,
    "uploadedFileName" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "MasterCatalogueImportStatus" NOT NULL DEFAULT 'DRY_RUN',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "validationReportJson" JSONB,
    "executedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCatalogueImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSimulationSession_userId_key" ON "PlatformSimulationSession"("userId");

-- CreateIndex
CREATE INDEX "PlatformSimulationSession_userId_idx" ON "PlatformSimulationSession"("userId");

-- CreateIndex
CREATE INDEX "MasterCatalogueImportBatch_actorUserId_idx" ON "MasterCatalogueImportBatch"("actorUserId");

-- CreateIndex
CREATE INDEX "MasterCatalogueImportBatch_disciplineId_idx" ON "MasterCatalogueImportBatch"("disciplineId");

-- CreateIndex
CREATE INDEX "MasterCatalogueImportBatch_status_idx" ON "MasterCatalogueImportBatch"("status");

-- CreateIndex
CREATE INDEX "MasterCatalogueImportBatch_checksum_idx" ON "MasterCatalogueImportBatch"("checksum");

-- CreateIndex
CREATE INDEX "MasterItem_sourceBatchId_idx" ON "MasterItem"("sourceBatchId");

-- AddForeignKey
ALTER TABLE "PlatformSimulationSession" ADD CONSTRAINT "PlatformSimulationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCatalogueImportBatch" ADD CONSTRAINT "MasterCatalogueImportBatch_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCatalogueImportBatch" ADD CONSTRAINT "MasterCatalogueImportBatch_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "MasterDiscipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItem" ADD CONSTRAINT "MasterItem_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "MasterCatalogueImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
