import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("retired TAYQAN worker-brief migration HTTP executor", () => {
  const routePath = path.resolve(
    __dirname,
    "../src/app/api/admin/tayqan/apply-worker-brief-migration/route.ts",
  );

  const migrationPath = path.resolve(
    __dirname,
    "../prisma/migrations/20260814172326_tayqan_1_worker_run_brief/migration.sql",
  );

  it("keeps the historical HTTP route permanently non-mutating", () => {
    const source = readFileSync(routePath, "utf8");

    expect(source).toContain("PlatformRole.PLATFORM_OWNER");
    expect(source).toContain("TAYQAN_MIGRATION_DISABLED");

    expect(source).not.toContain("@/lib/db/prisma");
    expect(source).not.toMatch(
      /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|TYPE|FUNCTION|TRIGGER)\b/i,
    );
    expect(source).not.toMatch(/INSERT\s+INTO\s+"_prisma_migrations"/i);
  });

  it("keeps the authoritative committed migration evidence intact", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain('"assignmentObjective"');
    expect(migration).toContain('"specialInstructions"');
  });
});