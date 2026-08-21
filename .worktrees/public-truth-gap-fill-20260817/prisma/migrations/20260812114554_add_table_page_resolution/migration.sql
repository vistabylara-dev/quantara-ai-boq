-- CreateEnum
CREATE TYPE "TablePageResolutionDecision" AS ENUM ('UNRESOLVED', 'MANUAL_DATA_ADDED', 'NO_BOQ_DATA_CONFIRMED', 'STRUCTURED_REPLACEMENT_PROVIDED');

-- Note: `prisma migrate dev` also generated three unrelated `DROP INDEX`
-- statements for MasterItem_*_trgm_idx here, from a pre-existing drift
-- between schema.prisma and migration history that predates this branch and
-- has nothing to do with TablePageResolution. Removed so this migration
-- stays purely additive — see CLAUDE.md / owner incident-response guidance:
-- do not fold unrelated schema changes into an unrelated feature migration.

-- CreateTable
CREATE TABLE "TablePageResolution" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "projectFileId" UUID NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "extractionJobId" UUID,
    "decision" "TablePageResolutionDecision" NOT NULL DEFAULT 'UNRESOLVED',
    "decidedByUserId" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TablePageResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TablePageResolution_companyId_idx" ON "TablePageResolution"("companyId");

-- CreateIndex
CREATE INDEX "TablePageResolution_projectId_idx" ON "TablePageResolution"("projectId");

-- CreateIndex
CREATE INDEX "TablePageResolution_extractionJobId_idx" ON "TablePageResolution"("extractionJobId");

-- CreateIndex
CREATE UNIQUE INDEX "TablePageResolution_projectFileId_pageNumber_key" ON "TablePageResolution"("projectFileId", "pageNumber");

-- AddForeignKey
ALTER TABLE "TablePageResolution" ADD CONSTRAINT "TablePageResolution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TablePageResolution" ADD CONSTRAINT "TablePageResolution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TablePageResolution" ADD CONSTRAINT "TablePageResolution_projectFileId_fkey" FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TablePageResolution" ADD CONSTRAINT "TablePageResolution_extractionJobId_fkey" FOREIGN KEY ("extractionJobId") REFERENCES "ExtractionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TablePageResolution" ADD CONSTRAINT "TablePageResolution_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
