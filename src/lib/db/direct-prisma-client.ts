import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { normalizePostgresSslMode } from "./postgres-connection-string";

/**
 * Creates an explicit Node/Postgres Prisma client for one-off scripts, seeds,
 * and browser-test setup. The generated client uses `engineType = "client"`,
 * so a driver adapter is mandatory even outside Cloudflare Workers.
 */
export function createDirectPrismaClient(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a direct Prisma client.");
  }

  const pool = new Pool({ connectionString: normalizePostgresSslMode(connectionString) });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}
