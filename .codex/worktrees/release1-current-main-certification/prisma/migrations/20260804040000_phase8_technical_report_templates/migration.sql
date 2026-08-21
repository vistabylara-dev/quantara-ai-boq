-- CreateEnum
CREATE TYPE "TechnicalReportStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateTable
CREATE TABLE "TechnicalReportTemplate" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "disciplineTag" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "sectionsJson" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedTechnicalReport" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TechnicalReportStatus" NOT NULL DEFAULT 'DRAFT',
    "sectionsSnapshotJson" JSONB NOT NULL,
    "placeholdersJson" JSONB NOT NULL,
    "fieldValuesJson" JSONB NOT NULL,
    "documentType" "GeneratedDocumentType",
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "generatedByUserId" UUID,
    "generatedByName" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GeneratedTechnicalReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnicalReportTemplate_companyId_idx" ON "TechnicalReportTemplate"("companyId");

-- CreateIndex
CREATE INDEX "TechnicalReportTemplate_isActive_idx" ON "TechnicalReportTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalReportTemplate_companyId_code_key" ON "TechnicalReportTemplate"("companyId", "code");

-- CreateIndex
CREATE INDEX "GeneratedTechnicalReport_companyId_idx" ON "GeneratedTechnicalReport"("companyId");

-- CreateIndex
CREATE INDEX "GeneratedTechnicalReport_projectId_idx" ON "GeneratedTechnicalReport"("projectId");

-- CreateIndex
CREATE INDEX "GeneratedTechnicalReport_templateId_idx" ON "GeneratedTechnicalReport"("templateId");

-- CreateIndex
CREATE INDEX "GeneratedTechnicalReport_status_idx" ON "GeneratedTechnicalReport"("status");

-- CreateIndex
CREATE INDEX "GeneratedTechnicalReport_createdAt_idx" ON "GeneratedTechnicalReport"("createdAt");

-- AddForeignKey
ALTER TABLE "TechnicalReportTemplate" ADD CONSTRAINT "TechnicalReportTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTechnicalReport" ADD CONSTRAINT "GeneratedTechnicalReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTechnicalReport" ADD CONSTRAINT "GeneratedTechnicalReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTechnicalReport" ADD CONSTRAINT "GeneratedTechnicalReport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TechnicalReportTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTechnicalReport" ADD CONSTRAINT "GeneratedTechnicalReport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
