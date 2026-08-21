-- TEMPLATE-LINK-1: shared DRAFT/REVIEW/APPROVED/PUBLISHED/RETIRED versioning
-- for DocumentTemplate (BOQ), TechnicalReportTemplate, and EmailTemplate.
-- Additive only: no existing table, column, or row is altered or dropped.
-- New FK columns on GeneratedDocument/GeneratedTechnicalReport/EmailDispatch
-- are nullable, backfilled by a separate script after this migration runs.

-- CreateEnum
CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'RETIRED');

-- AlterTable
ALTER TABLE "EmailDispatch" ADD COLUMN "emailTemplateVersionId" UUID;

-- AlterTable
ALTER TABLE "GeneratedDocument" ADD COLUMN "templateVersionId" UUID;

-- AlterTable
ALTER TABLE "GeneratedTechnicalReport" ADD COLUMN "templateVersionId" UUID;

-- CreateTable
CREATE TABLE "DocumentTemplateVersion" (
    "id" UUID NOT NULL,
    "documentTemplateId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "styleConfigJson" JSONB NOT NULL,
    "contentConfigJson" JSONB NOT NULL,
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "effectiveDate" TIMESTAMP(3),
    "retiredDate" TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalReportTemplateVersion" (
    "id" UUID NOT NULL,
    "technicalReportTemplateId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "sectionsJson" JSONB NOT NULL,
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "effectiveDate" TIMESTAMP(3),
    "retiredDate" TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalReportTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplateVersion" (
    "id" UUID NOT NULL,
    "emailTemplateId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "effectiveDate" TIMESTAMP(3),
    "retiredDate" TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentTemplateVersion_documentTemplateId_idx" ON "DocumentTemplateVersion"("documentTemplateId");

-- CreateIndex
CREATE INDEX "DocumentTemplateVersion_status_idx" ON "DocumentTemplateVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateVersion_documentTemplateId_versionNumber_key" ON "DocumentTemplateVersion"("documentTemplateId", "versionNumber");

-- CreateIndex
CREATE INDEX "TechnicalReportTemplateVersion_technicalReportTemplateId_idx" ON "TechnicalReportTemplateVersion"("technicalReportTemplateId");

-- CreateIndex
CREATE INDEX "TechnicalReportTemplateVersion_status_idx" ON "TechnicalReportTemplateVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalReportTemplateVersion_technicalReportTemplateId_ve_key" ON "TechnicalReportTemplateVersion"("technicalReportTemplateId", "versionNumber");

-- CreateIndex
CREATE INDEX "EmailTemplateVersion_emailTemplateId_idx" ON "EmailTemplateVersion"("emailTemplateId");

-- CreateIndex
CREATE INDEX "EmailTemplateVersion_status_idx" ON "EmailTemplateVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplateVersion_emailTemplateId_versionNumber_key" ON "EmailTemplateVersion"("emailTemplateId", "versionNumber");

-- CreateIndex
CREATE INDEX "EmailDispatch_emailTemplateVersionId_idx" ON "EmailDispatch"("emailTemplateVersionId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_templateVersionId_idx" ON "GeneratedDocument"("templateVersionId");

-- CreateIndex
CREATE INDEX "GeneratedTechnicalReport_templateVersionId_idx" ON "GeneratedTechnicalReport"("templateVersionId");

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalReportTemplateVersion" ADD CONSTRAINT "TechnicalReportTemplateVersion_technicalReportTemplateId_fkey" FOREIGN KEY ("technicalReportTemplateId") REFERENCES "TechnicalReportTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalReportTemplateVersion" ADD CONSTRAINT "TechnicalReportTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTechnicalReport" ADD CONSTRAINT "GeneratedTechnicalReport_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TechnicalReportTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplateVersion" ADD CONSTRAINT "EmailTemplateVersion_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplateVersion" ADD CONSTRAINT "EmailTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDispatch" ADD CONSTRAINT "EmailDispatch_emailTemplateVersionId_fkey" FOREIGN KEY ("emailTemplateVersionId") REFERENCES "EmailTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
