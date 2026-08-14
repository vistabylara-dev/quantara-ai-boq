import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("Cloudflare Prisma runtime packaging", () => {
  it("uses the JavaScript query engine and preserves Prisma's workerd package exports", async () => {
    const schema = await readFile(path.join(projectRoot, "prisma", "schema.prisma"), "utf8");
    expect(schema).toMatch(/generator client\s*{[^}]*engineType\s*=\s*"client"/s);

    const { default: loadNextConfig } = await import("../next.config.mjs");
    const config = await loadNextConfig("phase-production-build");
    expect(config.serverExternalPackages).toEqual(
      expect.arrayContaining(["@prisma/client", ".prisma/client"]),
    );

    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
    expect(packageJson.scripts["build:cloudflare"]).toContain(
      "node scripts/ensure-opennext-prisma-workerd.mjs",
    );
    expect(packageJson.scripts.preview).toContain("npm run build:cloudflare");
    expect(packageJson.scripts.deploy).toContain("npm run build:cloudflare");
    expect(packageJson.scripts.upload).toContain("npm run build:cloudflare");

    const safeguard = await readFile(
      path.join(projectRoot, "scripts", "ensure-opennext-prisma-workerd.mjs"),
      "utf8",
    );
    expect(safeguard).toContain("bundleServer");
    expect(safeguard).toContain("wasm-worker-loader.mjs");
    expect(safeguard).toContain("query_compiler_bg.wasm");
    expect(safeguard).toContain("wasm_on_url");
    expect(safeguard).toContain("llhttp_alloc");
  });
});
