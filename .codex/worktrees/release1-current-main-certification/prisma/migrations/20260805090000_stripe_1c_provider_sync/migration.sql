-- STRIPE-1C: commercial price review gate + Stripe provider mapping/sync
-- history. Additive only. No existing table, column, or row is altered
-- destructively. reviewStatus defaults every price (including pre-existing
-- ones) to REQUIRES_REVIEW — never silently APPROVED; promoting the small
-- set of independently confirmed anchor prices to APPROVED is a separate,
-- explicit, reviewed data step (see the migration-apply endpoint), not a
-- column default.

-- CreateEnum
CREATE TYPE "CommercePriceReviewStatus" AS ENUM ('DRAFT', 'REQUIRES_REVIEW', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "CommerceProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "CommerceProviderEnvironment" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "CommerceProviderObjectType" AS ENUM ('PRODUCT', 'PRICE');

-- CreateEnum
CREATE TYPE "CommerceProviderSyncStatus" AS ENUM ('SYNCED', 'DRIFTED', 'ARCHIVED', 'ERROR');

-- CreateEnum
CREATE TYPE "CommerceSyncOperation" AS ENUM ('DRY_RUN', 'SYNCHRONIZE', 'VERIFY');

-- CreateEnum
CREATE TYPE "CommerceSyncRunStatus" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "CommercePrice" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "CommercePriceReviewStatus" NOT NULL DEFAULT 'REQUIRES_REVIEW',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" UUID;

-- CreateTable
CREATE TABLE "CommerceProviderMapping" (
    "id" UUID NOT NULL,
    "provider" "CommerceProvider" NOT NULL,
    "environment" "CommerceProviderEnvironment" NOT NULL,
    "commerceProductId" UUID NOT NULL,
    "commercePriceId" UUID,
    "providerProductId" TEXT NOT NULL,
    "providerPriceId" TEXT,
    "providerObjectType" "CommerceProviderObjectType" NOT NULL,
    "providerActive" BOOLEAN NOT NULL DEFAULT true,
    "synchronizationStatus" "CommerceProviderSyncStatus" NOT NULL DEFAULT 'SYNCED',
    "lastSynchronizedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceSyncRun" (
    "id" UUID NOT NULL,
    "provider" "CommerceProvider" NOT NULL,
    "environment" "CommerceProviderEnvironment" NOT NULL,
    "operation" "CommerceSyncOperation" NOT NULL,
    "status" "CommerceSyncRunStatus" NOT NULL DEFAULT 'PLANNED',
    "initiatedByUserId" UUID,
    "dryRun" BOOLEAN NOT NULL,
    "catalogueFingerprint" TEXT NOT NULL,
    "productsCreated" INTEGER NOT NULL DEFAULT 0,
    "productsUpdated" INTEGER NOT NULL DEFAULT 0,
    "productsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "productsArchived" INTEGER NOT NULL DEFAULT 0,
    "pricesCreated" INTEGER NOT NULL DEFAULT 0,
    "pricesUnchanged" INTEGER NOT NULL DEFAULT 0,
    "pricesArchived" INTEGER NOT NULL DEFAULT 0,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "safeErrorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CommerceSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommerceProviderMapping_commerceProductId_idx" ON "CommerceProviderMapping"("commerceProductId");

-- CreateIndex
CREATE INDEX "CommerceProviderMapping_commercePriceId_idx" ON "CommerceProviderMapping"("commercePriceId");

-- CreateIndex
CREATE INDEX "CommerceProviderMapping_provider_environment_idx" ON "CommerceProviderMapping"("provider", "environment");

-- CreateIndex
CREATE INDEX "CommerceProviderMapping_synchronizationStatus_idx" ON "CommerceProviderMapping"("synchronizationStatus");

-- CreateIndex: partial unique indexes (Prisma's schema DSL has no native
-- partial-index syntax without enabling a preview feature) — a plain unique
-- index across a nullable column would let Postgres admit unlimited NULLs,
-- which is wrong here since commercePriceId/providerPriceId are only
-- meaningful for PRICE-type rows.
CREATE UNIQUE INDEX "CommerceProviderMapping_product_scope_key"
  ON "CommerceProviderMapping" ("provider", "environment", "commerceProductId")
  WHERE "providerObjectType" = 'PRODUCT';

CREATE UNIQUE INDEX "CommerceProviderMapping_price_scope_key"
  ON "CommerceProviderMapping" ("provider", "environment", "commercePriceId")
  WHERE "providerObjectType" = 'PRICE';

CREATE UNIQUE INDEX "CommerceProviderMapping_provider_product_key"
  ON "CommerceProviderMapping" ("provider", "environment", "providerProductId")
  WHERE "providerObjectType" = 'PRODUCT';

CREATE UNIQUE INDEX "CommerceProviderMapping_provider_price_key"
  ON "CommerceProviderMapping" ("provider", "environment", "providerPriceId")
  WHERE "providerObjectType" = 'PRICE';

-- CreateIndex
CREATE INDEX "CommerceSyncRun_provider_environment_idx" ON "CommerceSyncRun"("provider", "environment");

-- CreateIndex
CREATE INDEX "CommerceSyncRun_status_idx" ON "CommerceSyncRun"("status");

-- CreateIndex
CREATE INDEX "CommerceSyncRun_startedAt_idx" ON "CommerceSyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "CommercePrice_reviewStatus_idx" ON "CommercePrice"("reviewStatus");

-- AddForeignKey
ALTER TABLE "CommercePrice" ADD CONSTRAINT "CommercePrice_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceProviderMapping" ADD CONSTRAINT "CommerceProviderMapping_commerceProductId_fkey" FOREIGN KEY ("commerceProductId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceProviderMapping" ADD CONSTRAINT "CommerceProviderMapping_commercePriceId_fkey" FOREIGN KEY ("commercePriceId") REFERENCES "CommercePrice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSyncRun" ADD CONSTRAINT "CommerceSyncRun_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
