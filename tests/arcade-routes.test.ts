import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, PermissionDeniedError, UnauthorizedError } from "../src/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  getCurrentActor: vi.fn(),
  setActorContext: vi.fn(),
  requireCapability: vi.fn(),
  getConfigurationStatus: vi.fn(),
  authorize: vi.fn(),
  checkAuthorization: vi.fn(),
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: mocks.getCurrentActor,
}));

vi.mock("@/lib/auth/request-context", () => ({
  setActorContext: mocks.setActorContext,
}));

vi.mock("@/lib/auth/rbac", () => ({
  requireCapability: mocks.requireCapability,
}));

vi.mock("@/lib/integrations/arcade/arcade-runtime", () => ({
  getArcadeRuntime: () => ({
    getConfigurationStatus: mocks.getConfigurationStatus,
    authorize: mocks.authorize,
    checkAuthorization: mocks.checkAuthorization,
  }),
}));

import { GET as getArcadeStatus } from "../src/app/api/integrations/arcade/status/route";
import { POST as authorizeArcadeProvider } from "../src/app/api/integrations/[providerId]/arcade/authorize/route";

const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  role: "COMPANY_OWNER",
  fullName: "Route Test Owner",
  email: "owner@example.com",
};

const AUTHORIZATION_TRANSACTION_TOKEN = `eyJ2IjoxfQ.${"A".repeat(43)}`;

function authorizationRequest(body: unknown) {
  return new Request("http://localhost/api/integrations/dropbox/arcade/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({ providerId: "dropbox" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentActor.mockResolvedValue(actor);
  mocks.getConfigurationStatus.mockReturnValue({
    configured: true,
    runtime: "arcade",
    status: "READY",
  });
  mocks.authorize.mockResolvedValue({
    authorizationId: "auth_123",
    status: "pending",
    authorizationUrl: "https://auth.arcade.dev/authorize?flow=auth_123",
    authorizationTransactionToken: AUTHORIZATION_TRANSACTION_TOKEN,
  });
  mocks.checkAuthorization.mockResolvedValue({
    authorizationId: "auth_123",
    status: "completed",
    authorizationUrl: null,
  });
});

describe("GET /api/integrations/arcade/status", () => {
  it("is authenticated and returns only sanitized runtime configuration state", async () => {
    const response = await getArcadeStatus();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getCurrentActor).toHaveBeenCalledOnce();
    expect(mocks.setActorContext).toHaveBeenCalledWith(actor);
    expect(body).toEqual({
      ok: true,
      data: { configured: true, runtime: "arcade", status: "READY" },
    });
    expect(JSON.stringify(body)).not.toMatch(/apiKey|baseUrl|secret|token/i);
  });

  it("returns the controlled authentication error for a signed-out request", async () => {
    mocks.getCurrentActor.mockRejectedValueOnce(new UnauthorizedError());
    const response = await getArcadeStatus();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(mocks.getConfigurationStatus).not.toHaveBeenCalled();
  });
});

describe("POST /api/integrations/[providerId]/arcade/authorize", () => {
  it("requires integrations:connect and starts authorization by Quantara capability only", async () => {
    const response = await authorizeArcadeProvider(
      authorizationRequest({ capability: "LIST_FILES" }),
      routeContext,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requireCapability).toHaveBeenCalledWith(actor, "integrations:connect");
    expect(mocks.authorize).toHaveBeenCalledWith({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
    });
    expect(mocks.checkAuthorization).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: true,
      data: {
        providerId: "dropbox",
        runtime: "arcade",
        capability: "LIST_FILES",
        authorizationId: "auth_123",
        status: "pending",
        authorizationUrl: "https://auth.arcade.dev/authorize?flow=auth_123",
        authorizationTransactionToken: AUTHORIZATION_TRANSACTION_TOKEN,
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/tool_name|user_id|context|scope|access_token|refresh_token|id_token/i);
  });

  it("polls only the same provider-scoped allowlisted capability", async () => {
    const response = await authorizeArcadeProvider(
      authorizationRequest({ capability: "LIST_FILES", authorizationId: "auth_123" }),
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(mocks.checkAuthorization).not.toHaveBeenCalled();
  });

  it("polls only with the actor-bound authorization transaction token", async () => {
    const response = await authorizeArcadeProvider(
      authorizationRequest({
        capability: "LIST_FILES",
        authorizationId: "auth_123",
        authorizationTransactionToken: AUTHORIZATION_TRANSACTION_TOKEN,
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(mocks.checkAuthorization).toHaveBeenCalledWith({
      actor,
      providerId: "dropbox",
      capability: "LIST_FILES",
      authorizationId: "auth_123",
      authorizationTransactionToken: AUTHORIZATION_TRANSACTION_TOKEN,
    });
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it("rejects browser-supplied Arcade tool names and unknown fields before runtime execution", async () => {
    const response = await authorizeArcadeProvider(
      authorizationRequest({
        capability: "LIST_FILES",
        toolName: "Dropbox.DownloadFile",
      }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.checkAuthorization).not.toHaveBeenCalled();
  });

  it("does not accept a tool-shaped string as a Quantara capability", async () => {
    const response = await authorizeArcadeProvider(
      authorizationRequest({ capability: "Dropbox.DownloadFile" }),
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it("returns controlled permission and unsupported-provider errors", async () => {
    mocks.requireCapability.mockImplementationOnce(() => {
      throw new PermissionDeniedError();
    });
    const denied = await authorizeArcadeProvider(
      authorizationRequest({ capability: "LIST_FILES" }),
      routeContext,
    );
    expect(denied.status).toBe(403);
    expect(mocks.authorize).not.toHaveBeenCalled();

    mocks.authorize.mockRejectedValueOnce(new AppError(
      "ARCADE_PROVIDER_NOT_SUPPORTED",
      "This integration provider is not available through the Arcade runtime.",
      501,
    ));
    const unsupported = await authorizeArcadeProvider(
      authorizationRequest({ capability: "LIST_FILES" }),
      routeContext,
    );
    expect(unsupported.status).toBe(501);
    await expect(unsupported.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "ARCADE_PROVIDER_NOT_SUPPORTED" },
    });
  });
});
