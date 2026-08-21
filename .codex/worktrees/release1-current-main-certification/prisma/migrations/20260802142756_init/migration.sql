-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'NEEDS_REVIEW', 'INTERNALLY_APPROVED', 'SENT', 'CLIENT_APPROVED', 'REVISION_REQUESTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BOQStatus" AS ENUM ('DRAFT', 'CALCULATED', 'NEEDS_VERIFICATION', 'LOCKED', 'ISSUED', 'APPROVED');

-- CreateEnum
CREATE TYPE "BOQItemStatus" AS ENUM ('DRAFT', 'EXTRACTED', 'NEEDS_REVIEW', 'CONFIRMED', 'CORRECTED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "MarginMode" AS ENUM ('MARKUP', 'GROSS_MARGIN');

-- CreateEnum
CREATE TYPE "VerificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RateStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'INACTIVE');

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "taxRegistrationNumber" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'AED',
    "vatRate" DECIMAL(7,4) NOT NULL DEFAULT 5,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'English',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryEngine" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryEngine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyIndustryEngine" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "industryEngineId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyIndustryEngine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "industryEngineId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 5,
    "language" TEXT NOT NULL DEFAULT 'English',
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQ" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "BOQStatus" NOT NULL DEFAULT 'DRAFT',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "approvedByName" TEXT,
    "discountPercentage" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQSection" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOQSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQItem" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "itemCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "specification" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "freightCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "installationCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "additionalCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "landedCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "marginMode" "MarginMode" NOT NULL DEFAULT 'MARKUP',
    "marginPercentage" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "sellingRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "wastagePercentage" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "taxApplicable" BOOLEAN NOT NULL DEFAULT true,
    "sourceReference" TEXT NOT NULL DEFAULT '',
    "roomOrZone" TEXT NOT NULL DEFAULT '',
    "drawingReference" TEXT NOT NULL DEFAULT '',
    "confidenceScore" DECIMAL(7,4) NOT NULL DEFAULT 100,
    "status" "BOQItemStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOQItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQItemOption" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "boqItemId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "specification" TEXT NOT NULL DEFAULT '',
    "rate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOQItemOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationException" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "boqItemId" UUID,
    "type" TEXT NOT NULL,
    "severity" "VerificationSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "currentValue" TEXT,
    "suggestedValue" TEXT,
    "resolutionNote" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQRevisionSnapshot" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BOQRevisionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCatalogueItem" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "industryEngineId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "cost" DECIMAL(18,4) NOT NULL,
    "defaultMargin" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "sellingRate" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "RateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateCatalogueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IndustryEngine_key_key" ON "IndustryEngine"("key");

-- CreateIndex
CREATE INDEX "CompanyIndustryEngine_companyId_idx" ON "CompanyIndustryEngine"("companyId");

-- CreateIndex
CREATE INDEX "CompanyIndustryEngine_industryEngineId_idx" ON "CompanyIndustryEngine"("industryEngineId");

-- CreateIndex
CREATE INDEX "CompanyIndustryEngine_enabled_idx" ON "CompanyIndustryEngine"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyIndustryEngine_companyId_industryEngineId_key" ON "CompanyIndustryEngine"("companyId", "industryEngineId");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_industryEngineId_idx" ON "Project"("industryEngineId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_companyId_reference_key" ON "Project"("companyId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Project_companyId_slug_key" ON "Project"("companyId", "slug");

-- CreateIndex
CREATE INDEX "BOQ_companyId_idx" ON "BOQ"("companyId");

-- CreateIndex
CREATE INDEX "BOQ_projectId_idx" ON "BOQ"("projectId");

-- CreateIndex
CREATE INDEX "BOQ_status_idx" ON "BOQ"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BOQ_projectId_revisionNumber_key" ON "BOQ"("projectId", "revisionNumber");

-- CreateIndex
CREATE INDEX "BOQSection_companyId_idx" ON "BOQSection"("companyId");

-- CreateIndex
CREATE INDEX "BOQSection_boqId_idx" ON "BOQSection"("boqId");

-- CreateIndex
CREATE INDEX "BOQSection_sortOrder_idx" ON "BOQSection"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BOQSection_boqId_code_key" ON "BOQSection"("boqId", "code");

-- CreateIndex
CREATE INDEX "BOQItem_companyId_idx" ON "BOQItem"("companyId");

-- CreateIndex
CREATE INDEX "BOQItem_sectionId_idx" ON "BOQItem"("sectionId");

-- CreateIndex
CREATE INDEX "BOQItem_itemCode_idx" ON "BOQItem"("itemCode");

-- CreateIndex
CREATE INDEX "BOQItem_status_idx" ON "BOQItem"("status");

-- CreateIndex
CREATE INDEX "BOQItem_sortOrder_idx" ON "BOQItem"("sortOrder");

-- CreateIndex
CREATE INDEX "BOQItemOption_companyId_idx" ON "BOQItemOption"("companyId");

-- CreateIndex
CREATE INDEX "BOQItemOption_boqItemId_idx" ON "BOQItemOption"("boqItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BOQItemOption_boqItemId_label_key" ON "BOQItemOption"("boqItemId", "label");

-- CreateIndex
CREATE INDEX "VerificationException_companyId_idx" ON "VerificationException"("companyId");

-- CreateIndex
CREATE INDEX "VerificationException_boqId_idx" ON "VerificationException"("boqId");

-- CreateIndex
CREATE INDEX "VerificationException_boqItemId_idx" ON "VerificationException"("boqItemId");

-- CreateIndex
CREATE INDEX "VerificationException_severity_idx" ON "VerificationException"("severity");

-- CreateIndex
CREATE INDEX "VerificationException_resolved_idx" ON "VerificationException"("resolved");

-- CreateIndex
CREATE INDEX "BOQRevisionSnapshot_companyId_idx" ON "BOQRevisionSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "BOQRevisionSnapshot_projectId_idx" ON "BOQRevisionSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "BOQRevisionSnapshot_boqId_idx" ON "BOQRevisionSnapshot"("boqId");

-- CreateIndex
CREATE UNIQUE INDEX "BOQRevisionSnapshot_boqId_revisionNumber_key" ON "BOQRevisionSnapshot"("boqId", "revisionNumber");

-- CreateIndex
CREATE INDEX "RateCatalogueItem_companyId_idx" ON "RateCatalogueItem"("companyId");

-- CreateIndex
CREATE INDEX "RateCatalogueItem_industryEngineId_idx" ON "RateCatalogueItem"("industryEngineId");

-- CreateIndex
CREATE INDEX "RateCatalogueItem_itemCode_idx" ON "RateCatalogueItem"("itemCode");

-- CreateIndex
CREATE INDEX "RateCatalogueItem_status_idx" ON "RateCatalogueItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RateCatalogueItem_companyId_industryEngineId_itemCode_effec_key" ON "RateCatalogueItem"("companyId", "industryEngineId", "itemCode", "effectiveDate");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "CompanyIndustryEngine" ADD CONSTRAINT "CompanyIndustryEngine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyIndustryEngine" ADD CONSTRAINT "CompanyIndustryEngine_industryEngineId_fkey" FOREIGN KEY ("industryEngineId") REFERENCES "IndustryEngine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_industryEngineId_fkey" FOREIGN KEY ("industryEngineId") REFERENCES "IndustryEngine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQ" ADD CONSTRAINT "BOQ_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQ" ADD CONSTRAINT "BOQ_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQSection" ADD CONSTRAINT "BOQSection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQSection" ADD CONSTRAINT "BOQSection_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BOQSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItemOption" ADD CONSTRAINT "BOQItemOption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItemOption" ADD CONSTRAINT "BOQItemOption_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationException" ADD CONSTRAINT "VerificationException_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationException" ADD CONSTRAINT "VerificationException_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationException" ADD CONSTRAINT "VerificationException_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQRevisionSnapshot" ADD CONSTRAINT "BOQRevisionSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQRevisionSnapshot" ADD CONSTRAINT "BOQRevisionSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQRevisionSnapshot" ADD CONSTRAINT "BOQRevisionSnapshot_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCatalogueItem" ADD CONSTRAINT "RateCatalogueItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCatalogueItem" ADD CONSTRAINT "RateCatalogueItem_industryEngineId_fkey" FOREIGN KEY ("industryEngineId") REFERENCES "IndustryEngine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
