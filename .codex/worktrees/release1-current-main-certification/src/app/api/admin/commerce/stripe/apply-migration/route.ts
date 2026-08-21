import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * STRIPE-1C — owner-only, idempotent apply of migration
 * 20260805090000_stripe_1c_provider_sync (CommercePrice review-status
 * columns, CommerceProviderMapping, CommerceSyncRun, and the 4 partial
 * unique indexes). Purely additive. Same break-glass pattern as every prior
 * production migration endpoint this project has used — runs inside this
 * deployment using its real runtime DATABASE_URL. Every raw identifier
 * column read (`pg_type.typname`, `information_schema.columns.column_name`,
 * `pg_indexes.indexname`, `pg_constraint.conname`) is cast to ::text —
 * Postgres's internal `name` type otherwise fails Prisma's $queryRaw
 * deserializer (P2010), as found the hard way during STRIPE-1B-RECOVERY.
 *
 * After the schema objects exist, this also performs the one-time,
 * explicitly-scoped data step promoting exactly the 4 independently
 * confirmed anchor prices to APPROVED — every other price stays at its
 * column default (REQUIRES_REVIEW). This UPDATE only ever fires once
 * (guarded by the same _prisma_migrations recorded-or-not check as the
 * schema changes) and only touches reviewStatus — never amount, currency,
 * or interval.
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const log: string[] = [];
    const MIGRATION_NAME = "20260805090000_stripe_1c_provider_sync";
    const CHECKSUM = "c642ebaad741f0aa997fef8afe059ca2ee71eb022b6b92d5369dc64b909a339e";
    const CONFIRMED_ANCHOR_PRICE_CODES = [
      "starter_monthly_aed_149",
      "professional_monthly_aed_399",
      "business_monthly_aed_899",
      "enterprise_installation_from_aed_15000",
    ];

    const alreadyRecorded = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME}
    `;
    if (alreadyRecorded.length > 0) {
      return apiSuccess({ alreadyApplied: true, log: ["Migration already recorded as applied — no action taken."] });
    }

    await prisma.$transaction(async (tx) => {
      const existingTypes = await tx.$queryRaw<{ typname: string }[]>`
        SELECT typname::text AS typname FROM pg_type WHERE typname IN
          ('CommercePriceReviewStatus', 'CommerceProvider', 'CommerceProviderEnvironment', 'CommerceProviderObjectType', 'CommerceProviderSyncStatus', 'CommerceSyncOperation', 'CommerceSyncRunStatus')
      `;
      const typeNames = new Set(existingTypes.map((t) => t.typname));

      const enumStatements: Array<{ name: string; sql: () => Promise<unknown> }> = [
        { name: "CommercePriceReviewStatus", sql: () => tx.$executeRaw`CREATE TYPE "CommercePriceReviewStatus" AS ENUM ('DRAFT', 'REQUIRES_REVIEW', 'APPROVED', 'RETIRED')` },
        { name: "CommerceProvider", sql: () => tx.$executeRaw`CREATE TYPE "CommerceProvider" AS ENUM ('STRIPE')` },
        { name: "CommerceProviderEnvironment", sql: () => tx.$executeRaw`CREATE TYPE "CommerceProviderEnvironment" AS ENUM ('TEST', 'LIVE')` },
        { name: "CommerceProviderObjectType", sql: () => tx.$executeRaw`CREATE TYPE "CommerceProviderObjectType" AS ENUM ('PRODUCT', 'PRICE')` },
        { name: "CommerceProviderSyncStatus", sql: () => tx.$executeRaw`CREATE TYPE "CommerceProviderSyncStatus" AS ENUM ('SYNCED', 'DRIFTED', 'ARCHIVED', 'ERROR')` },
        { name: "CommerceSyncOperation", sql: () => tx.$executeRaw`CREATE TYPE "CommerceSyncOperation" AS ENUM ('DRY_RUN', 'SYNCHRONIZE', 'VERIFY')` },
        { name: "CommerceSyncRunStatus", sql: () => tx.$executeRaw`CREATE TYPE "CommerceSyncRunStatus" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED')` },
      ];
      for (const stmt of enumStatements) {
        if (!typeNames.has(stmt.name)) {
          await stmt.sql();
          log.push(`Created enum ${stmt.name}.`);
        } else {
          log.push(`Enum ${stmt.name} already exists — skipped.`);
        }
      }

      const priceCols = await tx.$queryRaw<{ column_name: string }[]>`
        SELECT column_name::text AS column_name FROM information_schema.columns
        WHERE table_name = 'CommercePrice' AND column_name IN ('reviewStatus', 'reviewedByUserId', 'reviewedAt', 'reviewNote')
      `;
      const priceColNames = new Set(priceCols.map((c) => c.column_name));
      if (!priceColNames.has("reviewNote")) {
        await tx.$executeRaw`ALTER TABLE "CommercePrice" ADD COLUMN "reviewNote" TEXT`;
        log.push('Added CommercePrice."reviewNote".');
      }
      if (!priceColNames.has("reviewStatus")) {
        await tx.$executeRaw`ALTER TABLE "CommercePrice" ADD COLUMN "reviewStatus" "CommercePriceReviewStatus" NOT NULL DEFAULT 'REQUIRES_REVIEW'`;
        log.push('Added CommercePrice."reviewStatus" (defaulted to REQUIRES_REVIEW for every existing row).');
      }
      if (!priceColNames.has("reviewedAt")) {
        await tx.$executeRaw`ALTER TABLE "CommercePrice" ADD COLUMN "reviewedAt" TIMESTAMP(3)`;
        log.push('Added CommercePrice."reviewedAt".');
      }
      if (!priceColNames.has("reviewedByUserId")) {
        await tx.$executeRaw`ALTER TABLE "CommercePrice" ADD COLUMN "reviewedByUserId" UUID`;
        log.push('Added CommercePrice."reviewedByUserId".');
      }

      const tables = await tx.$queryRaw<{ table_name: string }[]>`
        SELECT table_name::text AS table_name FROM information_schema.tables WHERE table_name IN ('CommerceProviderMapping', 'CommerceSyncRun')
      `;
      const tableNames = new Set(tables.map((t) => t.table_name));

      if (!tableNames.has("CommerceProviderMapping")) {
        await tx.$executeRaw`
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
          )
        `;
        log.push("Created table CommerceProviderMapping.");
      } else {
        log.push("Table CommerceProviderMapping already exists — skipped.");
      }

      if (!tableNames.has("CommerceSyncRun")) {
        await tx.$executeRaw`
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
          )
        `;
        log.push("Created table CommerceSyncRun.");
      } else {
        log.push("Table CommerceSyncRun already exists — skipped.");
      }

      const existingIndexes = await tx.$queryRaw<{ indexname: string }[]>`
        SELECT indexname::text AS indexname FROM pg_indexes WHERE tablename IN ('CommerceProviderMapping', 'CommerceSyncRun', 'CommercePrice')
      `;
      const indexNames = new Set(existingIndexes.map((i) => i.indexname));

      const indexStatements: Array<{ name: string; sql: () => Promise<unknown> }> = [
        { name: "CommerceProviderMapping_commerceProductId_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceProviderMapping_commerceProductId_idx" ON "CommerceProviderMapping"("commerceProductId")` },
        { name: "CommerceProviderMapping_commercePriceId_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceProviderMapping_commercePriceId_idx" ON "CommerceProviderMapping"("commercePriceId")` },
        { name: "CommerceProviderMapping_provider_environment_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceProviderMapping_provider_environment_idx" ON "CommerceProviderMapping"("provider", "environment")` },
        { name: "CommerceProviderMapping_synchronizationStatus_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceProviderMapping_synchronizationStatus_idx" ON "CommerceProviderMapping"("synchronizationStatus")` },
        { name: "CommerceProviderMapping_product_scope_key", sql: () => tx.$executeRaw`CREATE UNIQUE INDEX "CommerceProviderMapping_product_scope_key" ON "CommerceProviderMapping" ("provider", "environment", "commerceProductId") WHERE "providerObjectType" = 'PRODUCT'` },
        { name: "CommerceProviderMapping_price_scope_key", sql: () => tx.$executeRaw`CREATE UNIQUE INDEX "CommerceProviderMapping_price_scope_key" ON "CommerceProviderMapping" ("provider", "environment", "commercePriceId") WHERE "providerObjectType" = 'PRICE'` },
        { name: "CommerceProviderMapping_provider_product_key", sql: () => tx.$executeRaw`CREATE UNIQUE INDEX "CommerceProviderMapping_provider_product_key" ON "CommerceProviderMapping" ("provider", "environment", "providerProductId") WHERE "providerObjectType" = 'PRODUCT'` },
        { name: "CommerceProviderMapping_provider_price_key", sql: () => tx.$executeRaw`CREATE UNIQUE INDEX "CommerceProviderMapping_provider_price_key" ON "CommerceProviderMapping" ("provider", "environment", "providerPriceId") WHERE "providerObjectType" = 'PRICE'` },
        { name: "CommerceSyncRun_provider_environment_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceSyncRun_provider_environment_idx" ON "CommerceSyncRun"("provider", "environment")` },
        { name: "CommerceSyncRun_status_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceSyncRun_status_idx" ON "CommerceSyncRun"("status")` },
        { name: "CommerceSyncRun_startedAt_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommerceSyncRun_startedAt_idx" ON "CommerceSyncRun"("startedAt")` },
        { name: "CommercePrice_reviewStatus_idx", sql: () => tx.$executeRaw`CREATE INDEX "CommercePrice_reviewStatus_idx" ON "CommercePrice"("reviewStatus")` },
      ];
      for (const stmt of indexStatements) {
        if (!indexNames.has(stmt.name)) {
          await stmt.sql();
          log.push(`Created index ${stmt.name}.`);
        }
      }

      const existingConstraints = await tx.$queryRaw<{ conname: string }[]>`
        SELECT conname::text AS conname FROM pg_constraint WHERE conname IN
          ('CommercePrice_reviewedByUserId_fkey', 'CommerceProviderMapping_commerceProductId_fkey', 'CommerceProviderMapping_commercePriceId_fkey', 'CommerceSyncRun_initiatedByUserId_fkey')
      `;
      const constraintNames = new Set(existingConstraints.map((c) => c.conname));

      if (!constraintNames.has("CommercePrice_reviewedByUserId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "CommercePrice" ADD CONSTRAINT "CommercePrice_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`;
        log.push("Added foreign key CommercePrice_reviewedByUserId_fkey.");
      }
      if (!constraintNames.has("CommerceProviderMapping_commerceProductId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "CommerceProviderMapping" ADD CONSTRAINT "CommerceProviderMapping_commerceProductId_fkey" FOREIGN KEY ("commerceProductId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        log.push("Added foreign key CommerceProviderMapping_commerceProductId_fkey.");
      }
      if (!constraintNames.has("CommerceProviderMapping_commercePriceId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "CommerceProviderMapping" ADD CONSTRAINT "CommerceProviderMapping_commercePriceId_fkey" FOREIGN KEY ("commercePriceId") REFERENCES "CommercePrice"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        log.push("Added foreign key CommerceProviderMapping_commercePriceId_fkey.");
      }
      if (!constraintNames.has("CommerceSyncRun_initiatedByUserId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "CommerceSyncRun" ADD CONSTRAINT "CommerceSyncRun_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`;
        log.push("Added foreign key CommerceSyncRun_initiatedByUserId_fkey.");
      }

      // One-time, explicitly-scoped data step: promote only the independently
      // confirmed anchor prices to APPROVED. Every other price stays at the
      // column default (REQUIRES_REVIEW) — never silently approved.
      const promoted = await tx.$queryRaw<{ code: string }[]>`
        UPDATE "CommercePrice"
        SET "reviewStatus" = 'APPROVED'
        WHERE code IN (${CONFIRMED_ANCHOR_PRICE_CODES[0]}, ${CONFIRMED_ANCHOR_PRICE_CODES[1]}, ${CONFIRMED_ANCHOR_PRICE_CODES[2]}, ${CONFIRMED_ANCHOR_PRICE_CODES[3]})
        RETURNING code::text AS code
      `;
      log.push(`Promoted ${promoted.length} confirmed anchor price(s) to APPROVED: ${promoted.map((p) => p.code).join(", ") || "none matched"}.`);

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
