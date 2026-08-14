import { createHash, randomUUID } from "node:crypto";
import { PlatformRole } from "@prisma/client";
import { Pool, type PoolClient } from "pg";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { AppError } from "@/lib/errors/app-error";
import { apiFailure, apiSuccess } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const REPO = "vistabylara-dev/quantara-ai-boq";
const PINNED_COMMIT = "2ec627a8881499b03ac275fe3de466e0c308f98b";

type ExpectedObject =
  | { kind: "table"; name: string }
  | { kind: "column"; table: string; name: string };

type RecoveryMigration = {
  name: string;
  expectedObjects: ExpectedObject[];
};

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

type MigrationSource = RecoveryMigration & {
  sql: string;
  checksum: string;
};

type MigrationRow = {
  checksum: string;
  started_at: Date;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
};

const EXPECTED_DATABASE_NAME = "quantara_staging";
const EXPECTED_SCHEMA_NAME = "public";
const EXPECTED_TOTAL_CLEAN_MIGRATIONS = 43;

/**
 * Already applied outside this recovery route and never touched by it —
 * RECOVERY_MIGRATIONS above deliberately excludes this name, so the main
 * loop can never execute or record it. This constant exists only so the
 * pre-flight and final-verification gates can confirm its state stays
 * exactly one clean, completed row throughout the recovery.
 */
const REFUND_MIGRATION_NAME = "20260814105935_refund_workflow";

/**
 * Hardcoded and never derived from request input — safe to interpolate as
 * an identifier. Row counts on these tables must be provably unchanged by
 * a recovery run that is only supposed to add new tables/columns, never
 * touch existing customer data.
 */
const CORE_DATA_TABLES = [
  "Company",
  "User",
  "Project",
  "BOQ",
  "MasterItem",
  "DocumentTemplate",
  "GeneratedDocument",
] as const;

async function coreDataCounts(client: PoolClient): Promise<Record<(typeof CORE_DATA_TABLES)[number], number>> {
  const counts = {} as Record<(typeof CORE_DATA_TABLES)[number], number>;
  for (const table of CORE_DATA_TABLES) {
    const result = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "${table}"`);
    counts[table] = Number(result.rows[0]?.count ?? "0");
  }
  return counts;
}

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

async function fetchMigrationSource(migration: RecoveryMigration): Promise<MigrationSource> {
  const url =
    `https://api.github.com/repos/${REPO}/contents/` +
    `prisma/migrations/${migration.name}/migration.sql?ref=${PINNED_COMMIT}`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "quantara-production-schema-recovery",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new AppError(
      "SCHEMA_RECOVERY_SOURCE_UNAVAILABLE",
      `The pinned migration source could not be retrieved for ${migration.name}.`,
      503,
    );
  }

  const payload = (await response.json()) as {
    type?: string;
    encoding?: string;
    content?: string;
  };

  if (payload.type !== "file" || payload.encoding !== "base64" || !payload.content) {
    throw new AppError(
      "SCHEMA_RECOVERY_SOURCE_INVALID",
      `The pinned migration source was not a valid file for ${migration.name}.`,
      503,
    );
  }

  const sql = Buffer.from(payload.content.replace(/\s+/g, ""), "base64").toString("utf8");
  if (!sql.trim()) {
    throw new AppError(
      "SCHEMA_RECOVERY_SOURCE_EMPTY",
      `The pinned migration source was empty for ${migration.name}.`,
      503,
    );
  }

  return {
    ...migration,
    sql,
    checksum: createHash("sha256").update(sql, "utf8").digest("hex"),
  };
}

async function fetchAllMigrationSources(): Promise<MigrationSource[]> {
  return Promise.all(RECOVERY_MIGRATIONS.map(fetchMigrationSource));
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

export async function POST() {
  let pool: Pool | undefined;
  let client: PoolClient | undefined;
  let transactionOpen = false;

  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);

    const sources = await fetchAllMigrationSources();

    pool = new Pool({ connectionString: databaseUrl(), max: 1, connectionTimeoutMillis: 5_000 });
    client = await pool.connect();

    await client.query("BEGIN");
    transactionOpen = true;
    await client.query(`LOCK TABLE "_prisma_migrations" IN EXCLUSIVE MODE`);

    // Gate 1 — this route must never run against anything but the intended
    // database/schema, no matter which connection string it was handed.
    const [identity] = (
      await client.query<{ current_database: string; current_schema: string }>(
        `SELECT current_database()::text AS current_database, current_schema()::text AS current_schema`,
      )
    ).rows;
    if (identity?.current_database !== EXPECTED_DATABASE_NAME || identity?.current_schema !== EXPECTED_SCHEMA_NAME) {
      throw new AppError(
        "SCHEMA_RECOVERY_WRONG_DATABASE",
        `This recovery route only runs against database "${EXPECTED_DATABASE_NAME}" schema "${EXPECTED_SCHEMA_NAME}" — connected to database "${identity?.current_database ?? "unknown"}" schema "${identity?.current_schema ?? "unknown"}" instead. No recovery changes were made.`,
        409,
      );
    }

    // Gate 2 — ANY unfinished, rolled-back, or zero-step migration row,
    // target or not, means the migration history is not in a state this
    // route can safely reason about. A row can have finished_at set and
    // rolled_back_at null while still applied_steps_count <= 0 — that is
    // not "clean" either, so it must trip this gate too. Stop rather than
    // run six more migrations on top of an already-ambiguous history.
    const globallyAmbiguous = await client.query<{ migration_name: string }>(
      `SELECT migration_name::text AS migration_name
       FROM "_prisma_migrations"
       WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL OR applied_steps_count <= 0
       ORDER BY started_at ASC
       LIMIT 1`,
    );
    if (globallyAmbiguous.rows.length > 0) {
      throw new AppError(
        "SCHEMA_RECOVERY_GLOBAL_MIGRATION_STATE_AMBIGUOUS",
        `"_prisma_migrations" contains an unfinished, rolled-back, or zero-step row (e.g. ${globallyAmbiguous.rows[0]!.migration_name}) unrelated to this recovery's own six migrations. No recovery changes were made.`,
        409,
      );
    }

    // Gate 3 — the refund workflow migration was applied separately and
    // must stay exactly as it is: never (re)executed, never modified, and
    // never allowed to silently drift while this route is trusting the
    // rest of the migration history.
    const refundRowsBefore = await migrationRows(client, REFUND_MIGRATION_NAME);
    if (refundRowsBefore.length !== 1 || !isCleanlyApplied(refundRowsBefore[0]!)) {
      throw new AppError(
        "SCHEMA_RECOVERY_REFUND_MIGRATION_STATE_INVALID",
        `${REFUND_MIGRATION_NAME} must already be recorded as exactly one clean, completed migration row before recovery can proceed (found ${refundRowsBefore.length} row(s)). No recovery changes were made.`,
        409,
      );
    }

    // Gate 4 (capture) — every one of these six migrations is additive
    // (new tables/columns only); none of them should ever change existing
    // row counts on core customer-data tables. Captured now, re-checked
    // for exact equality right before COMMIT below.
    const coreCountsBefore = await coreDataCounts(client);

    const log: string[] = [];

    for (const migration of sources) {
      const rows = await migrationRows(client, migration.name);
      const objectState = await inspectExpectedObjects(client, migration);
      const presentObjects = Object.entries(objectState)
        .filter(([, present]) => present)
        .map(([name]) => name);
      const missingObjects = Object.entries(objectState)
        .filter(([, present]) => !present)
        .map(([name]) => name);

      if (rows.length > 0) {
        const checksumMismatch = rows.find((row) => row.checksum !== migration.checksum);
        if (checksumMismatch) {
          throw new AppError(
            "SCHEMA_RECOVERY_CHECKSUM_MISMATCH",
            `${migration.name} is recorded with a checksum that differs from the pinned migration source.`,
            409,
          );
        }

        if (!rows.some(isCleanlyApplied)) {
          throw new AppError(
            "SCHEMA_RECOVERY_MIGRATION_STATE_AMBIGUOUS",
            `${migration.name} has an unfinished or rolled-back migration record. No recovery changes were committed.`,
            409,
          );
        }

        if (missingObjects.length > 0) {
          throw new AppError(
            "SCHEMA_RECOVERY_RECORDED_BUT_OBJECTS_MISSING",
            `${migration.name} is recorded as applied but required schema objects are missing. No recovery changes were committed.`,
            409,
          );
        }

        log.push(`${migration.name}: already cleanly applied; skipped.`);
        continue;
      }

      if (presentObjects.length > 0) {
        throw new AppError(
          "SCHEMA_RECOVERY_UNRECORDED_OBJECTS_PRESENT",
          `${migration.name} is not recorded, but one or more of its expected schema objects already exist. No recovery changes were committed.`,
          409,
        );
      }

      await client.query(migration.sql);

      const afterState = await inspectExpectedObjects(client, migration);
      const stillMissing = Object.entries(afterState)
        .filter(([, present]) => !present)
        .map(([name]) => name);
      if (stillMissing.length > 0) {
        throw new AppError(
          "SCHEMA_RECOVERY_OBJECT_VERIFICATION_FAILED",
          `${migration.name} executed but its required schema objects were not all created. No recovery changes were committed.`,
          500,
        );
      }

      await client.query(
        `INSERT INTO "_prisma_migrations" (
           id, checksum, migration_name, started_at, finished_at, applied_steps_count
         ) VALUES ($1, $2, $3, now(), now(), 1)`,
        [randomUUID(), migration.checksum, migration.name],
      );

      log.push(`${migration.name}: applied from pinned commit and recorded.`);
    }

    // Gate 4 (verify) — re-read the same core tables and require exact
    // equality. Any drift, in either direction, rolls back everything this
    // recovery did, not just the migration that happened to run last.
    const coreCountsAfter = await coreDataCounts(client);
    const driftedTables = CORE_DATA_TABLES.filter((table) => coreCountsBefore[table] !== coreCountsAfter[table]);
    if (driftedTables.length > 0) {
      throw new AppError(
        "SCHEMA_RECOVERY_CORE_COUNT_DRIFT",
        `Core table row count(s) changed during recovery: ${driftedTables.join(", ")}. The entire recovery was rolled back.`,
        500,
      );
    }

    // Gate 5 — the refund migration must still be exactly the one clean row
    // it was before this recovery touched anything.
    const refundRowsAfter = await migrationRows(client, REFUND_MIGRATION_NAME);
    if (refundRowsAfter.length !== 1 || !isCleanlyApplied(refundRowsAfter[0]!)) {
      throw new AppError(
        "SCHEMA_RECOVERY_REFUND_MIGRATION_STATE_INVALID",
        `${REFUND_MIGRATION_NAME} no longer verifies as exactly one clean, completed migration row after recovery. The entire recovery was rolled back.`,
        500,
      );
    }

    const finalState = await inspectRecoveryState(client);
    const incomplete = finalState.filter(
      (migration) =>
        !migration.cleanlyApplied ||
        Object.values(migration.objects).some((present) => !present),
    );
    if (incomplete.length > 0) {
      throw new AppError(
        "SCHEMA_RECOVERY_FINAL_VERIFICATION_FAILED",
        "Final schema verification did not confirm every recovery migration. No recovery changes were committed.",
        500,
      );
    }

    // total = 43 alone does not prove all 43 rows are clean — a row can
    // have finished_at set and rolled_back_at null while applied_steps_count
    // <= 0, which is neither "unfinished" under the definition above nor a
    // genuinely completed migration. clean must independently equal 43.
    const finalTotals = (
      await client.query<{ total: string; clean: string; unfinished: string }>(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL AND applied_steps_count > 0)::text AS clean,
           COUNT(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::text AS unfinished
         FROM "_prisma_migrations"`,
      )
    ).rows[0];
    const migrationsAppliedAfter = Number(finalTotals?.total ?? "0");
    const cleanAfter = Number(finalTotals?.clean ?? "0");
    const unfinishedAfter = Number(finalTotals?.unfinished ?? "0");
    if (unfinishedAfter !== 0) {
      throw new AppError(
        "SCHEMA_RECOVERY_FINAL_UNFINISHED_MIGRATIONS",
        `Expected 0 unfinished/rolled-back migrations after recovery, found ${unfinishedAfter}. The entire recovery was rolled back.`,
        500,
      );
    }
    if (migrationsAppliedAfter !== EXPECTED_TOTAL_CLEAN_MIGRATIONS || cleanAfter !== EXPECTED_TOTAL_CLEAN_MIGRATIONS) {
      throw new AppError(
        "SCHEMA_RECOVERY_FINAL_MIGRATION_COUNT_MISMATCH",
        `Expected exactly ${EXPECTED_TOTAL_CLEAN_MIGRATIONS} total and ${EXPECTED_TOTAL_CLEAN_MIGRATIONS} clean migration rows after recovery, found total=${migrationsAppliedAfter} clean=${cleanAfter}. The entire recovery was rolled back.`,
        500,
      );
    }

    await client.query("COMMIT");
    transactionOpen = false;

    return apiSuccess({
      recovered: true,
      pinnedCommit: PINNED_COMMIT,
      databaseName: identity.current_database,
      schemaName: identity.current_schema,
      coreCountsBefore,
      coreCountsAfter,
      migrationsAppliedAfter,
      cleanAfter,
      unfinishedAfter,
      log,
      migrations: finalState,
    });
  } catch (error) {
    if (transactionOpen && client) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error(
          "[schema-recovery] rollback failed",
          rollbackError instanceof Error ? rollbackError.message : rollbackError,
        );
      });
      transactionOpen = false;
    }
    return safeErrorResponse(error);
  } finally {
    client?.release();
    if (pool) await pool.end().catch(() => undefined);
  }
}
