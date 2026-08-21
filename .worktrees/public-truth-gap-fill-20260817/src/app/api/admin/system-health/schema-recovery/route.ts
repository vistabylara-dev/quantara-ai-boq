import { PlatformRole } from "@prisma/client";
import { Pool, type PoolClient } from "pg";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { AppError } from "@/lib/errors/app-error";
import { apiFailure, apiSuccess } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const PINNED_COMMIT = "2ec627a8881499b03ac275fe3de466e0c308f98b";

type ExpectedObject =
  | { kind: "table"; name: string }
  | { kind: "column"; table: string; name: string };

type RecoveryMigration = {
  name: string;
  expectedObjects: ExpectedObject[];
};

/**
 * The six migrations this route recovered production with — kept here only
 * so GET can keep reporting their state for the historical/audit trail. The
 * migration-execution capability itself has been permanently disabled (see
 * POST below): this list is no longer executable, read-only inspection only.
 */
const RECOVERY_MIGRATIONS: readonly RecoveryMigration[] = [
  {
    name: "20260812114554_add_table_page_resolution",
    expectedObjects: [{ kind: "table", name: "TablePageResolution" }],
  },
  {
    name: "20260813200000_evidence_retention",
    expectedObjects: [
      { kind: "table", name: "ProjectFileArchive" },
      { kind: "table", name: "TechnicalReportRetention" },
    ],
  },
  {
    name: "20260813213000_estimate_integrity_graph",
    expectedObjects: [
      { kind: "table", name: "BOQItemQuantityProvenance" },
      { kind: "table", name: "BOQItemRateProvenance" },
      { kind: "table", name: "BOQRevisionItemEvidence" },
    ],
  },
  {
    name: "20260814021631_worker_v0_review_existing_boq",
    expectedObjects: [
      { kind: "table", name: "WorkerAssignment" },
      { kind: "table", name: "WorkerReviewWorkspace" },
      { kind: "table", name: "WorkerDecision" },
      { kind: "table", name: "WorkerMaterialQuestion" },
      { kind: "table", name: "WorkerEvent" },
    ],
  },
  {
    name: "20260814024355_worker_v1_durable_runner",
    expectedObjects: [
      { kind: "table", name: "WorkerRun" },
      { kind: "table", name: "WorkerRunEvent" },
      { kind: "table", name: "WorkerAIPlan" },
    ],
  },
  {
    name: "20260814172326_tayqan_1_worker_run_brief",
    expectedObjects: [
      { kind: "column", table: "WorkerRun", name: "assignmentObjective" },
      { kind: "column", table: "WorkerRun", name: "specialInstructions" },
    ],
  },
] as const;

type MigrationRow = {
  checksum: string;
  started_at: Date;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
};

function databaseUrl(): string {
  const value = process.env.DATABASE_URL ?? "";
  if (!/^postgres(?:ql)?:\/\//.test(value)) {
    throw new AppError(
      "SCHEMA_RECOVERY_DATABASE_URL_UNAVAILABLE",
      "The production database connection is unavailable to the recovery runtime.",
      503,
    );
  }
  return value;
}

async function expectedObjectPresent(client: PoolClient, object: ExpectedObject): Promise<boolean> {
  if (object.kind === "table") {
    const result = await client.query<{ present: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL AS present`,
      [`public."${object.name}"`],
    );
    return result.rows[0]?.present === true;
  }

  const result = await client.query<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS present`,
    [object.table, object.name],
  );
  return result.rows[0]?.present === true;
}

async function inspectExpectedObjects(client: PoolClient, migration: RecoveryMigration) {
  const results: Record<string, boolean> = {};
  for (const object of migration.expectedObjects) {
    const key = object.kind === "table" ? object.name : `${object.table}.${object.name}`;
    results[key] = await expectedObjectPresent(client, object);
  }
  return results;
}

async function migrationRows(client: PoolClient, migrationName: string): Promise<MigrationRow[]> {
  const result = await client.query<MigrationRow>(
    `SELECT checksum, started_at, finished_at, rolled_back_at, applied_steps_count
     FROM "_prisma_migrations"
     WHERE migration_name = $1
     ORDER BY started_at ASC`,
    [migrationName],
  );
  return result.rows;
}

function isCleanlyApplied(row: MigrationRow): boolean {
  return row.finished_at !== null && row.rolled_back_at === null && row.applied_steps_count > 0;
}

async function inspectRecoveryState(client: PoolClient) {
  const migrations = [];
  for (const migration of RECOVERY_MIGRATIONS) {
    const rows = await migrationRows(client, migration.name);
    migrations.push({
      name: migration.name,
      recorded: rows.length > 0,
      cleanlyApplied: rows.some(isCleanlyApplied),
      ambiguousRecord: rows.length > 0 && !rows.some(isCleanlyApplied),
      objects: await inspectExpectedObjects(client, migration),
    });
  }
  return migrations;
}

function safeErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return apiFailure(error.code, error.message, error.status, error.fieldErrors);
  }

  console.error(
    "[schema-recovery] unexpected failure",
    error instanceof Error ? error.message : error,
  );
  return apiFailure(
    "SCHEMA_RECOVERY_FAILED",
    "The production schema recovery failed and was rolled back. Review server logs before retrying.",
    500,
  );
}

export async function GET() {
  let pool: Pool | undefined;
  let client: PoolClient | undefined;
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    pool = new Pool({ connectionString: databaseUrl(), max: 1, connectionTimeoutMillis: 5_000 });
    client = await pool.connect();

    const [identity] = (
      await client.query<{ current_database: string; current_schema: string }>(
        `SELECT current_database()::text AS current_database, current_schema()::text AS current_schema`,
      )
    ).rows;

    return apiSuccess({
      mode: "read-only",
      pinnedCommit: PINNED_COMMIT,
      databaseName: identity?.current_database ?? null,
      schemaName: identity?.current_schema ?? null,
      migrations: await inspectRecoveryState(client),
    });
  } catch (error) {
    return safeErrorResponse(error);
  } finally {
    client?.release();
    if (pool) await pool.end().catch(() => undefined);
  }
}

/**
 * The one-time production schema recovery this route existed to perform
 * (20260812114554_add_table_page_resolution through
 * 20260814172326_tayqan_1_worker_run_brief) has been applied and verified:
 * 43 total / 43 clean / 0 unfinished migration rows, every expected schema
 * object present, core customer-data row counts unchanged. Leaving a
 * production migration-execution endpoint enabled indefinitely is not
 * something this route should keep doing — the mutation capability is
 * permanently disabled here. GET above remains available for read-only
 * migration-state inspection.
 */
export async function POST() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    throw new AppError(
      "SCHEMA_RECOVERY_DISABLED",
      "This one-time production schema recovery has already been applied and verified (43 total, 43 clean, 0 unfinished). The mutation capability has been permanently disabled. Use GET on this route for read-only migration-state inspection.",
      410,
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}
