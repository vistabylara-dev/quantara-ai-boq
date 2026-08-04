-- CreateEnum
CREATE TYPE "MasterHierarchyNodeType" AS ENUM ('INDUSTRY', 'DISCIPLINE', 'SYSTEM', 'CATEGORY', 'SUBCATEGORY', 'ITEM_FAMILY');

-- CreateEnum
CREATE TYPE "MasterItemVersionStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "MasterClassificationSystem" AS ENUM ('MASTERFORMAT_2020', 'CSI', 'OMNICLASS', 'UNIFORMAT', 'IFC', 'INTERNAL_QUANTARA', 'REVIT_CATEGORY', 'CAD_LAYER', 'REGIONAL_CODE', 'COST_CODE');

-- CreateEnum
CREATE TYPE "MasterRegionScope" AS ENUM ('UAE', 'GCC', 'INTERNATIONAL', 'COUNTRY_SPECIFIC');

-- CreateEnum
CREATE TYPE "MasterQuantityMethod" AS ENUM ('COUNT', 'LENGTH', 'AREA', 'VOLUME', 'WEIGHT');

-- CreateEnum
CREATE TYPE "MasterAttributeVerificationState" AS ENUM ('UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "MasterItemRelationType" AS ENUM ('REQUIRED_ACCESSORY', 'OPTIONAL_ACCESSORY', 'MATERIAL', 'LABOR', 'EQUIPMENT', 'CONSUMABLE', 'TESTED_WITH', 'COMMISSIONED_WITH', 'INSTALLED_WITH', 'ALTERNATIVE_TO', 'REPLACEMENT', 'PART_OF_ASSEMBLY');

-- AlterTable
ALTER TABLE "BOQItem" ADD COLUMN     "masterItemSnapshotJson" JSONB,
ADD COLUMN     "sourceMasterItemVersionId" UUID;

-- AlterTable
ALTER TABLE "MasterItem" ADD COLUMN     "hierarchyNodeId" UUID,
ADD COLUMN     "replacementItemId" UUID;

-- AlterTable
ALTER TABLE "TechnicalFieldDefinition" ADD COLUMN     "allowedUnitsJson" JSONB,
ADD COLUMN     "applicableHierarchyNodeId" UUID,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "unitFamily" TEXT;

-- CreateTable
CREATE TABLE "MasterHierarchyNode" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "nodeType" "MasterHierarchyNodeType" NOT NULL,
    "parentId" UUID,
    "regionScope" "MasterRegionScope",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterHierarchyNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItemVersion" (
    "id" UUID NOT NULL,
    "masterItemId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "MasterItemVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3),
    "supersededDate" TIMESTAMP(3),
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "fullDescription" TEXT NOT NULL DEFAULT '',
    "specificationTemplate" TEXT NOT NULL DEFAULT '',
    "inclusionTemplate" TEXT NOT NULL DEFAULT '',
    "exclusionTemplate" TEXT NOT NULL DEFAULT '',
    "notesTemplate" TEXT NOT NULL DEFAULT '',
    "primaryUnit" TEXT NOT NULL,
    "measurementMethod" TEXT NOT NULL DEFAULT '',
    "quantityBasis" TEXT NOT NULL DEFAULT '',
    "roundingRule" TEXT NOT NULL DEFAULT '',
    "wasteFactorPercentage" DECIMAL(7,4),
    "packageMultiple" DECIMAL(12,4),
    "createdByUserId" UUID,
    "reviewedByUserId" UUID,
    "approvedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItemVariant" (
    "id" UUID NOT NULL,
    "masterItemId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItemVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItemAttributeValue" (
    "id" UUID NOT NULL,
    "masterItemId" UUID,
    "variantId" UUID,
    "fieldDefinitionId" UUID NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(20,6),
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "unit" TEXT,
    "source" TEXT NOT NULL DEFAULT '',
    "verificationState" "MasterAttributeVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "masterItemVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItemAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItemClassification" (
    "id" UUID NOT NULL,
    "masterItemId" UUID NOT NULL,
    "system" "MasterClassificationSystem" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT '',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItemClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItemRegionalApplicability" (
    "id" UUID NOT NULL,
    "masterItemId" UUID NOT NULL,
    "scope" "MasterRegionScope" NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT '',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "languageAvailabilityJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItemRegionalApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItemDrawingProfile" (
    "id" UUID NOT NULL,
    "masterItemId" UUID NOT NULL,
    "drawingTypesJson" JSONB,
    "scheduleTypesJson" JSONB,
    "symbolReference" TEXT,
    "cadLayerReference" TEXT,
    "ifcClass" TEXT,
    "revitCategory" TEXT,
    "roomSpaceTypesJson" JSONB,
    "quantityMethod" "MasterQuantityMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItemDrawingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItemRelation" (
    "id" UUID NOT NULL,
    "fromItemId" UUID NOT NULL,
    "toItemId" UUID NOT NULL,
    "relationType" "MasterItemRelationType" NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItemRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterHierarchyNode_code_key" ON "MasterHierarchyNode"("code");

-- CreateIndex
CREATE INDEX "MasterHierarchyNode_parentId_idx" ON "MasterHierarchyNode"("parentId");

-- CreateIndex
CREATE INDEX "MasterHierarchyNode_nodeType_idx" ON "MasterHierarchyNode"("nodeType");

-- CreateIndex
CREATE INDEX "MasterHierarchyNode_isActive_idx" ON "MasterHierarchyNode"("isActive");

-- CreateIndex
CREATE INDEX "MasterItemVersion_masterItemId_idx" ON "MasterItemVersion"("masterItemId");

-- CreateIndex
CREATE INDEX "MasterItemVersion_status_idx" ON "MasterItemVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItemVersion_masterItemId_versionNumber_key" ON "MasterItemVersion"("masterItemId", "versionNumber");

-- CreateIndex
CREATE INDEX "MasterItemVariant_masterItemId_idx" ON "MasterItemVariant"("masterItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItemVariant_masterItemId_code_key" ON "MasterItemVariant"("masterItemId", "code");

-- CreateIndex
CREATE INDEX "MasterItemAttributeValue_masterItemId_idx" ON "MasterItemAttributeValue"("masterItemId");

-- CreateIndex
CREATE INDEX "MasterItemAttributeValue_variantId_idx" ON "MasterItemAttributeValue"("variantId");

-- CreateIndex
CREATE INDEX "MasterItemAttributeValue_fieldDefinitionId_idx" ON "MasterItemAttributeValue"("fieldDefinitionId");

-- CreateIndex
CREATE INDEX "MasterItemClassification_masterItemId_idx" ON "MasterItemClassification"("masterItemId");

-- CreateIndex
CREATE INDEX "MasterItemClassification_system_idx" ON "MasterItemClassification"("system");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItemClassification_masterItemId_system_code_key" ON "MasterItemClassification"("masterItemId", "system", "code");

-- CreateIndex
CREATE INDEX "MasterItemRegionalApplicability_masterItemId_idx" ON "MasterItemRegionalApplicability"("masterItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItemRegionalApplicability_masterItemId_scope_countryC_key" ON "MasterItemRegionalApplicability"("masterItemId", "scope", "countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItemDrawingProfile_masterItemId_key" ON "MasterItemDrawingProfile"("masterItemId");

-- CreateIndex
CREATE INDEX "MasterItemRelation_fromItemId_idx" ON "MasterItemRelation"("fromItemId");

-- CreateIndex
CREATE INDEX "MasterItemRelation_toItemId_idx" ON "MasterItemRelation"("toItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItemRelation_fromItemId_toItemId_relationType_key" ON "MasterItemRelation"("fromItemId", "toItemId", "relationType");

-- CreateIndex
CREATE INDEX "BOQItem_sourceMasterItemVersionId_idx" ON "BOQItem"("sourceMasterItemVersionId");

-- CreateIndex
CREATE INDEX "MasterItem_hierarchyNodeId_idx" ON "MasterItem"("hierarchyNodeId");

-- CreateIndex
CREATE INDEX "MasterItem_replacementItemId_idx" ON "MasterItem"("replacementItemId");

-- CreateIndex
CREATE INDEX "TechnicalFieldDefinition_applicableHierarchyNodeId_idx" ON "TechnicalFieldDefinition"("applicableHierarchyNodeId");

-- AddForeignKey
ALTER TABLE "MasterItem" ADD CONSTRAINT "MasterItem_hierarchyNodeId_fkey" FOREIGN KEY ("hierarchyNodeId") REFERENCES "MasterHierarchyNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItem" ADD CONSTRAINT "MasterItem_replacementItemId_fkey" FOREIGN KEY ("replacementItemId") REFERENCES "MasterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalFieldDefinition" ADD CONSTRAINT "TechnicalFieldDefinition_applicableHierarchyNodeId_fkey" FOREIGN KEY ("applicableHierarchyNodeId") REFERENCES "MasterHierarchyNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterHierarchyNode" ADD CONSTRAINT "MasterHierarchyNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MasterHierarchyNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemVersion" ADD CONSTRAINT "MasterItemVersion_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemVersion" ADD CONSTRAINT "MasterItemVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemVersion" ADD CONSTRAINT "MasterItemVersion_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemVersion" ADD CONSTRAINT "MasterItemVersion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemVariant" ADD CONSTRAINT "MasterItemVariant_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemAttributeValue" ADD CONSTRAINT "MasterItemAttributeValue_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemAttributeValue" ADD CONSTRAINT "MasterItemAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "MasterItemVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemAttributeValue" ADD CONSTRAINT "MasterItemAttributeValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "TechnicalFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemAttributeValue" ADD CONSTRAINT "MasterItemAttributeValue_masterItemVersionId_fkey" FOREIGN KEY ("masterItemVersionId") REFERENCES "MasterItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemClassification" ADD CONSTRAINT "MasterItemClassification_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemRegionalApplicability" ADD CONSTRAINT "MasterItemRegionalApplicability_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemDrawingProfile" ADD CONSTRAINT "MasterItemDrawingProfile_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemRelation" ADD CONSTRAINT "MasterItemRelation_fromItemId_fkey" FOREIGN KEY ("fromItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemRelation" ADD CONSTRAINT "MasterItemRelation_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_sourceMasterItemVersionId_fkey" FOREIGN KEY ("sourceMasterItemVersionId") REFERENCES "MasterItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
