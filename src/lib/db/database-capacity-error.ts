import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";

export const DATABASE_STORAGE_CAPACITY_ERROR_CODE = "DATABASE_STORAGE_CAPACITY_EXCEEDED";
export const DATABASE_STORAGE_CAPACITY_ERROR_MESSAGE =
  "The database has reached its storage capacity. Increase database capacity before retrying the request.";

const POSTGRES_DISK_FULL_SQLSTATE = "53100";
const POSTGRES_DISK_FULL_IN_PRISMA_MESSAGE = /(?:PostgresError\s*\{[\s\S]*?code:\s*["']53100["']|SQLSTATE\s*[:=]?\s*["']?53100\b)/i;

/**
 * Prisma's driver-adapter path currently wraps PostgreSQL SQLSTATE 53100
 * (disk_full) in PrismaClientUnknownRequestError and leaves the SQLSTATE only
 * in the error message. Direct `pg` errors expose the same value as `code`.
 * Match only those two database shapes so unrelated application errors are
 * never reclassified by message text alone.
 */
export function isDatabaseStorageCapacityError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 2) return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
    cause?: unknown;
    meta?: { database_error?: unknown };
  };

  if (candidate.code === POSTGRES_DISK_FULL_SQLSTATE) return true;

  const isPrismaUnknownRequestError =
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    candidate.name === "PrismaClientUnknownRequestError";
  if (
    isPrismaUnknownRequestError &&
    typeof candidate.message === "string" &&
    POSTGRES_DISK_FULL_IN_PRISMA_MESSAGE.test(candidate.message)
  ) {
    return true;
  }

  if (candidate.meta?.database_error && isDatabaseStorageCapacityError(candidate.meta.database_error, depth + 1)) {
    return true;
  }
  return candidate.cause ? isDatabaseStorageCapacityError(candidate.cause, depth + 1) : false;
}

export function databaseStorageCapacityError(): AppError {
  return new AppError(
    DATABASE_STORAGE_CAPACITY_ERROR_CODE,
    DATABASE_STORAGE_CAPACITY_ERROR_MESSAGE,
    507,
  );
}
