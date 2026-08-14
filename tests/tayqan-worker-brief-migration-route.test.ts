import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PlatformRole } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * This endpoint is hardcoded to exactly one migration and must never touch
 * the shared local dev Postgres's real schema/migration history — every
 * database interaction here is a controlled mock so each required state
 * (first application, idempotent re-application, checksum mismatch, an
 * ambiguous partial-column state, an unfinished prior attempt) can be
 * exercised precisely and independently of whatever this dev database's
 * actual migration state happens to be.
 */

const requirePlatformActorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/platform-authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/platform-authorization")>();
  return { ...actual, requirePlatformActor: requirePlatformActorMock };
});

import { PlatformAuthorizationError } from "../src/lib/auth/platform-authorization";

const txMock = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}));
const transactionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: (...args: unknown[]) => transactionMock(...args) },
}));

const MIGRATION_NAME = "20260814172326_tayqan_1_worker_run_brief";
const CHECKSUM = "8fef0ce992d26ccf53e3792cf2972bd0004ce5d525096b1fa9b251e693a1bee3";

const OWNER_ACTOR = {
  userId: "00000000-0000-4000-8000-000000000001",
  companyId: "00000000-0000-4000-8000-000000000002",
  platformRole: PlatformRole.PLATFORM_OWNER,
  fullName: "Owner",
  email: "owner@example.com",
};

const BOTH_COLUMNS_PRESENT = [
  { column_name: "assignmentObjective", data_type: "text", is_nullable: "YES" },
  { column_name: "specialInstructions", data_type: "text", is_nullable: "YES" },
];

function cleanMigrationRow(overrides: Partial<{
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
}> = {}) {
  return {
    checksum: CHECKSUM,
    started_at: new Date("2026-08-14T17:24:06.000Z"),
    finished_at: new Date("2026-08-14T17:24:06.020Z"),
    rolled_back_at: null,
    applied_steps_count: 1,
    ...overrides,
  };
}

async function callRoute() {
  const { POST } = await import("../src/app/api/admin/tayqan/apply-worker-brief-migration/route");
  return POST();
}

describe("POST /api/admin/tayqan/apply-worker-brief-migration", () => {
  beforeEach(() => {
    requirePlatformActorMock.mockReset();
    transactionMock.mockReset();
    txMock.$executeRawUnsafe.mockReset();
    txMock.$queryRaw.mockReset();
    txMock.$executeRaw.mockReset();
    transactionMock.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
  });
  afterEach(() => {
    vi.resetModules();
  });

  it("denies a non-owner (or unauthenticated) caller without touching the database", async () => {
    requirePlatformActorMock.mockRejectedValue(
      new PlatformAuthorizationError(
        "This account does not have platform access.",
        "PLATFORM_ROLE_NOT_ALLOWED",
      ),
    );

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ ok: false, error: { code: "PERMISSION_DENIED" } });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("requires PLATFORM_OWNER specifically, not any lesser platform role", async () => {
    requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
    txMock.$queryRaw
      .mockResolvedValueOnce([]) // existingMigrations: none
      .mockResolvedValueOnce([]) // pre-check columns: both absent
      .mockResolvedValueOnce(BOTH_COLUMNS_PRESENT); // verify after ALTER
    txMock.$executeRawUnsafe.mockResolvedValue(undefined);
    txMock.$executeRaw.mockResolvedValue(undefined);

    await callRoute();

    expect(requirePlatformActorMock).toHaveBeenCalledWith([PlatformRole.PLATFORM_OWNER]);
  });

  it("first application: no existing migration row, both columns absent — runs the ALTER and records the migration", async () => {
    requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
    txMock.$queryRaw
      .mockResolvedValueOnce([]) // existingMigrations: none
      .mockResolvedValueOnce([]) // pre-check: both columns absent
      .mockResolvedValueOnce(BOTH_COLUMNS_PRESENT); // verify: both present after ALTER
    txMock.$executeRawUnsafe.mockResolvedValue(undefined);
    txMock.$executeRaw.mockResolvedValue(undefined);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, data: { alreadyApplied: false } });
    expect(txMock.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("LOCK TABLE"));
    expect(txMock.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE"));
    expect(txMock.$executeRaw).toHaveBeenCalledTimes(1); // exactly one INSERT into _prisma_migrations
  });

  it("second application is idempotent: a cleanly-applied row with verified columns makes no database changes", async () => {
    requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
    txMock.$queryRaw
      .mockResolvedValueOnce([cleanMigrationRow()]) // existingMigrations: cleanly applied
      .mockResolvedValueOnce(BOTH_COLUMNS_PRESENT); // verify columns still present
    txMock.$executeRawUnsafe.mockResolvedValue(undefined);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, data: { alreadyApplied: true } });
    // Only the LOCK statement — no ALTER TABLE, no INSERT.
    expect(txMock.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(txMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("blocks with 409 when an existing migration row has a different checksum", async () => {
    requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
    txMock.$queryRaw.mockResolvedValueOnce([cleanMigrationRow({ checksum: "0000000000000000000000000000000000000000000000000000000000000000" })]);
    txMock.$executeRawUnsafe.mockResolvedValue(undefined);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ ok: false, error: { code: "TAYQAN_MIGRATION_CHECKSUM_MISMATCH" } });
    expect(txMock.$executeRawUnsafe).not.toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE"));
    expect(txMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("blocks with 409 as ambiguous when a partial-column state exists with no migration record", async () => {
    requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
    txMock.$queryRaw
      .mockResolvedValueOnce([]) // existingMigrations: none
      .mockResolvedValueOnce([{ column_name: "assignmentObjective", data_type: "text", is_nullable: "YES" }]); // pre-check: ONE column already exists
    txMock.$executeRawUnsafe.mockResolvedValue(undefined);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ ok: false, error: { code: "TAYQAN_MIGRATION_STATE_AMBIGUOUS" } });
    expect(txMock.$executeRawUnsafe).not.toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE"));
    expect(txMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("blocks with 409 as ambiguous when an existing migration row is unfinished/rolled back", async () => {
    requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
    txMock.$queryRaw.mockResolvedValueOnce([cleanMigrationRow({ finished_at: null, applied_steps_count: 0 })]);
    txMock.$executeRawUnsafe.mockResolvedValue(undefined);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ ok: false, error: { code: "TAYQAN_MIGRATION_STATE_AMBIGUOUS" } });
    expect(txMock.$executeRawUnsafe).not.toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE"));
    expect(txMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("blocks with 500 if the post-ALTER verification does not find both columns as nullable TEXT", async () => {
    requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
    txMock.$queryRaw
      .mockResolvedValueOnce([]) // existingMigrations: none
      .mockResolvedValueOnce([]) // pre-check: both absent
      .mockResolvedValueOnce([{ column_name: "assignmentObjective", data_type: "text", is_nullable: "YES" }]); // verify: only one present
    txMock.$executeRawUnsafe.mockResolvedValue(undefined);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ ok: false, error: { code: "TAYQAN_MIGRATION_VERIFICATION_FAILED" } });
    expect(txMock.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("apply-worker-brief-migration route source, hardcoding, and checksum", () => {
  const routeSourcePath = path.resolve(
    __dirname,
    "../src/app/api/admin/tayqan/apply-worker-brief-migration/route.ts",
  );
  const source = readFileSync(routeSourcePath, "utf8");

  it("contains no DROP, DELETE, or TRUNCATE SQL anywhere in the route", () => {
    expect(source).not.toMatch(/\bDROP\b/i);
    expect(source).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(source).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("is hardcoded to exactly this one migration name and does not accept a request body", () => {
    expect(source).toContain(`"${MIGRATION_NAME}"`);
    expect(source).not.toMatch(/export async function POST\(\s*request/);
    expect(source).not.toContain("request.json()");
    expect(source).not.toContain("await request");
  });

  it("the hardcoded checksum matches the migration file's LF-normalized SHA-256 — what a fresh Linux CI/production checkout produces, not a CRLF-converted Windows working-tree copy", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../prisma/migrations/20260814172326_tayqan_1_worker_run_brief/migration.sql",
    );
    const raw = readFileSync(migrationPath, "utf8");
    const normalized = raw.replace(/\r\n/g, "\n");
    const checksum = createHash("sha256").update(normalized, "utf8").digest("hex");

    expect(checksum).toBe(CHECKSUM);
    expect(source).toContain(CHECKSUM);
  });
});
