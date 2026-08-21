import { afterEach, describe, expect, it, vi } from "vitest";

const drainWorkerRunsMock = vi.fn();

vi.mock("../src/lib/services/worker-runner-service", () => ({
  drainWorkerRuns: (...args: unknown[]) => drainWorkerRunsMock(...args),
}));

function request(secret?: string) {
  return new Request("http://localhost/api/internal/worker/drain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ limit: 2, runnerId: "route-test-runner" }),
  });
}

describe("POST /api/internal/worker/drain", () => {
  afterEach(() => {
    drainWorkerRunsMock.mockReset();
    vi.unstubAllEnvs();
  });

  it("rejects a missing bearer secret without invoking the runner", async () => {
    vi.stubEnv("WORKER_RUNNER_SECRET", "route-test-private-secret");
    const { POST } = await import("../src/app/api/internal/worker/drain/route");

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(drainWorkerRunsMock).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("rejects an incorrect bearer secret without invoking the runner", async () => {
    vi.stubEnv("WORKER_RUNNER_SECRET", "route-test-private-secret");
    const { POST } = await import("../src/app/api/internal/worker/drain/route");

    const response = await POST(request("wrong-secret"));

    expect(response.status).toBe(401);
    expect(drainWorkerRunsMock).not.toHaveBeenCalled();
  });

  it("drains only after constant-length digest authentication succeeds", async () => {
    vi.stubEnv("WORKER_RUNNER_SECRET", "route-test-private-secret");
    drainWorkerRunsMock.mockResolvedValue({
      runnerId: "route-test-runner",
      claimedCount: 0,
      processed: [],
    });
    const { POST } = await import("../src/app/api/internal/worker/drain/route");

    const response = await POST(request("route-test-private-secret"));

    expect(response.status).toBe(200);
    expect(drainWorkerRunsMock).toHaveBeenCalledWith({
      runnerId: "route-test-runner",
      limit: 2,
    });
    expect(JSON.stringify(await response.json())).not.toContain("route-test-private-secret");
  });
});
