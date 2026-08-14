import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIGRATION_NAME = "20260814172326_tayqan_1_worker_run_brief";
// Authoritative checksum: matches both the row Prisma itself wrote to
// _prisma_migrations when this migration was applied in development, and a
// fresh `sha256sum` of this exact migration.sql as committed to git (LF
// line endings) — not a checksum computed from a Windows working-tree
// checkout, which CRLF-converts the file and would produce a different,
// wrong value.
const CHECKSUM =
  "8fef0ce992d26ccf53e3792cf2972bd0004ce5d525096b1fa9b251e693a1bee3";

/**
 * TAYQAN WORKER BRIEF
 *
 * Owner-only, one-time, idempotent production application of:
 *   20260814172326_tayqan_1_worker_run_brief
 *
 * This endpoint is hardcoded to exactly one additive migration:
 *   ALTER TABLE "WorkerRun"
 *   ADD COLUMN "assignmentObjective" TEXT,
 *   ADD COLUMN "specialInstructions" TEXT;
 *
 * It does NOT accept a request body, a migration name, or any SQL from the
 * caller — there is no generic migration runner here. It does NOT touch
 * Stripe, refunds, or any other migration.
 *
 * A transaction-scoped exclusive lock on "_prisma_migrations" serializes
 * concurrent attempts so an accidental refresh/double-open cannot apply the
 * migration twice or race the pre-check against the DDL.
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
         * A row existing in _prisma_migrations for this migration_name is not
         * by itself proof the migration successfully applied — Prisma writes
         * the row BEFORE running the migration's SQL, then sets finished_at
         * only on success. A crashed/rolled-back/still-running attempt
         * leaves a row with the right migration_name and checksum but
         * finished_at IS NULL and/or rolled_back_at IS NOT NULL. Trusting
         * migration_name + checksum alone would report a genuinely failed
         * migration as "already applied" and skip verification, leaving the
         * database in an unknown state with no automated way to notice.
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
              "TAYQAN_MIGRATION_CHECKSUM_MISMATCH",
              "The TAYQAN worker brief migration is already recorded with a different checksum. Stop and review before continuing.",
              409,
            );
          }

          const cleanlyApplied = existingMigrations.find(
            (row) => row.finished_at !== null && row.rolled_back_at === null && row.applied_steps_count > 0,
          );
          if (cleanlyApplied) {
            const columns = await tx.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
              SELECT column_name::text AS column_name, data_type::text AS data_type, is_nullable::text AS is_nullable
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'WorkerRun'
                AND column_name IN ('assignmentObjective', 'specialInstructions')
            `;
            const columnsByName = new Map(columns.map((column) => [column.column_name, column]));
            for (const columnName of ["assignmentObjective", "specialInstructions"] as const) {
              const column = columnsByName.get(columnName);
              if (!column || column.data_type !== "text" || column.is_nullable !== "YES") {
                throw new AppError(
                  "TAYQAN_MIGRATION_STATE_AMBIGUOUS",
                  `The migration is recorded as cleanly applied, but WorkerRun."${columnName}" does not verify as a present, nullable TEXT column. Manual review of the actual database schema is required — no changes were made.`,
                  409,
                );
              }
            }
            return {
              alreadyApplied: true,
              log: [
                `${MIGRATION_NAME}: already recorded with the expected checksum and a completed, non-rolled-back application; both columns verified present as nullable TEXT. No database changes were made.`,
              ],
            };
          }

          // Every existing row for this migration is unfinished, rolled back,
          // or otherwise ambiguous. Never infer "safe to (re)run" from that
          // state automatically — a human needs to confirm the actual
          // database state before this route proceeds, not an automated retry.
          throw new AppError(
            "TAYQAN_MIGRATION_STATE_AMBIGUOUS",
            "An existing _prisma_migrations row for this migration is unfinished or rolled back rather than cleanly applied. Manual review of the actual database schema is required before retrying — no changes were made.",
            409,
          );
        }

        /*
         * No migration row exists yet. Before running any DDL, prove both
         * columns are actually absent — PostgreSQL has no
         * `ADD COLUMN IF NOT EXISTS` guard used here on purpose, so this
         * pre-check is the only thing standing between a clean first
         * application and silently colliding with a column that already
         * exists for some other reason (e.g. an out-of-band change). If
         * either column exists without a matching clean migration record,
         * stop rather than guess which state is correct.
         */
        const existingColumns = await tx.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name::text AS column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'WorkerRun'
            AND column_name IN ('assignmentObjective', 'specialInstructions')
        `;
        if (existingColumns.length > 0) {
          throw new AppError(
            "TAYQAN_MIGRATION_STATE_AMBIGUOUS",
            "WorkerRun already has one or more of the TAYQAN brief columns, but no migration record exists. Manual review of the actual database schema is required — no changes were made.",
            409,
          );
        }

        await tx.$executeRawUnsafe(`
          ALTER TABLE "WorkerRun"
          ADD COLUMN "assignmentObjective" TEXT,
          ADD COLUMN "specialInstructions" TEXT
        `);
        log.push('Added WorkerRun."assignmentObjective" and WorkerRun."specialInstructions".');

        const verifyColumns = await tx.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
          SELECT column_name::text AS column_name, data_type::text AS data_type, is_nullable::text AS is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'WorkerRun'
            AND column_name IN ('assignmentObjective', 'specialInstructions')
        `;
        const verified = new Map(verifyColumns.map((column) => [column.column_name, column]));
        for (const columnName of ["assignmentObjective", "specialInstructions"] as const) {
          const column = verified.get(columnName);
          if (!column || column.data_type !== "text" || column.is_nullable !== "YES") {
            throw new AppError(
              "TAYQAN_MIGRATION_VERIFICATION_FAILED",
              `WorkerRun."${columnName}" did not verify as a nullable TEXT column after the ALTER TABLE ran.`,
              500,
            );
          }
        }
        log.push("Verified both columns exist as nullable TEXT.");

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
