import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIGRATION_NAME = "20260814105935_refund_workflow";
const CHECKSUM =
  "5cc80c9e022ce5d567dc5c6583cce1d548002373aaf705e1aba2644e96f1d785";

/**
 * REFUND-23 — owner-only, one-time, idempotent production application of:
 *   20260814105935_refund_workflow
 *
 * Same shape as apply-commercial-checkout-migration/route.ts (that route's
 * pattern, reused deliberately): production DATABASE_URL is Sensitive-typed
 * in Vercel and unreachable from Prisma CLI/`vercel env run`, so this is the
 * established, reviewed mechanism for applying an already-committed,
 * already-reviewed additive migration to production.
 *
 * This endpoint deliberately uses additive SQL only, hardcoded to exactly
 * mirror prisma/migrations/20260814105935_refund_workflow/migration.sql —
 * it does NOT accept SQL, a migration name, or anything else from the
 * request. There is no generic/arbitrary-SQL capability here.
 *
 * It creates:
 * - RefundRequestStatus, RefundAction, RefundExceptionCategory enums
 * - RefundRequest table (successfulPaymentAt NOT NULL from creation)
 * - required indexes and foreign keys
 *
 * It does NOT:
 * - create charges, refunds, or Checkout Sessions
 * - call Stripe
 * - cancel any subscription
 * - read or expose Stripe API keys
 * - remove existing indexes, columns, or tables
 *
 * A transaction lock serializes concurrent attempts so an accidental
 * refresh/double-open cannot apply the migration twice.
 */
export async function POST() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);

    const result = await prisma.$transaction(
      async (tx) => {
        const log: string[] = [];

        await tx.$executeRawUnsafe(
          `LOCK TABLE "_prisma_migrations" IN EXCLUSIVE MODE`,
        );

        /*
         * Same reasoning as apply-commercial-checkout-migration: a row
         * existing in _prisma_migrations is not by itself proof the
         * migration successfully applied. Trusting migration_name +
         * checksum alone would report a genuinely failed/partial migration
         * as "already applied" and skip the DDL below — leaving the
         * database without RefundRequest and no automated way to notice.
         */
        const existingMigrations = await tx.$queryRaw<
          Array<{
            checksum: string;
            started_at: Date;
            finished_at: Date | null;
            rolled_back_at: Date | null;
            applied_steps_count: number;
          }>
        >`
          SELECT
            checksum::text AS checksum,
            started_at,
            finished_at,
            rolled_back_at,
            applied_steps_count
          FROM "_prisma_migrations"
          WHERE migration_name = ${MIGRATION_NAME}
          ORDER BY started_at ASC
        `;

        if (existingMigrations.length > 0) {
          const mismatched = existingMigrations.find((row) => row.checksum !== CHECKSUM);
          if (mismatched) {
            throw new AppError(
              "REFUND_MIGRATION_CHECKSUM_MISMATCH",
              "The refund workflow migration is already recorded with a different checksum. Stop and review before continuing.",
              409,
            );
          }

          const cleanlyApplied = existingMigrations.find(
            (row) => row.finished_at !== null && row.rolled_back_at === null && row.applied_steps_count > 0,
          );
          if (cleanlyApplied) {
            return {
              alreadyApplied: true,
              log: [
                `${MIGRATION_NAME}: already recorded with the expected checksum and a completed, non-rolled-back application; no database changes were made.`,
              ],
            };
          }

          throw new AppError(
            "REFUND_MIGRATION_STATE_AMBIGUOUS",
            "An existing _prisma_migrations row for this migration is unfinished or rolled back rather than cleanly applied. Manual review of the actual database schema is required before retrying — no changes were made.",
            409,
          );
        }

        await tx.$executeRawUnsafe(`
          DO $$ BEGIN
            CREATE TYPE "RefundRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'SUCCEEDED', 'FAILED');
          EXCEPTION WHEN duplicate_object THEN null;
          END $$;
        `);
        await tx.$executeRawUnsafe(`
          DO $$ BEGIN
            CREATE TYPE "RefundAction" AS ENUM ('REFUND_ONLY', 'REFUND_AND_CANCEL');
          EXCEPTION WHEN duplicate_object THEN null;
          END $$;
        `);
        await tx.$executeRawUnsafe(`
          DO $$ BEGIN
            CREATE TYPE "RefundExceptionCategory" AS ENUM ('DUPLICATE_CHARGE', 'INCORRECT_BILLING', 'PROVIDER_ERROR', 'LEGAL_REMEDY');
          EXCEPTION WHEN duplicate_object THEN null;
          END $$;
        `);
        log.push("Ensured RefundRequestStatus, RefundAction, RefundExceptionCategory enums exist.");

        await tx.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "RefundRequest" (
            "id" UUID NOT NULL,
            "companyId" UUID NOT NULL,
            "requestedByUserId" UUID NOT NULL,
            "approvedByUserId" UUID,
            "companySoftwareSubscriptionId" UUID,
            "externalSubscriptionId" TEXT NOT NULL,
            "stripeInvoiceId" TEXT,
            "stripePaymentIntentId" TEXT NOT NULL,
            "stripeChargeId" TEXT,
            "stripeRefundId" TEXT,
            "originalAmountMinor" INTEGER NOT NULL,
            "requestedAmountMinor" INTEGER NOT NULL,
            "currency" "CommerceCurrency" NOT NULL DEFAULT 'AED',
            "reason" TEXT NOT NULL,
            "successfulPaymentAt" TIMESTAMP(3) NOT NULL,
            "isException" BOOLEAN NOT NULL DEFAULT false,
            "exceptionCategory" "RefundExceptionCategory",
            "action" "RefundAction",
            "status" "RefundRequestStatus" NOT NULL DEFAULT 'REQUESTED',
            "rejectionReason" TEXT,
            "failureCode" TEXT,
            "failureMessage" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "approvedAt" TIMESTAMP(3),
            "rejectedAt" TIMESTAMP(3),
            "completedAt" TIMESTAMP(3),

            CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
          )
        `);
        log.push("Ensured RefundRequest table exists.");

        await tx.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "RefundRequest_companyId_idx" ON "RefundRequest"("companyId")
        `);
        await tx.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "RefundRequest_status_idx" ON "RefundRequest"("status")
        `);
        await tx.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "RefundRequest_stripePaymentIntentId_idx" ON "RefundRequest"("stripePaymentIntentId")
        `);
        await tx.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "RefundRequest_externalSubscriptionId_idx" ON "RefundRequest"("externalSubscriptionId")
        `);
        log.push("Ensured RefundRequest indexes exist.");

        const existingConstraints = new Set(
          (
            await tx.$queryRaw<Array<{ conname: string }>>`
              SELECT conname::text AS conname
              FROM pg_constraint
              WHERE conrelid = '"RefundRequest"'::regclass
              AND conname IN (
                'RefundRequest_companyId_fkey',
                'RefundRequest_requestedByUserId_fkey',
                'RefundRequest_approvedByUserId_fkey',
                'RefundRequest_companySoftwareSubscriptionId_fkey'
              )
            `
          ).map((constraint) => constraint.conname),
        );

        if (!existingConstraints.has("RefundRequest_companyId_fkey")) {
          await tx.$executeRawUnsafe(`
            ALTER TABLE "RefundRequest"
            ADD CONSTRAINT "RefundRequest_companyId_fkey"
            FOREIGN KEY ("companyId")
            REFERENCES "Company"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE
          `);
          log.push("Added RefundRequest_companyId_fkey.");
        }

        if (!existingConstraints.has("RefundRequest_requestedByUserId_fkey")) {
          await tx.$executeRawUnsafe(`
            ALTER TABLE "RefundRequest"
            ADD CONSTRAINT "RefundRequest_requestedByUserId_fkey"
            FOREIGN KEY ("requestedByUserId")
            REFERENCES "User"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE
          `);
          log.push("Added RefundRequest_requestedByUserId_fkey.");
        }

        if (!existingConstraints.has("RefundRequest_approvedByUserId_fkey")) {
          await tx.$executeRawUnsafe(`
            ALTER TABLE "RefundRequest"
            ADD CONSTRAINT "RefundRequest_approvedByUserId_fkey"
            FOREIGN KEY ("approvedByUserId")
            REFERENCES "User"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE
          `);
          log.push("Added RefundRequest_approvedByUserId_fkey.");
        }

        if (!existingConstraints.has("RefundRequest_companySoftwareSubscriptionId_fkey")) {
          await tx.$executeRawUnsafe(`
            ALTER TABLE "RefundRequest"
            ADD CONSTRAINT "RefundRequest_companySoftwareSubscriptionId_fkey"
            FOREIGN KEY ("companySoftwareSubscriptionId")
            REFERENCES "CompanySoftwareSubscription"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE
          `);
          log.push("Added RefundRequest_companySoftwareSubscriptionId_fkey.");
        }

        await tx.$executeRaw`
          INSERT INTO "_prisma_migrations" (
            id,
            checksum,
            migration_name,
            started_at,
            finished_at,
            applied_steps_count
          )
          VALUES (
            gen_random_uuid()::text,
            ${CHECKSUM},
            ${MIGRATION_NAME},
            now(),
            now(),
            1
          )
        `;

        log.push(`${MIGRATION_NAME}: successfully applied and recorded.`);

        return {
          alreadyApplied: false,
          log,
        };
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      },
    );

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
