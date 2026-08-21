-- STRIPE-1B: internal commerce product catalogue (products, prices, entitlement
-- templates). Additive only. No existing table, column, or row is altered,
-- renamed, or dropped. Deliberately does not touch SoftwarePlan,
-- CompanySoftwareSubscription, IndustryDataPackage, CompanyPackageSubscription,
-- or any other agent's in-progress work (e.g. SalesInquiry) — this migration
-- was hand-reviewed against the raw `prisma migrate diff` output specifically
-- to strip unrelated DROP statements that diff tool produced by comparing
-- against a shared local dev database with other uncommitted schema changes
-- already applied to it.

-- CreateEnum
CREATE TYPE "CommerceProductType" AS ENUM ('SUBSCRIPTION', 'ONE_TIME', 'INDUSTRY_ACCESS', 'AI_CREDIT_PACK', 'ADD_ON', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CommercePurchaseMode" AS ENUM ('DIRECT', 'QUOTATION_REQUIRED', 'CONTACT_SALES');

-- CreateEnum
CREATE TYPE "CommerceBillingInterval" AS ENUM ('ONE_TIME', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "CommerceCurrency" AS ENUM ('AED');

-- CreateTable
CREATE TABLE "CommerceProduct" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CommerceProductType" NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "purchaseMode" "CommercePurchaseMode" NOT NULL DEFAULT 'DIRECT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "industryPackageId" UUID,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercePrice" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" "CommerceCurrency" NOT NULL DEFAULT 'AED',
    "billingInterval" "CommerceBillingInterval" NOT NULL,
    "isFromPrice" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementTemplate" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "maxUsers" INTEGER,
    "maxWorkspaces" INTEGER,
    "maxActiveProjects" INTEGER,
    "maxBoqGenerationsPerMonth" INTEGER,
    "maxTechnicalReportsPerMonth" INTEGER,
    "maxWatermarkFreeExportsPerMonth" INTEGER,
    "permittedExportFormatsJson" JSONB,
    "removesWatermark" BOOLEAN NOT NULL DEFAULT false,
    "allowsCompanyBranding" BOOLEAN NOT NULL DEFAULT false,
    "allowsApiAccess" BOOLEAN NOT NULL DEFAULT false,
    "allowsWhiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "industryPackageKeysJson" JSONB,
    "aiCreditsGranted" INTEGER,
    "downloadLimit" INTEGER,
    "entitlementDurationDays" INTEGER,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommerceProduct_code_key" ON "CommerceProduct"("code");

-- CreateIndex
CREATE INDEX "CommerceProduct_type_idx" ON "CommerceProduct"("type");

-- CreateIndex
CREATE INDEX "CommerceProduct_isActive_idx" ON "CommerceProduct"("isActive");

-- CreateIndex
CREATE INDEX "CommerceProduct_isPublic_idx" ON "CommerceProduct"("isPublic");

-- CreateIndex
CREATE INDEX "CommerceProduct_industryPackageId_idx" ON "CommerceProduct"("industryPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePrice_code_key" ON "CommercePrice"("code");

-- CreateIndex
CREATE INDEX "CommercePrice_productId_idx" ON "CommercePrice"("productId");

-- CreateIndex
CREATE INDEX "CommercePrice_isActive_idx" ON "CommercePrice"("isActive");

-- CreateIndex
CREATE INDEX "CommercePrice_billingInterval_idx" ON "CommercePrice"("billingInterval");

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementTemplate_productId_key" ON "EntitlementTemplate"("productId");

-- AddForeignKey
ALTER TABLE "CommerceProduct" ADD CONSTRAINT "CommerceProduct_industryPackageId_fkey" FOREIGN KEY ("industryPackageId") REFERENCES "IndustryDataPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePrice" ADD CONSTRAINT "CommercePrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementTemplate" ADD CONSTRAINT "EntitlementTemplate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
