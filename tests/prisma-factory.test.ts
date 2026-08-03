import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";

const repoRoot = path.resolve(__dirname, "..");

function listFilesRecursive(dir: string, extension: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("canonical Prisma client (real, unmocked — proves the direct/no-Hyperdrive path works)", () => {
  it("resolves the same underlying client across repeated property access (singleton, not re-created per call)", () => {
    // Prisma's generated delegates (e.g. `.project`) are stable properties
    // on the client instance; getting the same reference twice in a row
    // only happens if the lazy Proxy resolved and cached one real client
    // rather than constructing a new one on every access.
    expect(prisma.project).toBe(prisma.project);
    expect(prisma.company).toBe(prisma.company);
  });

  it("exposes $transaction and executes a trivial transaction (used by BOQ locking, revisions, document generation, proposals)", async () => {
    const [result] = await prisma.$transaction([prisma.$queryRaw`SELECT 1 as value`]);
    expect(result).toEqual([{ value: 1 }]);
  });

  it("repository modules only ever import the canonical src/lib/db/prisma module, never instantiate PrismaClient directly", () => {
    const srcDir = path.join(repoRoot, "src");
    const files = listFilesRecursive(srcDir, ".ts").filter(
      (file) => file !== path.join(srcDir, "lib", "db", "prisma.ts"),
    );
    const offenders = files.filter((file) => /new PrismaClient\(/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the database layer is never imported by a client component (no risk of leaking Hyperdrive/Prisma internals to the browser bundle)", () => {
    const srcDir = path.join(repoRoot, "src");
    const files = listFilesRecursive(srcDir, ".tsx");
    const clientFiles = files.filter((file) => {
      const content = readFileSync(file, "utf8");
      return content.startsWith('"use client"') || content.startsWith("'use client'");
    });
    const offenders = clientFiles.filter((file) => {
      const content = readFileSync(file, "utf8");
      return /from ["']@\/lib\/db\/prisma["']|from ["']@\/lib\/cloudflare\/env["']/.test(content);
    });
    expect(offenders).toEqual([]);
  });
});
