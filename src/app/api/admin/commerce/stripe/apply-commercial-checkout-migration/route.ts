import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIGRATION_NAME = "20260810195100_stripe_commercial_checkout";
const CHECKSUM =
  "c25c4720ec81ac237547293ddb0a121ae98bf57e9317dc4f6a03b880e7e27c29";

/**
 * STRIPE COMMERCIAL CHECKOUT
 *
 * Owner-only, one-time, idempotent production application of:
 *   20260810195100_stripe_commercial_checkout
 *
 * This endpoint deliberately uses additive SQL only.
 *
 * It creates:
 * - StripeBillingCustomer
 * - StripeWebhookEvent
 * - the unique external Stripe subscription mapping
 * - required indexes and foreign keys
 *
 * It does NOT:
 * - create charges
 * - create Checkout Sessions
 * - call Stripe
 * - read or expose Stripe API keys
 * - remove existing indexes or columns
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

        /*
         * Serialize migration writers. This protects against two browser
         * requests reaching this endpoint at the same time.
         */
        await tx.$executeRawUnsafe(
          `LOCK TABLE "_prisma_migrations" IN EXCLUSIVE MODE`,
        );

        /*
         * A row existing in _prisma_migrations for this migration_name is not
         * by itself proof the migration successfully applied — Prisma writes
         * the row BEFORE running the migration's SQL, then sets finished_at
         * only on success. A crashed/rolled-back/still-running attempt
         * leaves a row with the right migration_name and checksum but
         * finished_at IS NULL and/or rolled_back_at IS NOT NULL. Trusting
         * migration_name + checksum alone (the previous version of this
         * check) would report a genuinely failed migration as "already
         * applied" and skip the DDL below entirely, leaving the database
         * without the tables/indexes/constraints this route exists to
         * create — and with no automated way to notice.
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
              "STRIPE_MIGRATION_CHECKSUM_MISMATCH",
              "The Stripe commercial checkout migration is already recorded with a different checksum. Stop and review before continuing.",
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

          // Every existing row for this migration is unfinished, rolled back, or
          // otherwise ambiguous (0 applied_steps_count with no finished_at). Never
          // infer "safe to (re)run" from that state automatically — the DDL below
          // is IF-NOT-EXISTS-guarded and safe to retry, but an ambiguous prior
          // attempt (e.g. one that partially ran outside this route, or crashed
          // mid-transaction) needs a human to confirm the actual database state
          // before this route proceeds, not a fully automated retry.
          throw new AppError(
            "STRIPE_MIGRATION_STATE_AMBIGUOUS",
            "An existing _prisma_migrations row for this migration is unfinished or rolled back rather than cleanly applied. Manual review of the actual database schema is required before retrying — no changes were made.",
            409,
          );
        }

        /*
         * The new unique externalSubscriptionId index must not be created if
         * legacy data contains duplicate non-null Stripe subscription IDs.
         * Null values are allowed by PostgreSQL unique indexes.
         */
        const duplicateSubscriptionIds = await tx.$queryRaw<
          Array<{ external_subscription_id: string }>
        >`
          SELECT
            "externalSubscriptionId"::text AS external_subscription_id
          FROM "CompanySoftwareSubscription"
          WHERE "externalSubscriptionId" IS NOT NULL
          GROUP BY "externalSubscriptionId"
          HAVING COUNT(*) > 1
          LIMIT 1
        `;

        if (duplicateSubscriptionIds.length > 0) {
          throw new AppError(
            "STRIPE_DUPLICATE_EXTERNAL_SUBSCRIPTION_ID",
            "The Stripe migration cannot continue because duplicate external subscription IDs exist. No migration changes were applied.",
            409,
          );
        }

        /*
         * Keep Stripe customer identity outside Company itself. This avoids
         * making every existing Company query depend on a newly-added column
         * before production has received this migration.
         *
         * livemode separates Stripe test-mode and live-mode customer identity.
         */
        await tx.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "StripeBillingCustomer" (
            "id" UUID NOT NULL,
            "companyId" UUID NOT NULL,
            "stripeCustomerId" TEXT NOT NULL,
            "livemode" BOOLEAN NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "StripeBillingCustomer_pkey"
              PRIMARY KEY ("id")
          )
        `);
        log.push("Ensured StripeBillingCustomer table exists.");

        /*
         * Webhook idempotency ledger.
         *
         * Only safe Stripe event metadata is stored here. Raw webhook bodies,
         * card information, API keys and webhook signing secrets are not
         * persisted in this table.
         */
        await tx.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "StripeWebhookEvent" (
            "id" UUID NOT NULL,
            "stripeEventId" TEXT NOT NULL,
            "eventType" TEXT NOT NULL,
            "livemode" BOOLEAN NOT NULL,
            "companyId" UUID,
            "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "StripeWebhookEvent_pkey"
              PRIMARY KEY ("id")
          )
        `);
        log.push("Ensured StripeWebhookEvent table exists.");

        await tx.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS
            "StripeBillingCustomer_stripeCustomerId_key"
          ON "StripeBillingCustomer"("stripeCustomerId")
        `);

        await tx.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS
            "StripeBillingCustomer_companyId_livemode_key"
          ON "StripeBillingCustomer"("companyId", "livemode")
        `);

        await tx.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS
            "StripeBillingCustomer_companyId_idx"
          ON "StripeBillingCustomer"("companyId")
        `);

        await tx.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS
            "StripeBillingCustomer_livemode_idx"
          ON "StripeBillingCustomer"("livemode")
        `);

        await tx.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS
            "StripeWebhookEvent_stripeEventId_key"
          ON "StripeWebhookEvent"("stripeEventId")
        `);

        await tx.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS
            "StripeWebhookEvent_companyId_idx"
          ON "StripeWebhookEvent"("companyId")
        `);

        await tx.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS
            "StripeWebhookEvent_eventType_idx"
          ON "StripeWebhookEvent"("eventType")
        `);

        await tx.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS
            "StripeWebhookEvent_processedAt_idx"
          ON "StripeWebhookEvent"("processedAt")
        `);

        await tx.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS
            "CompanySoftwareSubscription_externalSubscriptionId_key"
          ON "CompanySoftwareSubscription"("externalSubscriptionId")
        `);

        log.push("Ensured Stripe commercial checkout indexes exist.");

        /*
         * PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS, so inspect
         * the catalogue before adding each foreign key.
         */
        const existingConstraints = new Set(
          (
            await tx.$queryRaw<Array<{ conname: string }>>`
              SELECT conname::text AS conname
              FROM pg_constraint
              WHERE conrelid IN (
                '"StripeBillingCustomer"'::regclass,
                '"StripeWebhookEvent"'::regclass
              )
              AND conname IN (
                'StripeBillingCustomer_companyId_fkey',
                'StripeWebhookEvent_companyId_fkey'
              )
            `
          ).map((constraint) => constraint.conname),
        );

        if (
          !existingConstraints.has(
            "StripeBillingCustomer_companyId_fkey",
          )
        ) {
          await tx.$executeRawUnsafe(`
            ALTER TABLE "StripeBillingCustomer"
            ADD CONSTRAINT "StripeBillingCustomer_companyId_fkey"
            FOREIGN KEY ("companyId")
            REFERENCES "Company"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE
          `);

          log.push(
            "Added StripeBillingCustomer_companyId_fkey.",
          );
        }

        if (
          !existingConstraints.has(
            "StripeWebhookEvent_companyId_fkey",
          )
        ) {
          await tx.$executeRawUnsafe(`
            ALTER TABLE "StripeWebhookEvent"
            ADD CONSTRAINT "StripeWebhookEvent_companyId_fkey"
            FOREIGN KEY ("companyId")
            REFERENCES "Company"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE
          `);

          log.push(
            "Added StripeWebhookEvent_companyId_fkey.",
          );
        }

        /*
         * Record exactly the migration Prisma expects so later migration
         * checks recognize this schema as applied.
         */
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

        log.push(
          `${MIGRATION_NAME}: successfully applied and recorded.`,
        );

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
