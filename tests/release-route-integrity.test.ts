import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  "src/app/api/admin/commerce/stripe/apply-commercial-checkout-migration/route.ts",
  "src/app/api/admin/system-health/apply-catalogue-reference-disciplines-migration/route.ts",
] as const;

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

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
    expect(packageJson.scripts?.["build:cloudflare"]).toBe(
      "opennextjs-cloudflare build && node scripts/ensure-opennext-prisma-workerd.mjs",
    );
    expect(packageJson.scripts?.deploy).toBe(
      "npm run db:migrate:deploy && npm run build:cloudflare && opennextjs-cloudflare deploy",
    );
    expect(packageJson.scripts?.deploy).not.toContain("db:seed");
  });

  it("contains no DDL or Prisma migration-history writer in an application route", () => {
    for (const file of routeFiles(join(repoRoot, "src", "app", "api"))) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|TYPE|FUNCTION|TRIGGER)\b/i);
      expect(source, file).not.toMatch(/INSERT\s+INTO\s+"_prisma_migrations"/i);
    }
  });
});
