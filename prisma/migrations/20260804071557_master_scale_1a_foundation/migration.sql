-- CreateEnum
CREATE TYPE "ManufacturerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StandardApplicabilityType" AS ENUM ('MANDATORY', 'ADVISORY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MasterClassificationSystem" ADD VALUE 'UNIFORMAT_II';
ALTER TYPE "MasterClassificationSystem" ADD VALUE 'NRM';
ALTER TYPE "MasterClassificationSystem" ADD VALUE 'SMM7';
ALTER TYPE "MasterClassificationSystem" ADD VALUE 'CESMM';
ALTER TYPE "MasterClassificationSystem" ADD VALUE 'OTHER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MasterHierarchyNodeType" ADD VALUE 'SUBSYSTEM';
ALTER TYPE "MasterHierarchyNodeType" ADD VALUE 'ITEM_TYPE';

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "brandNamesJson" JSONB,
    "country" TEXT,
    "website" TEXT,
    "status" "ManufacturerStatus" NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "regionsServedJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSeries" (
    "id" UUID NOT NULL,
    "manufacturerId" UUID NOT NULL,
    "seriesName" TEXT NOT NULL,
    "hierarchyNodeId" UUID,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModel" (
    "id" UUID NOT NULL,
    "modelCode" TEXT NOT NULL,
    "productSeriesId" UUID NOT NULL,
    "masterItemVersionId" UUID,
    "region" "MasterRegionScope",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "replacementProductModelId" UUID,
    "source" TEXT NOT NULL DEFAULT '',
    "verificationState" "MasterAttributeVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCertification" (
    "id" UUID NOT NULL,
    "productModelId" UUID,
    "masterItemId" UUID,
    "certificationType" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL DEFAULT '',
    "region" "MasterRegionScope",
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "verificationState" "MasterAttributeVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "sourceDocumentReference" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardAuthority" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItemStandardApplicability" (
    "id" UUID NOT NULL,
    "masterItemId" UUID NOT NULL,
    "standardAuthorityId" UUID NOT NULL,
    "clauseReference" TEXT NOT NULL DEFAULT '',
    "region" "MasterRegionScope",
    "applicabilityType" "StandardApplicabilityType" NOT NULL DEFAULT 'ADVISORY',
    "effectiveFrom" TIMESTAMP(3),
    "supersededDate" TIMESTAMP(3),
    "sourceDocumentReference" TEXT NOT NULL DEFAULT '',
    "verificationState" "MasterAttributeVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItemStandardApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Manufacturer_status_idx" ON "Manufacturer"("status");

-- CreateIndex
CREATE INDEX "Manufacturer_legalName_idx" ON "Manufacturer"("legalName");

-- CreateIndex
CREATE INDEX "ProductSeries_manufacturerId_idx" ON "ProductSeries"("manufacturerId");

-- CreateIndex
CREATE INDEX "ProductSeries_hierarchyNodeId_idx" ON "ProductSeries"("hierarchyNodeId");

-- CreateIndex
CREATE INDEX "ProductModel_masterItemVersionId_idx" ON "ProductModel"("masterItemVersionId");

-- CreateIndex
CREATE INDEX "ProductModel_verificationState_idx" ON "ProductModel"("verificationState");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModel_productSeriesId_modelCode_key" ON "ProductModel"("productSeriesId", "modelCode");

-- CreateIndex
CREATE INDEX "ProductCertification_productModelId_idx" ON "ProductCertification"("productModelId");

-- CreateIndex
CREATE INDEX "ProductCertification_masterItemId_idx" ON "ProductCertification"("masterItemId");

-- CreateIndex
CREATE INDEX "ProductCertification_verificationState_idx" ON "ProductCertification"("verificationState");

-- CreateIndex
CREATE UNIQUE INDEX "StandardAuthority_name_key" ON "StandardAuthority"("name");

-- CreateIndex
CREATE INDEX "MasterItemStandardApplicability_masterItemId_idx" ON "MasterItemStandardApplicability"("masterItemId");

-- CreateIndex
CREATE INDEX "MasterItemStandardApplicability_standardAuthorityId_idx" ON "MasterItemStandardApplicability"("standardAuthorityId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItemStandardApplicability_masterItemId_standardAuthor_key" ON "MasterItemStandardApplicability"("masterItemId", "standardAuthorityId", "clauseReference");

-- AddForeignKey
ALTER TABLE "ProductSeries" ADD CONSTRAINT "ProductSeries_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSeries" ADD CONSTRAINT "ProductSeries_hierarchyNodeId_fkey" FOREIGN KEY ("hierarchyNodeId") REFERENCES "MasterHierarchyNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_productSeriesId_fkey" FOREIGN KEY ("productSeriesId") REFERENCES "ProductSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_masterItemVersionId_fkey" FOREIGN KEY ("masterItemVersionId") REFERENCES "MasterItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_replacementProductModelId_fkey" FOREIGN KEY ("replacementProductModelId") REFERENCES "ProductModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCertification" ADD CONSTRAINT "ProductCertification_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCertification" ADD CONSTRAINT "ProductCertification_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemStandardApplicability" ADD CONSTRAINT "MasterItemStandardApplicability_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItemStandardApplicability" ADD CONSTRAINT "MasterItemStandardApplicability_standardAuthorityId_fkey" FOREIGN KEY ("standardAuthorityId") REFERENCES "StandardAuthority"("id") ON DELETE CASCADE ON UPDATE CASCADE;
