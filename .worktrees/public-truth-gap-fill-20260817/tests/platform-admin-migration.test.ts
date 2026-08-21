import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";

const migrationPath = path.resolve(
  __dirname,
  "../prisma/migrations/20260803190000_add_platform_roles_and_admin_access/migration.sql",
);

describe("platform administration migration", () => {
  it("is one additive migration that does not alter the company role enum", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain('CREATE TYPE "PlatformRole"');
    expect(sql).toContain('ALTER TABLE "User" ADD COLUMN "platformRole"');
    expect(sql).toContain('CREATE TABLE "PlatformAuditLog"');
    expect(sql).not.toContain('ALTER TYPE "UserRole"');
    expect(sql).not.toMatch(/DROP\s+(TABLE|TYPE|COLUMN)/i);
  });

  it("is applied to PostgreSQL with a nullable role and the expected enum values", async () => {
    const columns = await prisma.$queryRaw<Array<{ is_nullable: string; udt_name: string }>>`
      SELECT "is_nullable"::text, "udt_name"::text
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'User'
        AND column_name = 'platformRole'
    `;
    const roles = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel::text
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'PlatformRole'
      ORDER BY enumsortorder
    `;
    const auditTable = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name::text
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'PlatformAuditLog'
    `;

    expect(columns).toEqual([{ is_nullable: "YES", udt_name: "PlatformRole" }]);
    expect(roles.map(({ enumlabel }) => enumlabel)).toEqual([
      "PLATFORM_OWNER",
      "PLATFORM_ADMIN",
      "PLATFORM_SUPPORT",
    ]);
    expect(auditTable).toEqual([{ table_name: "PlatformAuditLog" }]);
  });
});
