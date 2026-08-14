import { createHash } from "node:crypto";
import { PlatformRole } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Focused coverage for the five safety gates added on top of the existing
 * schema-recovery route: wrong-database guard, global unfinished-migration
 * guard, refund-migration-state guard, core-count-drift guard, and the
 * final 43-clean/0-unfinished verification. This never touches a real
 * database — the `pg` Pool/PoolClient and the GitHub source fetch are both
 * fully mocked so every gate can be exercised in isolation.
 */

const requirePlatformActorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/platform-authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/platform-authorization")>();
  return { ...actual, requirePlatformActor: requirePlatformActorMock };
});

const OWNER_ACTOR = {
  userId: "00000000-0000-4000-8000-000000000001",
  companyId: "00000000-0000-4000-8000-000000000002",
  platformRole: PlatformRole.PLATFORM_OWNER,
  fullName: "Owner",
  email: "owner@example.com",
};

const TARGET_MIGRATIONS = [
  "20260812114554_add_table_page_resolution",
  "20260813200000_evidence_retention",
  "20260813213000_estimate_integrity_graph",
  "20260814021631_worker_v0_review_existing_boq",
  "20260814024355_worker_v1_durable_runner",
  "20260814172326_tayqan_1_worker_run_brief",
] as const;
const REFUND_MIGRATION_NAME = "20260814105935_refund_workflow";
const CORE_TABLES = ["Company", "User", "Project", "BOQ", "MasterItem", "DocumentTemplate", "GeneratedDocument"] as const;

// One fixed dummy body per migration is enough — these tests exercise the
// gating logic, not real migration SQL, and the route computes its own
// checksum from whatever the (mocked) source fetch returns.
const DUMMY_SQL: Record<string, string> = Object.fromEntries(
  TARGET_MIGRATIONS.map((name) => [name, `-- dummy migration body for ${name}\nSELECT 1;`]),
);
const DUMMY_CHECKSUM: Record<string, string> = Object.fromEntries(
  TARGET_MIGRATIONS.map((name) => [name, createHash("sha256").update(DUMMY_SQL[name]!, "utf8").digest("hex")]),
);

type MigrationRowLike = {
  checksum: string;
  started_at: Date;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
};

function cleanRow(name: string, overrides: Partial<MigrationRowLike> = {}): MigrationRowLike {
  return {
    checksum: DUMMY_CHECKSUM[name] ?? "0".repeat(64),
    started_at: new Date("2026-08-14T00:00:00.000Z"),
    finished_at: new Date("2026-08-14T00:00:01.000Z"),
    rolled_back_at: null,
    applied_steps_count: 1,
    ...overrides,
  };
}

type ScenarioConfig = {
  database?: string;
  schema?: string;
  globalAmbiguousMigrationName?: string | null;
  refundRows?: MigrationRowLike[];
  targetRows?: Partial<Record<(typeof TARGET_MIGRATIONS)[number], MigrationRowLike[]>>;
  objectsPresent?: Set<string>;
  coreCountsBefore?: Partial<Record<(typeof CORE_TABLES)[number], number>>;
  coreCountsAfter?: Partial<Record<(typeof CORE_TABLES)[number], number>>;
  finalTotals?: { total: string; unfinished: string };
};

function buildMockClient(config: ScenarioConfig) {
  const coreCountCalls: string[] = [];
  const executedSql: string[] = [];

  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    executedSql.push(sql);

    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
    if (sql.includes("LOCK TABLE")) return { rows: [] };

    if (sql.includes("current_database()")) {
      return { rows: [{ current_database: config.database ?? "quantara_staging", current_schema: config.schema ?? "public" }] };
    }

    // Global ambiguous-migration scan: the only query with "LIMIT 1".
    if (sql.includes("LIMIT 1")) {
      return {
        rows: config.globalAmbiguousMigrationName ? [{ migration_name: config.globalAmbiguousMigrationName }] : [],
      };
    }

    // Final totals: the only query using COUNT(*) FILTER.
    if (sql.includes("COUNT(*) FILTER")) {
      return { rows: [config.finalTotals ?? { total: "43", unfinished: "0" }] };
    }

    // Per-migration-name row lookup — used for both the refund guard and
    // every target migration (before-loop skip check and final re-verify).
    if (sql.includes("WHERE migration_name = $1")) {
      const name = params?.[0] as string;
      if (name === REFUND_MIGRATION_NAME) return { rows: config.refundRows ?? [cleanRow(REFUND_MIGRATION_NAME)] };
      const rows = config.targetRows?.[name as (typeof TARGET_MIGRATIONS)[number]];
      return { rows: rows ?? [cleanRow(name)] };
    }

    // Expected-object presence: table form (to_regclass) or column form (information_schema.columns).
    if (sql.includes("to_regclass")) {
      const tableRef = params?.[0] as string; // e.g. public."TablePageResolution"
      const tableName = tableRef.replace(/^public\."/, "").replace(/"$/, "");
      return { rows: [{ present: config.objectsPresent?.has(tableName) ?? true }] };
    }
    if (sql.includes("information_schema.columns")) {
      const [table, column] = params as [string, string];
      return { rows: [{ present: config.objectsPresent?.has(`${table}.${column}`) ?? true }] };
    }

    // Core data row counts — table name is inlined, not parameterized.
    const coreCountMatch = sql.match(/FROM "(\w+)"$/);
    if (coreCountMatch && sql.includes("COUNT(*)::text AS count")) {
      const table = coreCountMatch[1] as (typeof CORE_TABLES)[number];
      coreCountCalls.push(table);
      const pass = Math.floor((coreCountCalls.length - 1) / CORE_TABLES.length); // 0 = before, 1 = after
      const source = pass === 0 ? config.coreCountsBefore : config.coreCountsAfter ?? config.coreCountsBefore;
      return { rows: [{ count: String(source?.[table] ?? 10) }] };
    }

    if (sql.includes("INSERT INTO")) return { rows: [] };
    if (sql.trim().startsWith("SELECT 1")) return { rows: [{ "?column?": 1 }] };

    throw new Error(`Unmocked query in test: ${sql}`);
  });

  return { query, release: vi.fn(), executedSql };
}

let currentClient: ReturnType<typeof buildMockClient> | undefined;

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: vi.fn(async () => currentClient),
    end: vi.fn(async () => undefined),
  })),
}));

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const match = url.match(/migrations\/([^/]+)\/migration\.sql/);
      const name = match?.[1] ?? "";
      const sql = DUMMY_SQL[name] ?? "SELECT 1;";
      return new Response(
        JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from(sql, "utf8").toString("base64") }),
        { status: 200 },
      );
    }),
  );
}

async function callPost(config: ScenarioConfig) {
  currentClient = buildMockClient(config);
  requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
  stubFetch();
  vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/quantara_staging");
  const { POST } = await import("../src/app/api/admin/system-health/schema-recovery/route");
  const response = await POST();
  return { response, body: await response.json(), client: currentClient };
}

describe("POST /api/admin/system-health/schema-recovery — safety gates", () => {
  beforeEach(() => {
    requirePlatformActorMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
    currentClient = undefined;
  });

  it("blocks with 409 before any migration SQL when connected to the wrong database", async () => {
    const { response, body, client } = await callPost({ database: "some_other_db" });

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ ok: false, error: { code: "SCHEMA_RECOVERY_WRONG_DATABASE" } });
    expect(client.executedSql.some((sql) => sql.includes("ALTER TABLE") || sql.includes("INSERT INTO"))).toBe(false);
    expect(client.executedSql).toContain("ROLLBACK");
  });

  it("blocks with 409 when an unrelated migration is unfinished or rolled back", async () => {
    const { response, body, client } = await callPost({
      globalAmbiguousMigrationName: "20260101000000_some_unrelated_migration",
    });

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ ok: false, error: { code: "SCHEMA_RECOVERY_GLOBAL_MIGRATION_STATE_AMBIGUOUS" } });
    expect(client.executedSql.some((sql) => sql.includes("ALTER TABLE") || sql.includes("INSERT INTO"))).toBe(false);
  });

  it("blocks with 409 when the refund migration is missing, duplicated, or unclean", async () => {
    const missing = await callPost({ refundRows: [] });
    expect(missing.response.status).toBe(409);
    expect(missing.body).toMatchObject({ ok: false, error: { code: "SCHEMA_RECOVERY_REFUND_MIGRATION_STATE_INVALID" } });

    const duplicated = await callPost({ refundRows: [cleanRow(REFUND_MIGRATION_NAME), cleanRow(REFUND_MIGRATION_NAME)] });
    expect(duplicated.response.status).toBe(409);
    expect(duplicated.body).toMatchObject({ ok: false, error: { code: "SCHEMA_RECOVERY_REFUND_MIGRATION_STATE_INVALID" } });

    const unclean = await callPost({ refundRows: [cleanRow(REFUND_MIGRATION_NAME, { finished_at: null, applied_steps_count: 0 })] });
    expect(unclean.response.status).toBe(409);
    expect(unclean.body).toMatchObject({ ok: false, error: { code: "SCHEMA_RECOVERY_REFUND_MIGRATION_STATE_INVALID" } });

    for (const outcome of [missing, duplicated, unclean]) {
      expect(outcome.client.executedSql.some((sql) => sql.includes("ALTER TABLE") || sql.includes("INSERT INTO"))).toBe(false);
    }
  });

  it("rolls back the entire recovery when a core data table's row count drifts", async () => {
    const targetRows = Object.fromEntries(TARGET_MIGRATIONS.map((name) => [name, [cleanRow(name)]]));
    const objectsPresent = new Set([
      "TablePageResolution",
      "ProjectFileArchive", "TechnicalReportRetention",
      "BOQItemQuantityProvenance", "BOQItemRateProvenance", "BOQRevisionItemEvidence",
      "WorkerAssignment", "WorkerReviewWorkspace", "WorkerDecision", "WorkerMaterialQuestion", "WorkerEvent",
      "WorkerRun", "WorkerRunEvent", "WorkerAIPlan",
      "WorkerRun.assignmentObjective", "WorkerRun.specialInstructions",
    ]);

    const { response, body, client } = await callPost({
      targetRows,
      objectsPresent,
      coreCountsBefore: { Company: 5, User: 12, Project: 8, BOQ: 20, MasterItem: 100, DocumentTemplate: 3, GeneratedDocument: 40 },
      coreCountsAfter: { Company: 5, User: 13, Project: 8, BOQ: 20, MasterItem: 100, DocumentTemplate: 3, GeneratedDocument: 40 }, // User drifted
    });

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ ok: false, error: { code: "SCHEMA_RECOVERY_CORE_COUNT_DRIFT" } });
    expect(client.executedSql).toContain("ROLLBACK");
    expect(client.executedSql).not.toContain("COMMIT");
  });

  it("succeeds only when the final state is exactly 43 clean migrations and 0 unfinished", async () => {
    const targetRows = Object.fromEntries(TARGET_MIGRATIONS.map((name) => [name, [cleanRow(name)]]));
    const objectsPresent = new Set([
      "TablePageResolution",
      "ProjectFileArchive", "TechnicalReportRetention",
      "BOQItemQuantityProvenance", "BOQItemRateProvenance", "BOQRevisionItemEvidence",
      "WorkerAssignment", "WorkerReviewWorkspace", "WorkerDecision", "WorkerMaterialQuestion", "WorkerEvent",
      "WorkerRun", "WorkerRunEvent", "WorkerAIPlan",
      "WorkerRun.assignmentObjective", "WorkerRun.specialInstructions",
    ]);
    const stableCounts = { Company: 5, User: 12, Project: 8, BOQ: 20, MasterItem: 100, DocumentTemplate: 3, GeneratedDocument: 40 };

    const success = await callPost({
      targetRows,
      objectsPresent,
      coreCountsBefore: stableCounts,
      coreCountsAfter: stableCounts,
      finalTotals: { total: "43", unfinished: "0" },
    });
    expect(success.response.status).toBe(200);
    expect(success.body).toMatchObject({ ok: true, data: { recovered: true, migrationsAppliedAfter: 43, unfinishedAfter: 0 } });
    expect(success.client.executedSql).toContain("COMMIT");

    const wrongCount = await callPost({
      targetRows,
      objectsPresent,
      coreCountsBefore: stableCounts,
      coreCountsAfter: stableCounts,
      finalTotals: { total: "42", unfinished: "0" },
    });
    expect(wrongCount.response.status).toBe(500);
    expect(wrongCount.body).toMatchObject({ ok: false, error: { code: "SCHEMA_RECOVERY_FINAL_MIGRATION_COUNT_MISMATCH" } });

    const unfinishedRemains = await callPost({
      targetRows,
      objectsPresent,
      coreCountsBefore: stableCounts,
      coreCountsAfter: stableCounts,
      finalTotals: { total: "43", unfinished: "1" },
    });
    expect(unfinishedRemains.response.status).toBe(500);
    expect(unfinishedRemains.body).toMatchObject({ ok: false, error: { code: "SCHEMA_RECOVERY_FINAL_UNFINISHED_MIGRATIONS" } });
  });
});
