import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DATABASE_STORAGE_CAPACITY_ERROR_CODE,
  isDatabaseStorageCapacityError,
} from "../src/lib/db/database-capacity-error";
import { handleApiError } from "../src/lib/http/api-response";

const PRODUCTION_53100_MESSAGE = `
Invalid \`prisma.masterItem.create()\` invocation:

Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "53100", message: "could not extend file because project size limit (512 MB) has been exceeded", severity: "ERROR", detail: None, column: None, hint: Some("This limit is defined externally by the project size limit, and internally by neon.max_cluster_size GUC") }), transient: false })`;

function productionCapacityError(): Prisma.PrismaClientUnknownRequestError {
  return new Prisma.PrismaClientUnknownRequestError(PRODUCTION_53100_MESSAGE, {
    clientVersion: "6.19.3",
  });
}

describe("database storage-capacity error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recognizes the exact Prisma/PostgreSQL 53100 failure from production", () => {
    expect(isDatabaseStorageCapacityError(productionCapacityError())).toBe(true);
  });

  it("recognizes a direct pg SQLSTATE 53100 error without relying on provider wording", () => {
    expect(isDatabaseStorageCapacityError({ code: "53100", message: "disk_full" })).toBe(true);
  });

  it("does not classify unrelated application errors by capacity wording alone", () => {
    expect(isDatabaseStorageCapacityError(new Error("project size limit has been exceeded"))).toBe(false);
    expect(isDatabaseStorageCapacityError(new Error("53100"))).toBe(false);
  });

  it("returns a controlled 507 response instead of the unexplained production 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = handleApiError(productionCapacityError());
    const body = (await response.json()) as {
      error: { code: string; message: string };
      ok: boolean;
    };

    expect(response.status).toBe(507);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: DATABASE_STORAGE_CAPACITY_ERROR_CODE,
      },
    });
    expect(body.error.message).toMatch(/increase database capacity/i);
    expect(JSON.stringify(body)).not.toMatch(/512 MB|neon|max_cluster_size|masterItem/i);
  });
});
