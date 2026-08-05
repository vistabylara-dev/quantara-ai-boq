import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * STRIPE-1B — owner-only, idempotent apply of migration
 * 20260805040000_stripe_1b_commerce_catalogue (3 new tables — CommerceProduct,
 * CommercePrice, EntitlementTemplate — 4 new enums, their indexes, and 3
 * foreign keys). Purely additive: no existing table, column, or row is
 * altered. Same break-glass pattern as
 * /api/admin/system-health/apply-pending-migrations from
 * PRODUCTION-RECOVERY-1 — runs inside this deployment using its real
 * runtime DATABASE_URL, which no external process (including this agent)
 * can read directly. Every step checks current state first (IF NOT EXISTS
 * where Postgres supports it, existence checks otherwise), so a retried or
 * partial-failure call never double-creates an object or fails on "already
 * exists". GET so it's reachable by pasting the URL in a browser.
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const log: string[] = [];
    const MIGRATION_NAME = "20260805040000_stripe_1b_commerce_catalogue";
    const CHECKSUM = "7bde40a14bf4c1949ab2c9b11308b68f5913115e04a9b30b8761f495f6be61ec";

    const alreadyRecorded = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME}
    `;
    if (alreadyRecorded.length > 0) {
      return apiSuccess({ alreadyApplied: true, log: ["Migration already recorded as applied — no action taken."] });
    }

    await prisma.$transaction(async (tx) => {
      const existingTypes = await tx.$queryRaw<{ typname: string }[]>`
        SELECT typname FROM pg_type WHERE typname IN
          ('CommerceProductType', 'CommercePurchaseMode', 'CommerceBillingInterval', 'CommerceCurrency')
      `;
      const typeNames = new Set(existingTypes.map((t) => t.typname));

      if (!typeNames.has("CommerceProductType")) {
        await tx.$executeRaw`CREATE TYPE "CommerceProductType" AS ENUM ('SUBSCRIPTION', 'ONE_TIME', 'INDUSTRY_ACCESS', 'AI_CREDIT_PACK', 'ADD_ON', 'ENTERPRISE')`;
        log.push("Created enum CommerceProductType.");
      } else {
        log.push("Enum CommerceProductType already exists — skipped.");
      }

      if (!typeNames.has("CommercePurchaseMode")) {
        await tx.$executeRaw`CREATE TYPE "CommercePurchaseMode" AS ENUM ('DIRECT', 'QUOTATION_REQUIRED', 'CONTACT_SALES')`;
        log.push("Created enum CommercePurchaseMode.");
      } else {
        log.push("Enum CommercePurchaseMode already exists — skipped.");
      }

      if (!typeNames.has("CommerceBillingInterval")) {
        await tx.$executeRaw`CREATE TYPE "CommerceBillingInterval" AS ENUM ('ONE_TIME', 'MONTH', 'YEAR')`;
        log.push("Created enum CommerceBillingInterval.");
      } else {
        log.push("Enum CommerceBillingInterval already exists — skipped.");
      }

      if (!typeNames.has("CommerceCurrency")) {
        await tx.$executeRaw`CREATE TYPE "CommerceCurrency" AS ENUM ('AED')`;
        log.push("Created enum CommerceCurrency.");
      } else {
        log.push("Enum CommerceCurrency already exists — skipped.");
      }

      await tx.$executeRaw`
        CREATE TABLE IF NOT EXISTS "CommerceProduct" (
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
        )
      `;
      await tx.$executeRaw`
        CREATE TABLE IF NOT EXISTS "CommercePrice" (
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
        )
      `;
      await tx.$executeRaw`
        CREATE TABLE IF NOT EXISTS "EntitlementTemplate" (
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
        )
      `;
      log.push("Ensured tables CommerceProduct, CommercePrice, EntitlementTemplate exist.");

      const existingIndexes = await tx.$queryRaw<{ indexname: string }[]>`
        SELECT indexname FROM pg_indexes WHERE tablename IN ('CommerceProduct', 'CommercePrice', 'EntitlementTemplate')
      `;
      const indexNames = new Set(existingIndexes.map((i) => i.indexname));

      const indexStatements: Array<{ name: string; sql: () => Promise<unknown> }> = [
        { name: "CommerceProduct_code_key", sql: () => tx.$executeRaw`CREATE UNIQUE INDEX "CommerceProduct_code_key" ON "CommerceProduct"("code")` },
        { name: "CommerceProduct_type_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceProduct_type_idx" ON "CommerceProduct"("type")` },
        { name: "CommerceProduct_isActive_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceProduct_isActive_idx" ON "CommerceProduct"("isActive")` },
        { name: "CommerceProduct_isPublic_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceProduct_isPublic_idx" ON "CommerceProduct"("isPublic")` },
        { name: "CommerceProduct_industryPackageId_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceProduct_industryPackageId_idx" ON "CommerceProduct"("industryPackageId")` },
        { name: "CommercePrice_code_key", sql: () => tx.$executeRaw`CREATE UNIQUE INDEX "CommercePrice_code_key" ON "CommercePrice"("code")` },
        { name: "CommercePrice_productId_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommercePrice_productId_idx" ON "CommercePrice"("productId")` },
        { name: "CommercePrice_isActive_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommercePrice_isActive_idx" ON "CommercePrice"("isActive")` },
        { name: "CommercePrice_billingInterval_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommercePrice_billingInterval_idx" ON "CommercePrice"("billingInterval")` },
        { name: "EntitlementTemplate_productId_key", sql: () => tx.$executeRaw`CREATE UNIQUE INDEX "EntitlementTemplate_productId_key" ON "EntitlementTemplate"("productId")` },
      ];
      for (const stmt of indexStatements) {
        if (!indexNames.has(stmt.name)) {
          await stmt.sql();
          log.push(`Created index ${stmt.name}.`);
        }
      }

      const existingConstraints = await tx.$queryRaw<{ conname: string }[]>`
        SELECT conname FROM pg_constraint WHERE conname IN
          ('CommerceProduct_industryPackageId_fkey', 'CommercePrice_productId_fkey', 'EntitlementTemplate_productId_fkey')
      `;
      const constraintNames = new Set(existingConstraints.map((c) => c.conname));

      if (!constraintNames.has("CommerceProduct_industryPackageId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "CommerceProduct" ADD CONSTRAINT "CommerceProduct_industryPackageId_fkey" FOREIGN KEY ("industryPackageId") REFERENCES "IndustryDataPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE`;
        log.push("Added foreign key CommerceProduct_industryPackageId_fkey.");
      }
      if (!constraintNames.has("CommercePrice_productId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "CommercePrice" ADD CONSTRAINT "CommercePrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        log.push("Added foreign key CommercePrice_productId_fkey.");
      }
      if (!constraintNames.has("EntitlementTemplate_productId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "EntitlementTemplate" ADD CONSTRAINT "EntitlementTemplate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        log.push("Added foreign key EntitlementTemplate_productId_fkey.");
      }

      await tx.$executeRaw`
        INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
        VALUES (gen_random_uuid()::text, ${CHECKSUM}, ${MIGRATION_NAME}, now(), now(), 1)
      `;
      log.push(`Recorded ${MIGRATION_NAME} as applied in _prisma_migrations.`);
    });

    return apiSuccess({ alreadyApplied: false, log });
  } catch (error) {
    return handleApiError(error);
  }
}
