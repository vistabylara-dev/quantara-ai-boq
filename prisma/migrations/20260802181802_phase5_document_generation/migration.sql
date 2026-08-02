-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('CORPORATE_TECHNICAL', 'EXECUTIVE_PREMIUM', 'FURNITURE_CATALOGUE', 'MEP_TENDER', 'ARABIC_FORMAL');

-- CreateEnum
CREATE TYPE "GeneratedDocumentType" AS ENUM ('CSV', 'XLSX', 'PDF', 'DOCX', 'HTML');

-- CreateEnum
CREATE TYPE "GeneratedDocumentStatus" AS ENUM ('QUEUED', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentAudience" AS ENUM ('INTERNAL', 'CLIENT');

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "industryEngineId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "styleConfigJson" JSONB NOT NULL,
    "contentConfigJson" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "type" "GeneratedDocumentType" NOT NULL,
    "audience" "DocumentAudience" NOT NULL,
    "status" "GeneratedDocumentStatus" NOT NULL DEFAULT 'QUEUED',
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "generatedByUserId" UUID,
    "generatedByName" TEXT NOT NULL,
    "generationMetadataJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentTemplate_companyId_idx" ON "DocumentTemplate"("companyId");

-- CreateIndex
CREATE INDEX "DocumentTemplate_industryEngineId_idx" ON "DocumentTemplate"("industryEngineId");

-- CreateIndex
CREATE INDEX "DocumentTemplate_type_idx" ON "DocumentTemplate"("type");

-- CreateIndex
CREATE INDEX "DocumentTemplate_isActive_idx" ON "DocumentTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_companyId_code_key" ON "DocumentTemplate"("companyId", "code");

-- CreateIndex
CREATE INDEX "GeneratedDocument_companyId_idx" ON "GeneratedDocument"("companyId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_projectId_idx" ON "GeneratedDocument"("projectId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_boqId_idx" ON "GeneratedDocument"("boqId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_templateId_idx" ON "GeneratedDocument"("templateId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_type_idx" ON "GeneratedDocument"("type");

-- CreateIndex
CREATE INDEX "GeneratedDocument_status_idx" ON "GeneratedDocument"("status");

-- CreateIndex
CREATE INDEX "GeneratedDocument_createdAt_idx" ON "GeneratedDocument"("createdAt");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_industryEngineId_fkey" FOREIGN KEY ("industryEngineId") REFERENCES "IndustryEngine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

