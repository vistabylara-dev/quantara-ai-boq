import { afterEach, describe, expect, it, vi } from "vitest";

type ApiErrorBody = { ok: false; error: { code: string; message: string } };

/**
 * `/api/health` and `/api/ready` are tested here against a mocked
 * `src/lib/db/prisma` and `src/lib/cloudflare/env` so that the route's
 * *reporting* logic (status codes, response shape, connection-method
 * labeling) can be verified for both the direct and Hyperdrive paths
 * without needing a real Hyperdrive resource — only the driver-adapter
 * plumbing itself (tested against real Postgres) lives in
 * tests/prisma-adapter-pg.test.ts.
 */

const queryRawMock = vi.fn();
const getPrismaConnectionMethodMock = vi.fn();
const isCloudflareRuntimeMock = vi.fn();

vi.mock("../src/lib/db/prisma", () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRawMock(...args) },
  getPrismaConnectionMethod: () => getPrismaConnectionMethodMock(),
}));

vi.mock("../src/lib/cloudflare/env", () => ({
  isCloudflareRuntime: () => isCloudflareRuntimeMock(),
}));

describe("GET /api/health", () => {
  afterEach(() => {
    queryRawMock.mockReset();
    vi.unstubAllEnvs();
    getPrismaConnectionMethodMock.mockReset();
    isCloudflareRuntimeMock.mockReset();
  });

  it("reports connected, direct mode, on a plain Node runtime", async () => {
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);
    getPrismaConnectionMethodMock.mockReturnValue("direct");
    isCloudflareRuntimeMock.mockReturnValue(false);

    const { GET } = await import("../src/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      data: { status: "ok", database: "connected", runtime: "node", connectionMethod: "direct" },
    });
  });

  it("reports connected, hyperdrive mode, when running as a Cloudflare Worker with Hyperdrive resolved", async () => {
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);
    getPrismaConnectionMethodMock.mockReturnValue("hyperdrive");
    isCloudflareRuntimeMock.mockReturnValue(true);

    const { GET } = await import("../src/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      data: { status: "ok", database: "connected", runtime: "cloudflare-worker", connectionMethod: "hyperdrive" },
    });
  });

  it("reports database unavailable with a 503 and no leaked connection details when the query fails", async () => {
    queryRawMock.mockRejectedValue(new Error("connection refused at postgres://user:pass@internal-host:5432/db"));
    getPrismaConnectionMethodMock.mockReturnValue("direct");
    isCloudflareRuntimeMock.mockReturnValue(false);

    const { GET } = await import("../src/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(503);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("postgres://");
    expect(raw).not.toContain("internal-host");
  });
});

describe("GET /api/ready", () => {
  function stubValidProductionConfiguration() {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROPOSAL_ACCESS_SECRET", "production-proposal-secret-with-more-than-thirty-two-bytes");
    vi.stubEnv("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY", Buffer.alloc(32, 4).toString("base64"));
    vi.stubEnv("WORKER_RUNNER_SECRET", "production-worker-secret-with-more-than-thirty-two-bytes");
    vi.stubEnv("WORKER_AI_PLANNER_ENABLED", "false");
    vi.stubEnv("STORAGE_PROVIDER", "vercel-blob");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-blob-token");
  }

  afterEach(() => {
    queryRawMock.mockReset();
    vi.unstubAllEnvs();
  });

  it("returns 200 when the readiness query succeeds", async () => {
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);

    const { GET } = await import("../src/app/api/ready/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, data: { status: "ready" } });
  });

  it("returns 503 with a structured, safe error when the readiness query fails", async () => {
    queryRawMock.mockRejectedValue(new Error("timeout"));

    const { GET } = await import("../src/app/api/ready/route");
    const response = await GET();

    expect(response.status).toBe(503);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
  });

  it("fails readiness closed in production when a required security secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROPOSAL_ACCESS_SECRET", "");
    vi.stubEnv("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY", Buffer.alloc(32, 4).toString("base64"));
    vi.stubEnv("WORKER_RUNNER_SECRET", "production-worker-secret-with-more-than-thirty-two-bytes");
    vi.stubEnv("WORKER_AI_PLANNER_ENABLED", "false");

    const { GET } = await import("../src/app/api/ready/route");
    const response = await GET();

    expect(response.status).toBe(503);
    expect(queryRawMock).not.toHaveBeenCalled();
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("SECURITY_CONFIGURATION_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("PROPOSAL_ACCESS_SECRET");
  });

  it("accepts valid production security configuration before checking the database", async () => {
    stubValidProductionConfiguration();
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);

    const { GET } = await import("../src/app/api/ready/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("fails readiness closed when production project storage is missing", async () => {
    stubValidProductionConfiguration();
    vi.stubEnv("STORAGE_PROVIDER", "");

    const { GET } = await import("../src/app/api/ready/route");
    const response = await GET();

    expect(response.status).toBe(503);
    expect(queryRawMock).not.toHaveBeenCalled();
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("STORAGE_CONFIGURATION_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("STORAGE_PROVIDER");
  });

  it("fails readiness closed when the production Blob credential is missing", async () => {
    stubValidProductionConfiguration();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    const { GET } = await import("../src/app/api/ready/route");
    const response = await GET();

    expect(response.status).toBe(503);
    expect(queryRawMock).not.toHaveBeenCalled();
    expect((await response.json() as ApiErrorBody).error.code).toBe("STORAGE_CONFIGURATION_UNAVAILABLE");
  });

  it("fails readiness closed in production when the worker runner secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROPOSAL_ACCESS_SECRET", "production-proposal-secret-with-more-than-thirty-two-bytes");
    vi.stubEnv("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY", Buffer.alloc(32, 4).toString("base64"));
    vi.stubEnv("WORKER_RUNNER_SECRET", "");
    vi.stubEnv("WORKER_AI_PLANNER_ENABLED", "false");

    const { GET } = await import("../src/app/api/ready/route");
    const response = await GET();

    expect(response.status).toBe(503);
    expect(queryRawMock).not.toHaveBeenCalled();
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("SECURITY_CONFIGURATION_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("WORKER_RUNNER_SECRET");
  });

  it("fails readiness closed when the bounded AI planner lacks its model", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROPOSAL_ACCESS_SECRET", "production-proposal-secret-with-more-than-thirty-two-bytes");
    vi.stubEnv("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY", Buffer.alloc(32, 4).toString("base64"));
    vi.stubEnv("WORKER_RUNNER_SECRET", "production-worker-secret-with-more-than-thirty-two-bytes");
    vi.stubEnv("WORKER_AI_PLANNER_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "server-side-test-key");
    vi.stubEnv("WORKER_AI_MODEL", "");

    const { GET } = await import("../src/app/api/ready/route");
    const response = await GET();

    expect(response.status).toBe(503);
    expect(queryRawMock).not.toHaveBeenCalled();
    expect((await response.json() as ApiErrorBody).error.code).toBe("SECURITY_CONFIGURATION_UNAVAILABLE");
  });
});
