-- AlterEnum
ALTER TYPE "RateStatus" ADD VALUE 'PENDING';

-- DropIndex
DROP INDEX "RateCatalogueItem_companyId_industryEngineId_itemCode_effec_key";

-- AlterTable
ALTER TABLE "BOQItem" ADD COLUMN     "pricingMetadataJson" JSONB;

-- AlterTable
ALTER TABLE "RateCatalogueItem" DROP COLUMN "cost",
DROP COLUMN "supplier",
ADD COLUMN     "additionalCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "baseCost" DECIMAL(18,4) NOT NULL,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "countryOfOrigin" TEXT,
ADD COLUMN     "freightCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "installationCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "landedCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "marginMode" "MarginMode" NOT NULL DEFAULT 'MARKUP',
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "minimumSellingRate" DECIMAL(18,4),
ADD COLUMN     "model" TEXT,
ADD COLUMN     "sourceReference" TEXT,
ADD COLUMN     "specification" TEXT,
ADD COLUMN     "subcategory" TEXT,
ADD COLUMN     "supplierId" UUID,
ADD COLUMN     "supplierQuotationReference" TEXT,
ALTER COLUMN "sellingRate" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "taxRegistrationNumber" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'AED',
    "paymentTerms" TEXT,
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCataloguePriceHistory" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "rateCatalogueItemId" UUID NOT NULL,
    "previousBaseCost" DECIMAL(18,4) NOT NULL,
    "newBaseCost" DECIMAL(18,4) NOT NULL,
    "previousFreightCost" DECIMAL(18,4) NOT NULL,
    "newFreightCost" DECIMAL(18,4) NOT NULL,
    "previousInstallationCost" DECIMAL(18,4) NOT NULL,
    "newInstallationCost" DECIMAL(18,4) NOT NULL,
    "previousAdditionalCost" DECIMAL(18,4) NOT NULL,
    "newAdditionalCost" DECIMAL(18,4) NOT NULL,
    "previousLandedCost" DECIMAL(18,4) NOT NULL,
    "newLandedCost" DECIMAL(18,4) NOT NULL,
    "previousMargin" DECIMAL(7,4) NOT NULL,
    "newMargin" DECIMAL(7,4) NOT NULL,
    "previousSellingRate" DECIMAL(18,4) NOT NULL,
    "newSellingRate" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "changedByUserId" UUID,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateCataloguePriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_email_idx" ON "Supplier"("email");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE INDEX "RateCataloguePriceHistory_companyId_idx" ON "RateCataloguePriceHistory"("companyId");

-- CreateIndex
CREATE INDEX "RateCataloguePriceHistory_rateCatalogueItemId_idx" ON "RateCataloguePriceHistory"("rateCatalogueItemId");

-- CreateIndex
CREATE INDEX "RateCatalogueItem_supplierId_idx" ON "RateCatalogueItem"("supplierId");

-- CreateIndex
CREATE INDEX "RateCatalogueItem_category_idx" ON "RateCatalogueItem"("category");

-- CreateIndex
CREATE INDEX "RateCatalogueItem_expiryDate_idx" ON "RateCatalogueItem"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "RateCatalogueItem_companyId_itemCode_key" ON "RateCatalogueItem"("companyId", "itemCode");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCatalogueItem" ADD CONSTRAINT "RateCatalogueItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCataloguePriceHistory" ADD CONSTRAINT "RateCataloguePriceHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCataloguePriceHistory" ADD CONSTRAINT "RateCataloguePriceHistory_rateCatalogueItemId_fkey" FOREIGN KEY ("rateCatalogueItemId") REFERENCES "RateCatalogueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCataloguePriceHistory" ADD CONSTRAINT "RateCataloguePriceHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

