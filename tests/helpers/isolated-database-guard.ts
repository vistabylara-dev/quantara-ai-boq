/**
 * CANVA-HUMAN-JOURNEY-FINAL — reusable version of the guard already
 * duplicated across catalogue-package-integrity.test.ts,
 * catalogue-storage-capacity-recovery.test.ts, and
 * dataset-completeness.test.ts (not consolidated here — those files are
 * unrelated to this feature and are left untouched). Any destructive or
 * schema-mutating helper this workflow adds must call this first.
 *
 * Born from a real incident: an agent session ran `prisma db push` against
 * the shared local dev database and dropped two unrelated tables belonging
 * to another concurrent session's work. Multiple agents now routinely run
 * against the same Postgres instance on different worktrees/branches — a
 * cleanup or migration helper that only checks "is this local Postgres" is
 * not enough, since the SHARED dev database is also local Postgres. The
 * database name itself must clearly signal it's exclusively owned by an
 * isolated test/e2e run.
 */
export function assertIsolatedLocalTestDatabase(context = "this operation"): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is required for ${context}.`);
  }
  const parsed = new URL(databaseUrl);
  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const isIsolatedName = /(?:test|e2e|canva|workflow)/i.test(parsed.pathname);
  if (!isLocalHost || !isIsolatedName) {
    throw new Error(
      `Refusing ${context}: DATABASE_URL does not point at an isolated local test database. ` +
      `Host must be localhost/127.0.0.1 and the database name must clearly indicate isolated ` +
      `test/e2e/canva/workflow use — never run this against an ambiguous shared dev database.`,
    );
  }
}
