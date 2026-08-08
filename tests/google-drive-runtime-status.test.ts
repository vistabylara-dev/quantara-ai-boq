import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { AppError } from "../src/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  getConnectionForProvider: vi.fn(),
  getDecryptedCredentialsForConnection: vi.fn(),
  recordConnectionError: vi.fn(),
  getConfigurationStatus: vi.fn(),
  verifyAccess: vi.fn(),
}));

vi.mock("@/lib/repositories/integration-repository", () => ({
  getConnectionForProvider: mocks.getConnectionForProvider,
  getDecryptedCredentialsForConnection: mocks.getDecryptedCredentialsForConnection,
  recordConnectionError: mocks.recordConnectionError,
}));

vi.mock("@/lib/integrations/connectors/google-drive-client", () => ({
  getGoogleDriveConfigurationStatus: mocks.getConfigurationStatus,
  verifyGoogleDriveAccess: mocks.verifyAccess,
}));

import { getGoogleDriveRuntimeStatus } from "../src/lib/services/google-drive-integration-service";

const actor: CurrentActor = {
  userId: "22222222-2222-4222-8222-222222222222",
  companyId: "11111111-1111-4111-8111-111111111111",
  role: UserRole.COMPANY_OWNER,
  fullName: "Runtime Status Test",
  email: "runtime-status@example.com",
};

const callbackUri = "https://quantara.example/api/integrations/google-drive/callback";

describe("Google Drive live connection status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConfigurationStatus.mockReturnValue({
      configured: true,
      redirectUri: callbackUri,
      missingConfiguration: [],
    });
    mocks.getConnectionForProvider.mockResolvedValue({ id: "connection-1", status: "CONNECTED" });
    mocks.getDecryptedCredentialsForConnection.mockResolvedValue({
      accessToken: "server-only-access-token",
      refreshToken: "server-only-refresh-token",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      scope: "https://www.googleapis.com/auth/drive.readonly",
      tokenType: "Bearer",
    });
    mocks.verifyAccess.mockResolvedValue(undefined);
    mocks.recordConnectionError.mockResolvedValue(undefined);
  });

  it("does not query stored credentials when administrator configuration is missing", async () => {
    mocks.getConfigurationStatus.mockReturnValue({
      configured: false,
      redirectUri: null,
      missingConfiguration: ["GOOGLE_DRIVE_CLIENT_SECRET"],
    });

    await expect(getGoogleDriveRuntimeStatus(actor)).resolves.toEqual({
      configured: false,
      redirectUri: null,
      missingConfiguration: ["GOOGLE_DRIVE_CLIENT_SECRET"],
      connectionStatus: "NOT_CONFIGURED",
    });
    expect(mocks.getConnectionForProvider).not.toHaveBeenCalled();
  });

  it("requires a live Drive request before reporting CONNECTED and returns no credentials", async () => {
    const status = await getGoogleDriveRuntimeStatus(actor);

    expect(mocks.getConnectionForProvider).toHaveBeenCalledWith(actor.companyId, "google-drive");
    expect(mocks.getDecryptedCredentialsForConnection).toHaveBeenCalledWith(actor.companyId, "connection-1");
    expect(mocks.verifyAccess).toHaveBeenCalledWith("server-only-access-token");
    expect(status).toEqual({
      configured: true,
      redirectUri: callbackUri,
      missingConfiguration: [],
      connectionStatus: "CONNECTED",
    });
    expect(JSON.stringify(status)).not.toMatch(/access-token|refresh-token/i);
  });

  it("marks a revoked live grant for reauthorization instead of trusting the row", async () => {
    mocks.verifyAccess.mockRejectedValue(new AppError(
      "GOOGLE_DRIVE_REAUTH_REQUIRED",
      "Google Drive authorization expired.",
      401,
    ));

    await expect(getGoogleDriveRuntimeStatus(actor)).resolves.toMatchObject({
      connectionStatus: "REAUTH_REQUIRED",
    });
    expect(mocks.recordConnectionError).toHaveBeenCalledWith(
      "connection-1",
      "GOOGLE_DRIVE_REAUTH_REQUIRED",
      expect.stringContaining("Reconnect required"),
    );
  });

  it("does not falsely report CONNECTED when live verification is temporarily unavailable", async () => {
    mocks.verifyAccess.mockRejectedValue(new AppError(
      "GOOGLE_DRIVE_API_ERROR",
      "Google Drive could not be reached.",
      502,
    ));

    await expect(getGoogleDriveRuntimeStatus(actor)).resolves.toMatchObject({
      connectionStatus: "UNAVAILABLE",
    });
    expect(mocks.recordConnectionError).not.toHaveBeenCalled();
  });
});
