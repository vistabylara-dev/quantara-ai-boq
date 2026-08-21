-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'TRIAL', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TechnicalFieldType" AS ENUM ('TEXT', 'NUMBER', 'DECIMAL', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'DATE', 'DIMENSION', 'RANGE', 'JSON');

-- CreateEnum
CREATE TYPE "MasterItemStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IndustryPackageType" AS ENUM ('CORE', 'PROFESSIONAL', 'SPECIALIST', 'ENTERPRISE', 'REGIONAL');

-- CreateEnum
CREATE TYPE "IndustryPackageStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CompanyLibrarySourceType" AS ENUM ('MASTER_PACKAGE', 'MANUAL', 'IMPORTED', 'PREVIOUS_PROJECT', 'SUPPLIER_CATALOGUE');

-- CreateEnum
CREATE TYPE "BoqItemSourceType" AS ENUM ('MANUAL', 'MASTER_ITEM', 'COMPANY_LIBRARY', 'RATE_CATALOGUE', 'PREVIOUS_BOQ', 'IMPORT');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "ImportDestinationType" AS ENUM ('COMPANY_LIBRARY', 'RATE_CATALOGUE', 'DRAFT_BOQ', 'STAGING_REVIEW');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'WARNING', 'ERROR', 'APPROVED', 'IMPORTED', 'REJECTED');

-- AlterTable
ALTER TABLE "BOQItem" ADD COLUMN     "copiedAt" TIMESTAMP(3),
ADD COLUMN     "copiedByUserId" UUID,
ADD COLUMN     "sourceCatalogueItemId" UUID,
ADD COLUMN     "sourceCompanyLibraryItemId" UUID,
ADD COLUMN     "sourceMasterItemId" UUID,
ADD COLUMN     "sourcePreviousBoqItemId" UUID,
ADD COLUMN     "sourceType" "BoqItemSourceType" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "authorizedSignatoryName" TEXT,
ADD COLUMN     "authorizedSignatoryTitle" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "defaultExclusions" TEXT,
ADD COLUMN     "defaultTerms" TEXT,
ADD COLUMN     "defaultValidityDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "signatureUrl" TEXT,
ADD COLUMN     "stampUrl" TEXT;

-- CreateTable
CREATE TABLE "SoftwarePlan" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "planType" "PlanType" NOT NULL,
    "monthlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "annualPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "maxUsers" INTEGER,
    "maxProjects" INTEGER,
    "maxActiveBoqs" INTEGER,
    "maxDocumentsPerMonth" INTEGER,
    "maxStorageBytes" BIGINT,
    "featuresJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySoftwareSubscription" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "softwarePlanId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "trialStartedAt" TIMESTAMP(3),
    "trialExpiresAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "externalSubscriptionId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'development',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySoftwareSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyTrialUsage" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "projectsCreated" INTEGER NOT NULL DEFAULT 0,
    "boqsCompleted" INTEGER NOT NULL DEFAULT 0,
    "documentsGenerated" INTEGER NOT NULL DEFAULT 0,
    "proposalsCreated" INTEGER NOT NULL DEFAULT 0,
    "uniquePremiumItemsUnlocked" INTEGER NOT NULL DEFAULT 0,
    "firstUsedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyTrialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialPremiumItemUnlock" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "masterItemId" UUID NOT NULL,
    "firstUnlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialPremiumItemUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBranding" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0F172A',
    "secondaryColor" TEXT NOT NULL DEFAULT '#1E293B',
    "accentColor" TEXT NOT NULL DEFAULT '#2563EB',
    "documentHeaderColor" TEXT NOT NULL DEFAULT '#0F172A',
    "tableHeaderColor" TEXT NOT NULL DEFAULT '#1E293B',
    "coverStyle" TEXT NOT NULL DEFAULT 'light',
    "logoPosition" TEXT NOT NULL DEFAULT 'top-left',
    "preferredTemplateId" UUID,
    "emailSignatureHtml" TEXT NOT NULL DEFAULT '',
    "footerText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterDiscipline" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterDiscipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterCategory" (
    "id" UUID NOT NULL,
    "disciplineId" UUID NOT NULL,
    "parentCategoryId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItem" (
    "id" UUID NOT NULL,
    "disciplineId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "fullDescription" TEXT NOT NULL DEFAULT '',
    "defaultUnit" TEXT NOT NULL,
    "defaultSpecificationJson" JSONB,
    "technicalFieldsJson" JSONB,
    "defaultTagsJson" JSONB,
    "searchKeywordsJson" JSONB,
    "synonymsJson" JSONB,
    "defaultManufacturerType" TEXT,
    "defaultInstallationMethod" TEXT,
    "defaultTestingRequirement" TEXT,
    "defaultWarrantyRequirement" TEXT,
    "defaultDocumentLabelsJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "MasterItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPremium" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalFieldDefinition" (
    "id" UUID NOT NULL,
    "disciplineId" UUID NOT NULL,
    "categoryId" UUID,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "fieldType" "TechnicalFieldType" NOT NULL,
    "unit" TEXT,
    "optionsJson" JSONB,
    "validationJson" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryDataPackage" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "disciplineId" UUID NOT NULL,
    "packageType" "IndustryPackageType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "monthlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "annualPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "IndustryPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryDataPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryDataPackageItem" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "masterItemId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndustryDataPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPackageSubscription" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'development',
    "externalSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPackageSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLibraryItem" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sourceMasterItemId" UUID,
    "sourcePackageId" UUID,
    "disciplineId" UUID,
    "categoryId" UUID,
    "companyItemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "specificationJson" JSONB,
    "technicalDataJson" JSONB,
    "unit" TEXT NOT NULL,
    "defaultSupplierId" UUID,
    "defaultRateCatalogueItemId" UUID,
    "defaultCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "defaultMarginMode" "MarginMode" NOT NULL DEFAULT 'MARKUP',
    "defaultMargin" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "defaultSellingRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tagsJson" JSONB,
    "searchKeywordsJson" JSONB,
    "sourceType" "CompanyLibrarySourceType" NOT NULL DEFAULT 'MANUAL',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLibraryItemVersion" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "companyLibraryItemId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "changeReason" TEXT NOT NULL DEFAULT '',
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyLibraryItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLibraryItemVariant" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "companyLibraryItemId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "variantCode" TEXT NOT NULL,
    "specificationOverridesJson" JSONB,
    "technicalOverridesJson" JSONB,
    "unit" TEXT,
    "defaultSupplierId" UUID,
    "defaultCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "defaultSellingRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLibraryItemVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyItemUsage" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "companyLibraryItemId" UUID NOT NULL,
    "projectId" UUID,
    "boqId" UUID,
    "boqItemId" UUID,
    "usedByUserId" UUID,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyItemUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMappingTemplate" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "destinationType" "ImportDestinationType" NOT NULL,
    "mappingJson" JSONB NOT NULL,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportMappingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID,
    "uploadedFileName" TEXT NOT NULL,
    "storageKey" TEXT,
    "mappingTemplateId" UUID,
    "sourceType" "ImportSourceType" NOT NULL,
    "destinationType" "ImportDestinationType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "importJobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawDataJson" JSONB NOT NULL,
    "normalizedDataJson" JSONB,
    "validationErrorsJson" JSONB,
    "validationWarningsJson" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "destinationEntityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoftwarePlan_key_key" ON "SoftwarePlan"("key");

-- CreateIndex
CREATE INDEX "SoftwarePlan_planType_idx" ON "SoftwarePlan"("planType");

-- CreateIndex
CREATE INDEX "SoftwarePlan_isActive_idx" ON "SoftwarePlan"("isActive");

-- CreateIndex
CREATE INDEX "CompanySoftwareSubscription_companyId_idx" ON "CompanySoftwareSubscription"("companyId");

-- CreateIndex
CREATE INDEX "CompanySoftwareSubscription_softwarePlanId_idx" ON "CompanySoftwareSubscription"("softwarePlanId");

-- CreateIndex
CREATE INDEX "CompanySoftwareSubscription_status_idx" ON "CompanySoftwareSubscription"("status");

-- CreateIndex
CREATE INDEX "CompanyTrialUsage_companyId_idx" ON "CompanyTrialUsage"("companyId");

-- CreateIndex
CREATE INDEX "CompanyTrialUsage_subscriptionId_idx" ON "CompanyTrialUsage"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTrialUsage_companyId_subscriptionId_key" ON "CompanyTrialUsage"("companyId", "subscriptionId");

-- CreateIndex
CREATE INDEX "TrialPremiumItemUnlock_companyId_idx" ON "TrialPremiumItemUnlock"("companyId");

-- CreateIndex
CREATE INDEX "TrialPremiumItemUnlock_subscriptionId_idx" ON "TrialPremiumItemUnlock"("subscriptionId");

-- CreateIndex
CREATE INDEX "TrialPremiumItemUnlock_masterItemId_idx" ON "TrialPremiumItemUnlock"("masterItemId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialPremiumItemUnlock_companyId_subscriptionId_masterItemI_key" ON "TrialPremiumItemUnlock"("companyId", "subscriptionId", "masterItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBranding_companyId_key" ON "CompanyBranding"("companyId");

-- CreateIndex
CREATE INDEX "CompanyBranding_preferredTemplateId_idx" ON "CompanyBranding"("preferredTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterDiscipline_key_key" ON "MasterDiscipline"("key");

-- CreateIndex
CREATE INDEX "MasterDiscipline_isActive_idx" ON "MasterDiscipline"("isActive");

-- CreateIndex
CREATE INDEX "MasterCategory_disciplineId_idx" ON "MasterCategory"("disciplineId");

-- CreateIndex
CREATE INDEX "MasterCategory_parentCategoryId_idx" ON "MasterCategory"("parentCategoryId");

-- CreateIndex
CREATE INDEX "MasterCategory_path_idx" ON "MasterCategory"("path");

-- CreateIndex
CREATE INDEX "MasterItem_disciplineId_idx" ON "MasterItem"("disciplineId");

-- CreateIndex
CREATE INDEX "MasterItem_categoryId_idx" ON "MasterItem"("categoryId");

-- CreateIndex
CREATE INDEX "MasterItem_status_idx" ON "MasterItem"("status");

-- CreateIndex
CREATE INDEX "MasterItem_isPremium_idx" ON "MasterItem"("isPremium");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItem_disciplineId_itemCode_key" ON "MasterItem"("disciplineId", "itemCode");

-- CreateIndex
CREATE INDEX "TechnicalFieldDefinition_disciplineId_idx" ON "TechnicalFieldDefinition"("disciplineId");

-- CreateIndex
CREATE INDEX "TechnicalFieldDefinition_categoryId_idx" ON "TechnicalFieldDefinition"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryDataPackage_key_key" ON "IndustryDataPackage"("key");

-- CreateIndex
CREATE INDEX "IndustryDataPackage_disciplineId_idx" ON "IndustryDataPackage"("disciplineId");

-- CreateIndex
CREATE INDEX "IndustryDataPackage_packageType_idx" ON "IndustryDataPackage"("packageType");

-- CreateIndex
CREATE INDEX "IndustryDataPackage_status_idx" ON "IndustryDataPackage"("status");

-- CreateIndex
CREATE INDEX "IndustryDataPackageItem_packageId_idx" ON "IndustryDataPackageItem"("packageId");

-- CreateIndex
CREATE INDEX "IndustryDataPackageItem_masterItemId_idx" ON "IndustryDataPackageItem"("masterItemId");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryDataPackageItem_packageId_masterItemId_key" ON "IndustryDataPackageItem"("packageId", "masterItemId");

-- CreateIndex
CREATE INDEX "CompanyPackageSubscription_companyId_idx" ON "CompanyPackageSubscription"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPackageSubscription_packageId_idx" ON "CompanyPackageSubscription"("packageId");

-- CreateIndex
CREATE INDEX "CompanyPackageSubscription_status_idx" ON "CompanyPackageSubscription"("status");

-- CreateIndex
CREATE INDEX "CompanyLibraryItem_companyId_idx" ON "CompanyLibraryItem"("companyId");

-- CreateIndex
CREATE INDEX "CompanyLibraryItem_disciplineId_idx" ON "CompanyLibraryItem"("disciplineId");

-- CreateIndex
CREATE INDEX "CompanyLibraryItem_categoryId_idx" ON "CompanyLibraryItem"("categoryId");

-- CreateIndex
CREATE INDEX "CompanyLibraryItem_sourceMasterItemId_idx" ON "CompanyLibraryItem"("sourceMasterItemId");

-- CreateIndex
CREATE INDEX "CompanyLibraryItem_isFavorite_idx" ON "CompanyLibraryItem"("isFavorite");

-- CreateIndex
CREATE INDEX "CompanyLibraryItem_isActive_idx" ON "CompanyLibraryItem"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLibraryItem_companyId_companyItemCode_key" ON "CompanyLibraryItem"("companyId", "companyItemCode");

-- CreateIndex
CREATE INDEX "CompanyLibraryItemVersion_companyId_idx" ON "CompanyLibraryItemVersion"("companyId");

-- CreateIndex
CREATE INDEX "CompanyLibraryItemVersion_companyLibraryItemId_idx" ON "CompanyLibraryItemVersion"("companyLibraryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLibraryItemVersion_companyLibraryItemId_version_key" ON "CompanyLibraryItemVersion"("companyLibraryItemId", "version");

-- CreateIndex
CREATE INDEX "CompanyLibraryItemVariant_companyId_idx" ON "CompanyLibraryItemVariant"("companyId");

-- CreateIndex
CREATE INDEX "CompanyLibraryItemVariant_companyLibraryItemId_idx" ON "CompanyLibraryItemVariant"("companyLibraryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLibraryItemVariant_companyLibraryItemId_variantCode_key" ON "CompanyLibraryItemVariant"("companyLibraryItemId", "variantCode");

-- CreateIndex
CREATE INDEX "CompanyItemUsage_companyId_idx" ON "CompanyItemUsage"("companyId");

-- CreateIndex
CREATE INDEX "CompanyItemUsage_companyLibraryItemId_idx" ON "CompanyItemUsage"("companyLibraryItemId");

-- CreateIndex
CREATE INDEX "CompanyItemUsage_projectId_idx" ON "CompanyItemUsage"("projectId");

-- CreateIndex
CREATE INDEX "CompanyItemUsage_usedAt_idx" ON "CompanyItemUsage"("usedAt");

-- CreateIndex
CREATE INDEX "ImportMappingTemplate_companyId_idx" ON "ImportMappingTemplate"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMappingTemplate_companyId_name_key" ON "ImportMappingTemplate"("companyId", "name");

-- CreateIndex
CREATE INDEX "ImportJob_companyId_idx" ON "ImportJob"("companyId");

-- CreateIndex
CREATE INDEX "ImportJob_projectId_idx" ON "ImportJob"("projectId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportRow_companyId_idx" ON "ImportRow"("companyId");

-- CreateIndex
CREATE INDEX "ImportRow_importJobId_idx" ON "ImportRow"("importJobId");

-- CreateIndex
CREATE INDEX "ImportRow_status_idx" ON "ImportRow"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_importJobId_rowNumber_key" ON "ImportRow"("importJobId", "rowNumber");

-- CreateIndex
CREATE INDEX "BOQItem_sourceMasterItemId_idx" ON "BOQItem"("sourceMasterItemId");

-- CreateIndex
CREATE INDEX "BOQItem_sourceCompanyLibraryItemId_idx" ON "BOQItem"("sourceCompanyLibraryItemId");

-- AddForeignKey
ALTER TABLE "CompanySoftwareSubscription" ADD CONSTRAINT "CompanySoftwareSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySoftwareSubscription" ADD CONSTRAINT "CompanySoftwareSubscription_softwarePlanId_fkey" FOREIGN KEY ("softwarePlanId") REFERENCES "SoftwarePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyTrialUsage" ADD CONSTRAINT "CompanyTrialUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyTrialUsage" ADD CONSTRAINT "CompanyTrialUsage_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CompanySoftwareSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialPremiumItemUnlock" ADD CONSTRAINT "TrialPremiumItemUnlock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialPremiumItemUnlock" ADD CONSTRAINT "TrialPremiumItemUnlock_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CompanySoftwareSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialPremiumItemUnlock" ADD CONSTRAINT "TrialPremiumItemUnlock_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBranding" ADD CONSTRAINT "CompanyBranding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBranding" ADD CONSTRAINT "CompanyBranding_preferredTemplateId_fkey" FOREIGN KEY ("preferredTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCategory" ADD CONSTRAINT "MasterCategory_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "MasterDiscipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCategory" ADD CONSTRAINT "MasterCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "MasterCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItem" ADD CONSTRAINT "MasterItem_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "MasterDiscipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItem" ADD CONSTRAINT "MasterItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalFieldDefinition" ADD CONSTRAINT "TechnicalFieldDefinition_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "MasterDiscipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalFieldDefinition" ADD CONSTRAINT "TechnicalFieldDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryDataPackage" ADD CONSTRAINT "IndustryDataPackage_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "MasterDiscipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryDataPackageItem" ADD CONSTRAINT "IndustryDataPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "IndustryDataPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryDataPackageItem" ADD CONSTRAINT "IndustryDataPackageItem_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPackageSubscription" ADD CONSTRAINT "CompanyPackageSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPackageSubscription" ADD CONSTRAINT "CompanyPackageSubscription_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "IndustryDataPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItem" ADD CONSTRAINT "CompanyLibraryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItem" ADD CONSTRAINT "CompanyLibraryItem_sourceMasterItemId_fkey" FOREIGN KEY ("sourceMasterItemId") REFERENCES "MasterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItem" ADD CONSTRAINT "CompanyLibraryItem_sourcePackageId_fkey" FOREIGN KEY ("sourcePackageId") REFERENCES "IndustryDataPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItem" ADD CONSTRAINT "CompanyLibraryItem_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "MasterDiscipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItem" ADD CONSTRAINT "CompanyLibraryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItem" ADD CONSTRAINT "CompanyLibraryItem_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItem" ADD CONSTRAINT "CompanyLibraryItem_defaultRateCatalogueItemId_fkey" FOREIGN KEY ("defaultRateCatalogueItemId") REFERENCES "RateCatalogueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItem" ADD CONSTRAINT "CompanyLibraryItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItemVersion" ADD CONSTRAINT "CompanyLibraryItemVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItemVersion" ADD CONSTRAINT "CompanyLibraryItemVersion_companyLibraryItemId_fkey" FOREIGN KEY ("companyLibraryItemId") REFERENCES "CompanyLibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItemVersion" ADD CONSTRAINT "CompanyLibraryItemVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItemVariant" ADD CONSTRAINT "CompanyLibraryItemVariant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItemVariant" ADD CONSTRAINT "CompanyLibraryItemVariant_companyLibraryItemId_fkey" FOREIGN KEY ("companyLibraryItemId") REFERENCES "CompanyLibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLibraryItemVariant" ADD CONSTRAINT "CompanyLibraryItemVariant_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyItemUsage" ADD CONSTRAINT "CompanyItemUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyItemUsage" ADD CONSTRAINT "CompanyItemUsage_companyLibraryItemId_fkey" FOREIGN KEY ("companyLibraryItemId") REFERENCES "CompanyLibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyItemUsage" ADD CONSTRAINT "CompanyItemUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyItemUsage" ADD CONSTRAINT "CompanyItemUsage_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyItemUsage" ADD CONSTRAINT "CompanyItemUsage_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyItemUsage" ADD CONSTRAINT "CompanyItemUsage_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMappingTemplate" ADD CONSTRAINT "ImportMappingTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMappingTemplate" ADD CONSTRAINT "ImportMappingTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_mappingTemplateId_fkey" FOREIGN KEY ("mappingTemplateId") REFERENCES "ImportMappingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_sourceMasterItemId_fkey" FOREIGN KEY ("sourceMasterItemId") REFERENCES "MasterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_sourceCompanyLibraryItemId_fkey" FOREIGN KEY ("sourceCompanyLibraryItemId") REFERENCES "CompanyLibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_sourceCatalogueItemId_fkey" FOREIGN KEY ("sourceCatalogueItemId") REFERENCES "RateCatalogueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_sourcePreviousBoqItemId_fkey" FOREIGN KEY ("sourcePreviousBoqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_copiedByUserId_fkey" FOREIGN KEY ("copiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

