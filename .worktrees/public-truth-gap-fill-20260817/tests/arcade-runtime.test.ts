import { afterEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { AppError, NotFoundError } from "../src/lib/errors/app-error";
import { ArcadeBackedConnector } from "../src/lib/integrations/arcade/arcade-backed-connector";
import {
  ARCADE_PROVIDER_CONFIGURATIONS,
  findArcadeProviderConfiguration,
  validateArcadeProviderConfigurations,
} from "../src/lib/integrations/arcade/arcade-provider-config";
import {
  ArcadeRuntime,
  deriveArcadeUserId,
  getArcadeConfigurationStatus,
} from "../src/lib/integrations/arcade/arcade-runtime";
import type {
  ArcadeClient,
  ArcadeProviderConfiguration,
} from "../src/lib/integrations/arcade/arcade-types";
import { getProviderById } from "../src/lib/integrations/provider-registry";

const actor: CurrentActor = {
  userId: "11111111-1111-4111-8111-111111111111",
  companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  role: "COMPANY_OWNER" as CurrentActor["role"],
  fullName: "Arcade Test Owner",
  email: "owner@example.com",
};

const FILE_TOOL = "Dropbox.ListItemsInFolder";
const TEST_ARCADE_API_KEY = "arcade-test-hmac-secret";
const TEST_ENVIRONMENT = Object.freeze({
  ARCADE_API_KEY: TEST_ARCADE_API_KEY,
  NODE_ENV: "test",
});

const fixtureConfiguration: ArcadeProviderConfiguration = {
  providerId: "dropbox",
  runtime: "arcade",
  authorizationOrigins: ["https://auth.arcade.dev"],
  authorizationTools: [FILE_TOOL],
  capabilities: {
    LIST_FILES: {
      authorizationTool: FILE_TOOL,
      executionTool: FILE_TOOL,
      toolVersion: "1.1.2",
      normalizeInput(value) {
        if (!value || typeof value !== "object" || typeof (value as { folderId?: unknown }).folderId !== "string") {
          throw new Error("folderId required");
        }
        return { path: (value as { folderId: string }).folderId };
      },
      normalizeOutput(value) {
        if (!value || typeof value !== "object" || !Array.isArray((value as { items?: unknown }).items)) {
          throw new Error("items required");
        }
        return (value as { items: unknown[] }).items;
      },
    },
  },
};

afterEach(() => {
  vi.useRealTimers();
});

function clientFixture(input?: {
  authorizationResponse?: Record<string, unknown>;
  statusResponse?: Record<string, unknown>;
  executionResponse?: Record<string, unknown>;
}) {
  const authorize = vi.fn().mockResolvedValue(input?.authorizationResponse ?? {
    id: "auth_123",
    status: "pending",
    url: "https://auth.arcade.dev/authorize?flow=auth_123",
    user_id: deriveArcadeUserId(actor),
    context: { token: "provider-oauth-secret" },
  });
  const status = vi.fn().mockResolvedValue(input?.statusResponse ?? {
    id: "auth_123",
    status: "completed",
    user_id: deriveArcadeUserId(actor),
    context: { token: "provider-oauth-secret" },
  });
  const execute = vi.fn().mockResolvedValue(input?.executionResponse ?? {
    id: "exec_123",
    success: true,
    output: {
      value: {
        items: [{
          providerSourceId: "dropbox-file-1",
          name: "estimate.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          sourceVersion: "rev-2",
          sourceTimestamp: "2026-08-09T10:00:00.000Z",
          provider: "spoofed-provider",
          reviewStatus: "CONFIRMED",
        }],
        providerToken: "must-not-survive-normalization",
      },
      authorization: {
        id: "auth_123",
        status: "completed",
        context: { token: "provider-oauth-secret" },
      },
      logs: [{ level: "debug", message: "raw provider log" }],
    },
  });

  return {
    client: { tools: { authorize, execute }, auth: { status } } as unknown as ArcadeClient,
    authorize,
    status,
    execute,
  };
}

function expectAppError(error: unknown, code: string, status?: number) {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, ...(status ? { status } : {}) });
}

describe("Arcade runtime configuration and allowlist", () => {
  it("reports missing ARCADE_API_KEY without exposing configuration values", () => {
    const result = getArcadeConfigurationStatus({});
    expect(result).toEqual({ configured: false, runtime: "arcade", status: "NOT_CONFIGURED" });
    expect(JSON.stringify(result)).not.toMatch(/apiKey|baseUrl|secret/i);
  });

  it("rejects unsafe base URLs while allowing the documented cloud default and local development", () => {
    expect(getArcadeConfigurationStatus({ ARCADE_API_KEY: "key" })).toEqual({
      configured: true,
      runtime: "arcade",
      status: "READY",
    });
    expect(getArcadeConfigurationStatus({
      ARCADE_API_KEY: "key",
      ARCADE_BASE_URL: "http://localhost:9099",
      NODE_ENV: "test",
    }).configured).toBe(true);
    expect(getArcadeConfigurationStatus({
      ARCADE_API_KEY: "key",
      ARCADE_BASE_URL: "http://localhost:9099",
      NODE_ENV: "production",
    }).configured).toBe(false);
    expect(getArcadeConfigurationStatus({
      ARCADE_API_KEY: "key",
      ARCADE_BASE_URL: "http://arcade.example.com",
    })).toEqual({ configured: false, runtime: "arcade", status: "INVALID_CONFIGURATION" });
    expect(getArcadeConfigurationStatus({
      ARCADE_API_KEY: "key",
      ARCADE_BASE_URL: "https://user:password@arcade.example.com",
    }).configured).toBe(false);
  });

  it("derives a stable opaque identity separated by both tenant and user", () => {
    const first = deriveArcadeUserId(actor);
    expect(deriveArcadeUserId(actor)).toBe(first);
    expect(first).toMatch(/^qtr_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain(actor.companyId);
    expect(first).not.toContain(actor.userId);
    expect(first).not.toContain(actor.email);
    expect(deriveArcadeUserId({ ...actor, companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })).not.toBe(first);
    expect(deriveArcadeUserId({ ...actor, userId: "22222222-2222-4222-8222-222222222222" })).not.toBe(first);
  });

  it("ships an empty provider registry and preserves Google Drive as native", () => {
    expect(ARCADE_PROVIDER_CONFIGURATIONS).toEqual([]);
    expect(findArcadeProviderConfiguration("google-drive")).toBeUndefined();
    expect(getProviderById("google-drive")).toMatchObject({ status: "BETA" });
    expect(() => validateArcadeProviderConfigurations([{
      ...fixtureConfiguration,
      providerId: "google-drive",
    }])).toThrowError(expect.objectContaining({ code: "ARCADE_INVALID_CONFIGURATION" }));
  });

  it("distinguishes an unknown provider from a real provider with no Arcade implementation", async () => {
    const runtime = new ArcadeRuntime({ environment: { ARCADE_API_KEY: "key" } });
    await expect(runtime.authorize({ actor, providerId: "not-real", capability: "LIST_FILES" }))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(runtime.authorize({ actor, providerId: "dropbox", capability: "LIST_FILES" }))
      .rejects.toMatchObject({ code: "ARCADE_PROVIDER_NOT_SUPPORTED", status: 501 });
  });

  it("rejects a capability not mapped by the provider before making any Arcade call", async () => {
    const fixture = clientFixture();
    const runtime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [fixtureConfiguration],
      environment: TEST_ENVIRONMENT,
    });

    await expect(runtime.authorize({ actor, providerId: "dropbox", capability: "ARBITRARY_TOOL" }))
      .rejects.toMatchObject({ code: "ARCADE_CAPABILITY_NOT_SUPPORTED", status: 501 });
    expect(fixture.authorize).not.toHaveBeenCalled();
  });

  it("fails safely when the key is absent even for an otherwise allowlisted provider", async () => {
    const runtime = new ArcadeRuntime({ configurations: [fixtureConfiguration], environment: {} });
    await expect(runtime.authorize({ actor, providerId: "dropbox", capability: "LIST_FILES" }))
      .rejects.toMatchObject({ code: "ARCADE_NOT_CONFIGURED", status: 503 });
  });
});

describe("Arcade authorization and execution sanitization", () => {
  it("authorizes only the mapped tool and strips token-bearing SDK response fields", async () => {
    const fixture = clientFixture();
    const runtime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [fixtureConfiguration],
      environment: TEST_ENVIRONMENT,
    });

    const result = await runtime.authorize({ actor, providerId: "dropbox", capability: "LIST_FILES" });

    expect(fixture.authorize).toHaveBeenCalledWith({
      tool_name: FILE_TOOL,
      tool_version: "1.1.2",
      user_id: deriveArcadeUserId(actor),
    });
    expect(result).toMatchObject({
      authorizationId: "auth_123",
      status: "pending",
      authorizationUrl: "https://auth.arcade.dev/authorize?flow=auth_123",
    });
    expect(result.authorizationTransactionToken)
      .toMatch(/^[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{43}$/);
    const [payloadSegment] = result.authorizationTransactionToken.split(".");
    const transactionClaims = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
    expect(transactionClaims).toMatchObject({
      v: 1,
      iat: expect.any(Number),
      exp: expect.any(Number),
      nonce: expect.any(String),
    });
    expect(JSON.stringify(transactionClaims)).not.toContain(actor.companyId);
    expect(JSON.stringify(transactionClaims)).not.toContain(actor.userId);
    expect(JSON.stringify(result)).not.toContain(TEST_ARCADE_API_KEY);
    expect(JSON.stringify(result)).not.toMatch(/provider-oauth-secret|context|user_id|scope|access_token|refresh_token|id_token/i);
  });

  it("checks a flow through auth.status and rejects a mismatched or absent Arcade user identity", async () => {
    const fixture = clientFixture();
    const runtime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [fixtureConfiguration],
      environment: TEST_ENVIRONMENT,
    });

    const started = await runtime.authorize({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
    });
    const authorizationTransactionToken = started.authorizationTransactionToken;

    await expect(runtime.checkAuthorization({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
      authorizationId: "auth_123",
      authorizationTransactionToken,
    })).resolves.toEqual({ authorizationId: "auth_123", status: "completed", authorizationUrl: null });
    expect(fixture.status).toHaveBeenCalledWith(
      { id: "auth_123", wait: 0 },
      { maxRetries: 1, timeout: 10_000 },
    );

    fixture.status.mockResolvedValueOnce({
      id: "auth_123",
      status: "completed",
      user_id: "qtr_somebody_else",
    });
    await expect(runtime.checkAuthorization({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
      authorizationId: "auth_123",
      authorizationTransactionToken,
    })).rejects.toMatchObject({ code: "ARCADE_AUTHORIZATION_IDENTITY_MISMATCH", status: 403 });

    fixture.status.mockResolvedValueOnce({ id: "auth_123", status: "completed" });
    await expect(runtime.checkAuthorization({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
      authorizationId: "auth_123",
      authorizationTransactionToken,
    })).rejects.toMatchObject({ code: "ARCADE_AUTHORIZATION_IDENTITY_MISMATCH", status: 403 });
  });

  it("accepts only allowlisted HTTPS authorization origins without credential-bearing URLs", async () => {
    const safeFixture = clientFixture({
      authorizationResponse: {
        id: "auth_123",
        status: "pending",
        user_id: deriveArcadeUserId(actor),
        url: "https://auth.arcade.dev/authorize?flow=auth_123&state=opaque&code_challenge=public",
      },
    });
    const safeRuntime = new ArcadeRuntime({
      client: safeFixture.client,
      configurations: [fixtureConfiguration],
      environment: TEST_ENVIRONMENT,
    });
    await expect(safeRuntime.authorize({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
    })).resolves.toMatchObject({
      authorizationUrl: "https://auth.arcade.dev/authorize?flow=auth_123&state=opaque&code_challenge=public",
    });

    const rejectedUrls = [
      "https://auth.arcade.dev/authorize#access_token=secret",
      "https://auth.arcade.dev/authorize?access_token=secret",
      "https://auth.arcade.dev/authorize?refresh-token=secret",
      "https://auth.arcade.dev/authorize?ID_TOKEN=secret",
      "https://auth.arcade.dev/authorize?authorization_code=secret",
      "https://auth.arcade.dev/authorize?code=secret",
      "https://auth.arcade.dev/authorize?client_secret=secret",
      "https://auth.arcade.dev.evil.example/authorize?flow=auth_123",
    ];

    for (const url of rejectedUrls) {
      const fixture = clientFixture({
        authorizationResponse: {
          id: "auth_123",
          status: "pending",
          user_id: deriveArcadeUserId(actor),
          url,
        },
      });
      const runtime = new ArcadeRuntime({
        client: fixture.client,
        configurations: [fixtureConfiguration],
        environment: TEST_ENVIRONMENT,
      });
      await expect(runtime.authorize({
        actor,
        providerId: "dropbox",
        capability: "LIST_FILES",
      })).rejects.toMatchObject({ code: "ARCADE_INVALID_RESPONSE", status: 502 });
    }
  });

  it("permits explicitly allowlisted HTTP loopback authorization only outside production", async () => {
    const localConfiguration: ArcadeProviderConfiguration = {
      ...fixtureConfiguration,
      authorizationOrigins: ["http://localhost:9099"],
    };
    const fixture = clientFixture({
      authorizationResponse: {
        id: "auth_local",
        status: "pending",
        user_id: deriveArcadeUserId(actor),
        url: "http://localhost:9099/authorize?flow=auth_local",
      },
    });
    const developmentRuntime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [localConfiguration],
      environment: TEST_ENVIRONMENT,
    });

    await expect(developmentRuntime.authorize({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
    })).resolves.toMatchObject({
      authorizationId: "auth_local",
      authorizationUrl: "http://localhost:9099/authorize?flow=auth_local",
    });

    expect(() => new ArcadeRuntime({
      client: fixture.client,
      configurations: [localConfiguration],
      environment: { ARCADE_API_KEY: TEST_ARCADE_API_KEY, NODE_ENV: "production" },
    })).toThrowError(expect.objectContaining({ code: "ARCADE_INVALID_CONFIGURATION" }));
  });

  it("binds a short-lived transaction to actor, tenant, provider, capability, and authorization ID", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));

    const multiCapabilityConfiguration: ArcadeProviderConfiguration = {
      ...fixtureConfiguration,
      capabilities: {
        ...fixtureConfiguration.capabilities,
        READ_FILES: fixtureConfiguration.capabilities.LIST_FILES,
      },
    };
    const boxConfiguration: ArcadeProviderConfiguration = {
      ...multiCapabilityConfiguration,
      providerId: "box",
    };
    const fixture = clientFixture();
    const runtime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [multiCapabilityConfiguration, boxConfiguration],
      environment: TEST_ENVIRONMENT,
    });
    const started = await runtime.authorize({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
    });
    const [payloadSegment, signatureSegment] = started.authorizationTransactionToken.split(".");
    const tamperedToken = `${payloadSegment}.${signatureSegment[0] === "A" ? "B" : "A"}${signatureSegment.slice(1)}`;
    const baseCheck = {
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
      authorizationId: "auth_123",
      authorizationTransactionToken: started.authorizationTransactionToken,
    };

    const invalidChecks = [
      { ...baseCheck, actor: { ...actor, userId: "22222222-2222-4222-8222-222222222222" } },
      { ...baseCheck, actor: { ...actor, companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } },
      { ...baseCheck, providerId: "box" },
      { ...baseCheck, capability: "READ_FILES" },
      { ...baseCheck, authorizationId: "auth_other" },
      { ...baseCheck, authorizationTransactionToken: tamperedToken },
    ];

    fixture.status.mockClear();
    for (const check of invalidChecks) {
      await expect(runtime.checkAuthorization(check))
        .rejects.toMatchObject({ code: "ARCADE_AUTHORIZATION_TRANSACTION_INVALID", status: 403 });
    }
    expect(fixture.status).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
    await expect(runtime.checkAuthorization(baseCheck))
      .rejects.toMatchObject({ code: "ARCADE_AUTHORIZATION_TRANSACTION_INVALID", status: 403 });
    expect(fixture.status).not.toHaveBeenCalled();
  });

  it("executes only the mapped tool, disables stack traces and retries, and returns normalized output only", async () => {
    const fixture = clientFixture();
    const runtime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [fixtureConfiguration],
      environment: TEST_ENVIRONMENT,
    });

    const result = await runtime.execute({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
      input: { folderId: "/Dubai" },
    });

    expect(fixture.execute).toHaveBeenCalledWith({
      tool_name: FILE_TOOL,
      tool_version: "1.1.2",
      user_id: deriveArcadeUserId(actor),
      input: { path: "/Dubai" },
      include_error_stacktrace: false,
    }, { maxRetries: 0, timeout: 30_000 });
    expect(result).toEqual([expect.objectContaining({ providerSourceId: "dropbox-file-1" })]);
    expect(JSON.stringify(result)).not.toMatch(/provider-oauth-secret|must-not-survive-normalization|raw provider log/i);
  });

  it("normalizes SDK and provider failures without exposing upstream error details", async () => {
    const rawSecret = "upstream-secret-in-error";
    const fixture = clientFixture();
    fixture.authorize.mockRejectedValueOnce({ status: 401, message: rawSecret, error: { token: rawSecret } });
    const runtime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [fixtureConfiguration],
      environment: TEST_ENVIRONMENT,
    });

    try {
      await runtime.authorize({ actor, providerId: "dropbox", capability: "LIST_FILES" });
      throw new Error("expected authorize to fail");
    } catch (error) {
      expectAppError(error, "ARCADE_RUNTIME_AUTHENTICATION_FAILED", 503);
      expect(JSON.stringify(error)).not.toContain(rawSecret);
      expect((error as Error).message).not.toContain(rawSecret);
    }

    fixture.execute.mockResolvedValueOnce({
      success: false,
      output: {
        error: {
          kind: "UPSTREAM_RUNTIME_SERVER_ERROR",
          message: rawSecret,
          developer_message: rawSecret,
          stacktrace: rawSecret,
          extra: { token: rawSecret },
        },
      },
    });
    try {
      await runtime.execute({
        actor,
        providerId: "dropbox",
        capability: "LIST_FILES",
        input: { folderId: "/" },
      });
      throw new Error("expected execute to fail");
    } catch (error) {
      expectAppError(error, "ARCADE_EXECUTION_FAILED", 502);
      expect(JSON.stringify(error)).not.toContain(rawSecret);
    }
  });
});

describe("Arcade-backed IntegrationConnector normalization", () => {
  it("tenant-resolves the connection and returns pending ExternalFile provenance only", async () => {
    const fixture = clientFixture();
    const runtime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [fixtureConfiguration],
      environment: TEST_ENVIRONMENT,
    });
    const connectionResolver = vi.fn().mockResolvedValue({
      companyId: actor.companyId,
      providerId: "dropbox",
    });
    const connector = new ArcadeBackedConnector({
      actor,
      providerId: "dropbox",
      runtime,
      connectionResolver,
    });

    await expect(connector.getStatus(actor.companyId)).resolves.toBe("COMING_SOON");
    const files = await connector.listFiles("connection-1", "/Dubai");

    expect(connectionResolver).toHaveBeenCalledWith("connection-1");
    expect(files).toEqual([{
      provider: "dropbox",
      providerSourceId: "dropbox-file-1",
      sourceVersion: "rev-2",
      sourceTimestamp: "2026-08-09T10:00:00.000Z",
      synchronizationRunId: null,
      reviewStatus: "PENDING",
      name: "estimate.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
    }]);
    expect(files[0]).not.toHaveProperty("providerToken");
    expect(files[0]).not.toHaveProperty("projectFileId");
    expect(files[0]).not.toHaveProperty("boqItemId");
  });

  it("rejects a cross-company connection before executing the provider tool", async () => {
    const fixture = clientFixture();
    const runtime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [fixtureConfiguration],
      environment: TEST_ENVIRONMENT,
    });
    const connector = new ArcadeBackedConnector({
      actor,
      providerId: "dropbox",
      runtime,
      connectionResolver: vi.fn().mockResolvedValue({
        companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        providerId: "dropbox",
      }),
    });

    await expect(connector.listFiles("other-company-connection", "/"))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(fixture.execute).not.toHaveBeenCalled();
  });

  it("returns a controlled NOT_SUPPORTED error for unmapped connector methods", async () => {
    const fixture = clientFixture();
    const runtime = new ArcadeRuntime({
      client: fixture.client,
      configurations: [fixtureConfiguration],
      environment: TEST_ENVIRONMENT,
    });
    const connector = new ArcadeBackedConnector({
      actor,
      providerId: "dropbox",
      runtime,
      connectionResolver: vi.fn().mockResolvedValue({ companyId: actor.companyId, providerId: "dropbox" }),
    });

    await expect(connector.listAccounts("connection-1"))
      .rejects.toMatchObject({ code: "ARCADE_CAPABILITY_NOT_SUPPORTED", status: 501 });
    await expect(connector.disconnect("connection-1"))
      .rejects.toMatchObject({ code: "ARCADE_CAPABILITY_NOT_SUPPORTED", status: 501 });
  });
});
