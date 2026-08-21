import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleApiError } from "../src/lib/http/api-response";

async function json(res: Response): Promise<any> {
  return res.json();
}

function knownRequestError(code: string, message: string) {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "6.19.3" });
}

describe("handleApiError — Prisma error safety", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("P2021 (missing table) never leaks the table name to the client", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = knownRequestError(
      "P2021",
      "The table `public.CommerceProduct` does not exist in the current database.",
    );
    const res = handleApiError(error);
    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(body.error.message).not.toMatch(/CommerceProduct/i);
    expect(body.error.message).not.toMatch(/table/i);
    expect(JSON.stringify(body)).not.toContain("public.CommerceProduct");
  });

  it("P2010 (raw query failure) never leaks SQL/column details to the client", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = knownRequestError(
      "P2010",
      "Raw query failed. Code: `N/A`. Message: `Failed to deserialize column of type 'name'.`",
    );
    const res = handleApiError(error);
    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(body.error.message).not.toMatch(/deserialize|column|Raw query/i);
  });

  it("an arbitrary unknown Prisma error code falls back to the same safe response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = knownRequestError("P9999", "Some future Prisma error mentioning internal.table.name and a secret path");
    const res = handleApiError(error);
    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(body.error.message).not.toMatch(/internal\.table\.name|secret/i);
  });

  it("never leaks a database URL or connection string even if present in the Prisma message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = knownRequestError(
      "P1001",
      "Can't reach database server at `postgres://user:pass@internal-host:5432/db`",
    );
    const res = handleApiError(error);
    const body = await json(res);
    expect(JSON.stringify(body)).not.toMatch(/postgres:\/\//);
    expect(JSON.stringify(body)).not.toMatch(/user:pass/);
  });

  it("logs the full unsanitized detail server-side for diagnosability", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = knownRequestError("P2021", "The table `public.CommerceProduct` does not exist in the current database.");
    handleApiError(error);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("P2021"),
      expect.stringContaining("CommerceProduct"),
    );
  });

  it("still maps P2002 to a safe, specific 409 conflict (regression check on existing behavior)", async () => {
    const error = knownRequestError("P2002", "Unique constraint failed on the fields: (`code`)");
    const res = handleApiError(error);
    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("UNIQUE_CONSTRAINT");
    expect(body.error.message).not.toMatch(/code`\)/);
  });

  it("still maps P2025 to a safe 404 not-found (regression check on existing behavior)", async () => {
    const error = knownRequestError("P2025", "An operation failed because it depends on one or more records that were required but not found.");
    const res = handleApiError(error);
    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("still maps P2003 to a safe 409 relation-constraint response (regression check on existing behavior)", async () => {
    const error = knownRequestError("P2003", "Foreign key constraint failed on the field: `productId`");
    const res = handleApiError(error);
    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("RELATION_CONSTRAINT");
    expect(body.error.message).not.toMatch(/productId/);
  });

  it("a genuine domain error (non-Prisma, with its own code/message/status) still passes through unaffected", async () => {
    const domainError = { code: "CUSTOM_DOMAIN_ERROR", message: "A safe, app-authored message.", status: 422 };
    const res = handleApiError(domainError);
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(body.error.code).toBe("CUSTOM_DOMAIN_ERROR");
    expect(body.error.message).toBe("A safe, app-authored message.");
  });
});
