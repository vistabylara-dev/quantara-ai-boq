-- CreateEnum
CREATE TYPE "ProjectFileClassification" AS ENUM ('ARCHITECTURAL_PLAN', 'STRUCTURAL_PLAN', 'FURNITURE_LAYOUT', 'INTERIOR_LAYOUT', 'REFLECTED_CEILING_PLAN', 'FLOORING_PLAN', 'LIGHTING_PLAN', 'ELECTRICAL_PLAN', 'HVAC_PLAN', 'PLUMBING_PLAN', 'DRAINAGE_PLAN', 'FIRE_FIGHTING_PLAN', 'FIRE_ALARM_PLAN', 'ELV_PLAN', 'JOINERY_DRAWING', 'LANDSCAPE_PLAN', 'ELEVATION', 'SECTION', 'DETAIL_DRAWING', 'MATERIAL_SCHEDULE', 'FURNITURE_SCHEDULE', 'EQUIPMENT_SCHEDULE', 'DOOR_SCHEDULE', 'WINDOW_SCHEDULE', 'FINISH_SCHEDULE', 'SUPPLIER_PRICE_LIST', 'EXISTING_BOQ', 'PRODUCT_CATALOGUE', 'SITE_INSPECTION_PHOTO', 'TEST_REPORT', 'METHOD_STATEMENT', 'TECHNICAL_REPORT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProjectFileStatus" AS ENUM ('UPLOADED', 'CLASSIFYING', 'CLASSIFIED', 'PREPROCESSING', 'READY_FOR_PROCESSING', 'PROCESSING', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "safeFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "classification" "ProjectFileClassification" NOT NULL DEFAULT 'UNKNOWN',
    "classificationConfidence" DECIMAL(5,2),
    "classificationConfirmedByUserId" UUID,
    "classificationConfirmedAt" TIMESTAMP(3),
    "status" "ProjectFileStatus" NOT NULL DEFAULT 'UPLOADED',
    "language" TEXT,
    "pageCount" INTEGER,
    "sheetCount" INTEGER,
    "drawingNumber" TEXT,
    "drawingTitle" TEXT,
    "revisionNumber" TEXT,
    "scaleText" TEXT,
    "detectedScale" TEXT,
    "measurementUnit" TEXT,
    "metadataJson" JSONB,
    "processingErrorCode" TEXT,
    "processingErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectFile_companyId_idx" ON "ProjectFile"("companyId");

-- CreateIndex
CREATE INDEX "ProjectFile_projectId_idx" ON "ProjectFile"("projectId");

-- CreateIndex
CREATE INDEX "ProjectFile_status_idx" ON "ProjectFile"("status");

-- CreateIndex
CREATE INDEX "ProjectFile_classification_idx" ON "ProjectFile"("classification");

-- CreateIndex
CREATE INDEX "ProjectFile_companyId_checksum_idx" ON "ProjectFile"("companyId", "checksum");

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_classificationConfirmedByUserId_fkey" FOREIGN KEY ("classificationConfirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

