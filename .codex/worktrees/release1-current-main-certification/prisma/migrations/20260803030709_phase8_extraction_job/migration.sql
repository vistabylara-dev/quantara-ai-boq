-- CreateEnum
CREATE TYPE "ExtractionEngineType" AS ENUM ('DOCUMENT_CLASSIFICATION', 'FILE_PREPROCESSING', 'PDF_TEXT_EXTRACTION', 'OCR_TEXT_EXTRACTION', 'TABLE_EXTRACTION', 'TITLE_BLOCK_EXTRACTION', 'SCALE_DETECTION', 'VECTOR_EXTRACTION', 'ROOM_BOUNDARY_DETECTION', 'OBJECT_DETECTION', 'SYMBOL_DETECTION', 'QUANTITY_CALCULATION', 'PRODUCT_MATCHING', 'PHOTO_ANALYSIS', 'FINDINGS_DRAFTING', 'REPORT_DRAFTING', 'VERIFICATION_GENERATION');

-- CreateEnum
CREATE TYPE "ExtractionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'NEEDS_INPUT', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ExtractionJob" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "projectFileId" UUID NOT NULL,
    "engineType" "ExtractionEngineType" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "status" "ExtractionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maximumAttempts" INTEGER NOT NULL DEFAULT 3,
    "configurationJson" JSONB,
    "resultSummaryJson" JSONB,
    "usageMetadataJson" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractionJob_companyId_idx" ON "ExtractionJob"("companyId");

-- CreateIndex
CREATE INDEX "ExtractionJob_projectId_idx" ON "ExtractionJob"("projectId");

-- CreateIndex
CREATE INDEX "ExtractionJob_projectFileId_idx" ON "ExtractionJob"("projectFileId");

-- CreateIndex
CREATE INDEX "ExtractionJob_status_idx" ON "ExtractionJob"("status");

-- CreateIndex
CREATE INDEX "ExtractionJob_engineType_idx" ON "ExtractionJob"("engineType");

-- AddForeignKey
ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_projectFileId_fkey" FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

