import { UserRole } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import {
  buildGoogleDriveAuthorizationUrl,
  exchangeGoogleDriveAuthorizationCode,
  getGoogleDriveCallbackUri,
  getGoogleDriveConfigurationStatus,
  GOOGLE_DRIVE_READONLY_SCOPE,
} from "../src/lib/integrations/connectors/google-drive-client";
import {
  createGoogleDriveOAuthState,
  verifyGoogleDriveOAuthState,
} from "../src/lib/services/google-drive-integration-service";

const actor: CurrentActor = {
  userId: "22222222-2222-4222-8222-222222222222",
  companyId: "11111111-1111-4111-8111-111111111111",
  role: UserRole.COMPANY_OWNER,
  fullName: "OAuth Test",
  email: "oauth@example.com",
};

function setConfiguredEnvironment() {
  vi.stubEnv("GOOGLE_DRIVE_CLIENT_ID", "client-id-for-test");
  vi.stubEnv("GOOGLE_DRIVE_CLIENT_SECRET", "client-secret-for-test");
  vi.stubEnv("APP_BASE_URL", "https://quantara.example");
  vi.stubEnv("VERCEL_ENV", "production");
}

describe("Google Drive native OAuth runtime", () => {
  beforeEach(() => {
    setConfiguredEnvironment();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    "GOOGLE_DRIVE_CLIENT_ID",
    "GOOGLE_DRIVE_CLIENT_SECRET",
    "APP_BASE_URL",
  ] as const)("reports %s as missing without returning configuration values", (missingName) => {
    vi.stubEnv(missingName, "");
    const status = getGoogleDriveConfigurationStatus();

    expect(status.configured).toBe(false);
    expect(status.missingConfiguration).toContain(missingName);
    expect(JSON.stringify(status)).not.toContain("client-secret-for-test");
    expect(JSON.stringify(status)).not.toContain("client-id-for-test");
  });

  it("uses one canonical callback for authorization and token exchange with read-only consent", async () => {
    const state = "cryptographically-random-state";
    const authorizationUrl = new URL(buildGoogleDriveAuthorizationUrl(state));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      access_token: "provider-access-token",
      refresh_token: "provider-refresh-token",
      expires_in: 3600,
      scope: GOOGLE_DRIVE_READONLY_SCOPE,
      token_type: "Bearer",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await exchangeGoogleDriveAuthorizationCode("one-time-authorization-code");

    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.searchParams.get("response_type")).toBe("code");
    expect(authorizationUrl.searchParams.get("access_type")).toBe("offline");
    expect(authorizationUrl.searchParams.get("prompt")).toBe("consent");
    expect(authorizationUrl.searchParams.get("scope")).toBe(GOOGLE_DRIVE_READONLY_SCOPE);
    expect(authorizationUrl.searchParams.get("state")).toBe(state);
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(getGoogleDriveCallbackUri());

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(requestBody.get("redirect_uri")).toBe(getGoogleDriveCallbackUri());
    expect(requestBody.get("grant_type")).toBe("authorization_code");
  });

  it("binds the short-lived OAuth state cookie to the actor and fails closed", () => {
    const state = createGoogleDriveOAuthState(actor);
    expect(() => verifyGoogleDriveOAuthState(actor, state.state, state.cookieValue)).not.toThrow();

    expect(() => verifyGoogleDriveOAuthState(actor, "wrong-state", state.cookieValue)).toThrowError(
      expect.objectContaining({ code: "GOOGLE_DRIVE_OAUTH_STATE_MISMATCH" }),
    );
    expect(() => verifyGoogleDriveOAuthState(actor, null, state.cookieValue)).toThrowError(
      expect.objectContaining({ code: "GOOGLE_DRIVE_OAUTH_STATE_MISMATCH" }),
    );
    expect(() => verifyGoogleDriveOAuthState(
      { ...actor, companyId: "33333333-3333-4333-8333-333333333333" },
      state.state,
      state.cookieValue,
    )).toThrowError(expect.objectContaining({ code: "GOOGLE_DRIVE_OAUTH_STATE_MISMATCH" }));
  });

  it("rejects invalid production origins and preview runtime configuration", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "http://localhost:3000/path");
    expect(getGoogleDriveConfigurationStatus()).toMatchObject({
      configured: false,
      redirectUri: null,
      missingConfiguration: ["APP_BASE_URL"],
    });

    vi.stubEnv("APP_BASE_URL", "https://preview-branch.vercel.app");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(getGoogleDriveConfigurationStatus().configured).toBe(false);
  });
});
