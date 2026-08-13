import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const removedHttpWriters = [
  "src/app/api/admin/commerce/seed/route.ts",
  "src/app/api/admin/commerce/apply-migration/route.ts",
  "src/app/api/admin/commerce/stripe/apply-migration/route.ts",
  "src/app/api/admin/system-health/bootstrap-industries/route.ts",
  "src/app/api/admin/system-health/apply-proposal-source-type-migration/route.ts",
  "src/app/api/admin/system-health/apply-pending-migrations/route.ts",
  "src/app/api/admin/system-health/apply-sales-inquiry-migration/route.ts",
  "src/app/api/admin/system-health/apply-core-flow-1-migration/route.ts",
] as const;

describe("release route integrity", () => {
  it("does not expose legacy schema or seed writers over ordinary HTTP", () => {
    for (const relativePath of removedHttpWriters) {
      expect(existsSync(join(repoRoot, relativePath)), relativePath).toBe(false);
    }
  });

  it("keeps controlled migration and seed commands available", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["db:migrate:deploy"]).toBe("prisma migrate deploy");
    expect(packageJson.scripts?.["db:seed"]).toBe("prisma db seed");
  });
});
