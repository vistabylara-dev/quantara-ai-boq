$ErrorActionPreference = "Stop"

$root = "$env:USERPROFILE\Desktop\quantara-ai-boq.permanent-full"
$wt   = "$env:USERPROFILE\Desktop\quantara-ai-boq.schema-recovery-live"
$branch = "emergency/schema-recovery-live-20260815"
$expectedMain = "2ec627a8881499b03ac275fe3de466e0c308f98b"

if (-not (Test-Path $root)) {
    throw "STOP: permanent-full repo not found at $root"
}

Write-Host "`n=== VERIFY CURRENT PRODUCTION SOURCE ===" -ForegroundColor Cyan
git -C $root fetch origin

$originMain = (git -C $root rev-parse origin/main).Trim()
Write-Host "origin/main: $originMain"

if ($originMain -ne $expectedMain) {
    throw "STOP: origin/main changed. Expected $expectedMain but found $originMain. Do not continue."
}

if (Test-Path $wt) {
    throw "STOP: recovery worktree already exists: $wt"
}

if (git -C $root branch --list $branch) {
    throw "STOP: local recovery branch already exists: $branch"
}

Write-Host "`n=== CREATE ISOLATED RECOVERY WORKTREE ===" -ForegroundColor Cyan
git -C $root worktree add -b $branch $wt origin/main

$routeDir = Join-Path $wt "src\app\api\admin\system-health\schema-recovery"
New-Item -ItemType Directory -Force -Path $routeDir | Out-Null
$routePath = Join-Path $routeDir "route.ts"

$route = @'
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

    await client.query("COMMIT");
    transactionOpen = false;

    return apiSuccess({
      recovered: true,
      pinnedCommit: PINNED_COMMIT,
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
'@

Set-Content -LiteralPath $routePath -Value $route -Encoding UTF8

Write-Host "`n=== VERIFY ONLY THE RECOVERY ROUTE CHANGED ===" -ForegroundColor Cyan
$changed = git -C $wt status --short
$changed

$unexpected = $changed | Where-Object {
    $_ -notmatch 'src/app/api/admin/system-health/schema-recovery/route\.ts$'
}

if ($unexpected) {
    throw "STOP: unexpected files changed in recovery worktree."
}

git -C $wt diff --check
if ($LASTEXITCODE -ne 0) {
    throw "STOP: git diff --check failed."
}

git -C $wt add -- "src/app/api/admin/system-health/schema-recovery/route.ts"
git -C $wt commit -m "fix: add owner-only transactional schema recovery"

if ($LASTEXITCODE -ne 0) {
    throw "STOP: recovery commit failed."
}

Write-Host "`n=== PUSH SAFETY BRANCH ===" -ForegroundColor Cyan
git -C $wt push -u origin $branch
if ($LASTEXITCODE -ne 0) {
    throw "STOP: safety-branch push failed."
}

Write-Host "`n=== RE-CHECK MAIN BEFORE FAST-FORWARD ===" -ForegroundColor Cyan
git -C $wt fetch origin
$mainBeforePush = (git -C $wt rev-parse origin/main).Trim()
Write-Host "origin/main before recovery-route push: $mainBeforePush"

if ($mainBeforePush -ne $expectedMain) {
    throw "STOP: origin/main changed after the recovery branch was prepared. Do not push main."
}

Write-Host "`n=== FAST-FORWARD MAIN WITH ONE ADDITIVE ROUTE ===" -ForegroundColor Yellow
git -C $wt push origin HEAD:main
if ($LASTEXITCODE -ne 0) {
    throw "STOP: main push failed. No force push was used."
}

git -C $wt fetch origin
$newMain = (git -C $wt rev-parse origin/main).Trim()
$localHead = (git -C $wt rev-parse HEAD).Trim()

if ($newMain -ne $localHead) {
    throw "STOP: remote main does not match the verified recovery-route commit."
}

Write-Host "PASS: main now contains the recovery route at $newMain" -ForegroundColor Green

Write-Host "`n=== LINK RECOVERY WORKTREE TO VERCEL ===" -ForegroundColor Cyan
cd $wt
vercel link --yes --project quantara-ai-boq --scope vista-by-laras-projects
if ($LASTEXITCODE -ne 0) {
    throw "STOP: Vercel link failed."
}

Write-Host "`n=== DEPLOY CURRENT MAIN + RECOVERY ENDPOINT ONLY ===" -ForegroundColor Yellow
vercel deploy --prod --yes --scope vista-by-laras-projects
if ($LASTEXITCODE -ne 0) {
    throw "STOP: Vercel production deployment failed."
}

Write-Host "`n=== OPEN READ-ONLY RECOVERY PREFLIGHT ===" -ForegroundColor Green
Start-Process "https://quantara.vistabylara.com/api/admin/system-health/schema-recovery"

Write-Host "`nSTAGE 1 COMPLETE." -ForegroundColor Green
Write-Host "Database has NOT been modified by this script." -ForegroundColor Green
Write-Host "Paste the JSON from the opened schema-recovery page before any POST is made." -ForegroundColor Yellow
