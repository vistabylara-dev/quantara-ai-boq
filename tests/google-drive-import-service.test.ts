import { UserRole } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { AppError, NotFoundError } from "../src/lib/errors/app-error";
import { MAX_FILE_SIZE_BYTES } from "../src/lib/files/file-security";

const mocks = vi.hoisted(() => ({
  getConnectionForProvider: vi.fn(),
  upsertConnectedExternalConnection: vi.fn(),
  getDecryptedCredentialsForConnection: vi.fn(),
  updateStoredCredentials: vi.fn(),
  markConnectionDisconnected: vi.fn(),
  recordConnectionError: vi.fn(),
  getProjectRecord: vi.fn(),
  getIntegrationEntitlements: vi.fn(),
  uploadProjectFile: vi.fn(),
  buildGoogleDriveAuthorizationUrl: vi.fn(),
  exchangeGoogleDriveAuthorizationCode: vi.fn(),
  refreshGoogleDriveAccessToken: vi.fn(),
  listGoogleDriveFiles: vi.fn(),
  getGoogleDriveFileMetadata: vi.fn(),
  downloadGoogleDriveFile: vi.fn(),
  isGoogleDriveFolder: vi.fn((file: { mimeType: string }) => file.mimeType === "application/vnd.google-apps.folder"),
}));

vi.mock("@/lib/repositories/integration-repository", () => ({
  getConnectionForProvider: mocks.getConnectionForProvider,
  upsertConnectedExternalConnection: mocks.upsertConnectedExternalConnection,
  getDecryptedCredentialsForConnection: mocks.getDecryptedCredentialsForConnection,
  updateStoredCredentials: mocks.updateStoredCredentials,
  markConnectionDisconnected: mocks.markConnectionDisconnected,
  recordConnectionError: mocks.recordConnectionError,
}));

vi.mock("@/lib/repositories/project-repository", () => ({
  getProjectRecord: mocks.getProjectRecord,
}));

vi.mock("@/lib/entitlements/integration-entitlement-service", () => ({
  getIntegrationEntitlements: mocks.getIntegrationEntitlements,
}));

vi.mock("@/lib/services/project-file-service", () => ({
  uploadProjectFile: mocks.uploadProjectFile,
}));

vi.mock("@/lib/integrations/connectors/google-drive-client", () => ({
  buildGoogleDriveAuthorizationUrl: mocks.buildGoogleDriveAuthorizationUrl,
  exchangeGoogleDriveAuthorizationCode: mocks.exchangeGoogleDriveAuthorizationCode,
  refreshGoogleDriveAccessToken: mocks.refreshGoogleDriveAccessToken,
  listGoogleDriveFiles: mocks.listGoogleDriveFiles,
  getGoogleDriveFileMetadata: mocks.getGoogleDriveFileMetadata,
  downloadGoogleDriveFile: mocks.downloadGoogleDriveFile,
  isGoogleDriveFolder: mocks.isGoogleDriveFolder,
}));

import {
  browseGoogleDriveFolder,
  importGoogleDriveFile,
} from "../src/lib/services/google-drive-integration-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const CONNECTION_ID = "44444444-4444-4444-8444-444444444444";

function actor(role: UserRole = UserRole.COMPANY_OWNER): CurrentActor {
  return {
    userId: USER_ID,
    companyId: COMPANY_ID,
    role,
    fullName: "Drive Import Test",
    email: "drive-import@example.com",
  };
}

function driveFile(overrides: Partial<{
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string;
  parents: string[] | null;
  iconLink: string | null;
  webViewLink: string | null;
}> = {}) {
  return {
    id: "google-file-1",
    name: "source-plan.pdf",
    mimeType: "application/pdf",
    size: "3",
    modifiedTime: "2026-08-08T08:00:00.000Z",
    parents: ["root"],
    iconLink: null,
    webViewLink: "https://drive.google.com/file/d/google-file-1/view",
    ...overrides,
  };
}

async function expectCode(promise: Promise<unknown>, code: string, status?: number) {
  try {
    await promise;
    expect.fail(`Expected ${code}`);
  } catch (error) {
    expect(error).toMatchObject({ code, ...(status === undefined ? {} : { status }) });
  }
}

function setHappyDefaults() {
  mocks.getIntegrationEntitlements.mockResolvedValue({
    manualSync: true,
    allowedProviderFamilies: ["google"],
  });
  mocks.getProjectRecord.mockResolvedValue({
    id: PROJECT_ID,
    slug: "dubai-tower",
    name: "Dubai Tower",
  });
  mocks.getConnectionForProvider.mockResolvedValue({ id: CONNECTION_ID, status: "CONNECTED" });
  mocks.getDecryptedCredentialsForConnection.mockResolvedValue({
    accessToken: "access-secret",
    refreshToken: "refresh-secret",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scope: "https://www.googleapis.com/auth/drive.readonly",
    tokenType: "Bearer",
  });
  mocks.getGoogleDriveFileMetadata.mockResolvedValue(driveFile());
  mocks.downloadGoogleDriveFile.mockResolvedValue({
    bytes: Uint8Array.from([1, 2, 3]).buffer,
    contentType: "application/pdf; charset=binary",
    contentLength: 3,
  });
  mocks.uploadProjectFile.mockResolvedValue({
    file: { id: "project-file-1", checksum: "abc123" },
    duplicateOfFileId: null,
  });
  mocks.recordConnectionError.mockResolvedValue(undefined);
  mocks.updateStoredCredentials.mockResolvedValue(undefined);
}

describe("Google Drive project-file import service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHappyDefaults();
  });

  it("requires integrations:sync before any entitlement, project, or provider lookup", async () => {
    await expectCode(
      importGoogleDriveFile(actor(UserRole.DESIGNER), { googleFileId: "google-file-1", projectId: "dubai-tower" }),
      "PERMISSION_DENIED",
      403,
    );
    expect(mocks.getIntegrationEntitlements).not.toHaveBeenCalled();
    expect(mocks.getProjectRecord).not.toHaveBeenCalled();
    expect(mocks.getConnectionForProvider).not.toHaveBeenCalled();
  });

  it("requires files:manage after integrations:sync", async () => {
    await expectCode(
      importGoogleDriveFile(actor(UserRole.ADMINISTRATOR), { googleFileId: "google-file-1", projectId: "dubai-tower" }),
      "PERMISSION_DENIED",
      403,
    );
    expect(mocks.getIntegrationEntitlements).not.toHaveBeenCalled();
    expect(mocks.getProjectRecord).not.toHaveBeenCalled();
    expect(mocks.getConnectionForProvider).not.toHaveBeenCalled();
  });

  it("denies a plan without Google manual-sync entitlement before project or Drive access", async () => {
    mocks.getIntegrationEntitlements.mockResolvedValue({ manualSync: false, allowedProviderFamilies: [] });
    await expectCode(
      importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" }),
      "INTEGRATION_NOT_ENTITLED",
      403,
    );
    expect(mocks.getProjectRecord).not.toHaveBeenCalled();
    expect(mocks.getConnectionForProvider).not.toHaveBeenCalled();
    expect(mocks.getGoogleDriveFileMetadata).not.toHaveBeenCalled();
  });

  it("resolves the tenant-owned project before connection or Drive access", async () => {
    mocks.getProjectRecord.mockRejectedValue(new NotFoundError("Project not found."));
    await expectCode(
      importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "other-company-project" }),
      "NOT_FOUND",
      404,
    );
    expect(mocks.getProjectRecord).toHaveBeenCalledWith(COMPANY_ID, "other-company-project");
    expect(mocks.getConnectionForProvider).not.toHaveBeenCalled();
    expect(mocks.getGoogleDriveFileMetadata).not.toHaveBeenCalled();
  });

  it("fails safely when the company has no active Google Drive connection", async () => {
    mocks.getConnectionForProvider.mockResolvedValue(null);
    await expectCode(
      importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" }),
      "NOT_FOUND",
      404,
    );
    expect(mocks.getDecryptedCredentialsForConnection).not.toHaveBeenCalled();
    expect(mocks.getGoogleDriveFileMetadata).not.toHaveBeenCalled();
  });

  it("refreshes an expiring token, preserves its refresh token, and uses the new access token", async () => {
    mocks.getDecryptedCredentialsForConnection.mockResolvedValue({
      accessToken: "old-access-secret",
      refreshToken: "stable-refresh-secret",
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      scope: "https://www.googleapis.com/auth/drive.readonly",
      tokenType: "Bearer",
    });
    mocks.refreshGoogleDriveAccessToken.mockResolvedValue({
      access_token: "new-access-secret",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      token_type: "Bearer",
    });

    await importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" });

    expect(mocks.refreshGoogleDriveAccessToken).toHaveBeenCalledWith("stable-refresh-secret");
    expect(mocks.updateStoredCredentials).toHaveBeenCalledWith(
      COMPANY_ID,
      CONNECTION_ID,
      expect.objectContaining({ accessToken: "new-access-secret", refreshToken: "stable-refresh-secret" }),
    );
    expect(mocks.getGoogleDriveFileMetadata).toHaveBeenCalledWith("new-access-secret", "google-file-1");
    expect(mocks.downloadGoogleDriveFile).toHaveBeenCalledWith(
      "new-access-secret",
      "google-file-1",
      { maxBytes: MAX_FILE_SIZE_BYTES, expectedBytes: 3 },
    );
  });

  it("requires reconnect when an expired credential has no refresh token", async () => {
    mocks.getDecryptedCredentialsForConnection.mockResolvedValue({
      accessToken: "expired-access",
      refreshToken: null,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      scope: "https://www.googleapis.com/auth/drive.readonly",
      tokenType: "Bearer",
    });
    await expectCode(
      importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" }),
      "GOOGLE_DRIVE_REAUTH_REQUIRED",
      401,
    );
    expect(mocks.recordConnectionError).toHaveBeenCalledWith(
      CONNECTION_ID,
      "TOKEN_EXPIRED_NO_REFRESH",
      expect.stringContaining("Reconnect required"),
    );
    expect(mocks.getGoogleDriveFileMetadata).not.toHaveBeenCalled();
  });

  it("sanitizes a rejected token refresh before persisting or returning the error", async () => {
    mocks.getDecryptedCredentialsForConnection.mockResolvedValue({
      accessToken: "expired-access",
      refreshToken: "refresh-secret",
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      scope: "https://www.googleapis.com/auth/drive.readonly",
      tokenType: "Bearer",
    });
    mocks.refreshGoogleDriveAccessToken.mockRejectedValue(
      new Error("provider-controlled response containing access-secret and Authorization"),
    );

    try {
      await importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" });
      expect.fail("Expected reconnect-required error");
    } catch (error) {
      expect(error).toMatchObject({ code: "GOOGLE_DRIVE_REAUTH_REQUIRED", status: 401 });
      expect(JSON.stringify(error)).not.toContain("access-secret");
      expect(JSON.stringify(error)).not.toContain("Authorization");
    }
    expect(mocks.recordConnectionError).toHaveBeenCalledWith(
      CONNECTION_ID,
      "TOKEN_REFRESH_FAILED",
      "Google Drive token refresh failed. Reconnect required.",
    );
  });

  it.each([
    ["folder", driveFile({ mimeType: "application/vnd.google-apps.folder", size: null }), "GOOGLE_DRIVE_FOLDER_NOT_IMPORTABLE"],
    ["native Google file", driveFile({ mimeType: "application/vnd.google-apps.document", size: null }), "GOOGLE_DRIVE_NATIVE_FILE_UNSUPPORTED"],
    ["unsupported extension", driveFile({ name: "payload.exe", mimeType: "application/octet-stream" }), "FILE_TYPE_NOT_SUPPORTED"],
    ["MIME mismatch", driveFile({ name: "source-plan.pdf", mimeType: "image/png" }), "FILE_MIME_MISMATCH"],
    ["empty file", driveFile({ size: "0" }), "FILE_EMPTY"],
    ["oversize file", driveFile({ size: String(MAX_FILE_SIZE_BYTES + 1) }), "FILE_TOO_LARGE"],
  ])("rejects %s metadata before download or storage", async (_label, file, code) => {
    mocks.getGoogleDriveFileMetadata.mockResolvedValue(file);
    await expectCode(
      importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" }),
      code,
      400,
    );
    expect(mocks.downloadGoogleDriveFile).not.toHaveBeenCalled();
    expect(mocks.uploadProjectFile).not.toHaveBeenCalled();
  });

  it.each([
    ["response MIME", { contentType: "image/png", contentLength: 3, bytes: Uint8Array.from([1, 2, 3]).buffer }, "GOOGLE_DRIVE_FILE_METADATA_MISMATCH"],
    ["response Content-Length", { contentType: "application/pdf", contentLength: 4, bytes: Uint8Array.from([1, 2, 3]).buffer }, "GOOGLE_DRIVE_FILE_CHANGED"],
    ["actual byte length", { contentType: "application/pdf", contentLength: null, bytes: Uint8Array.from([1, 2]).buffer }, "GOOGLE_DRIVE_FILE_CHANGED"],
  ])("rejects a mismatched %s before normal upload", async (_label, download, code) => {
    mocks.downloadGoogleDriveFile.mockResolvedValue(download);
    await expectCode(
      importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" }),
      code,
      409,
    );
    expect(mocks.uploadProjectFile).not.toHaveBeenCalled();
  });

  it("records a safe reconnect state when Drive returns 401", async () => {
    mocks.getGoogleDriveFileMetadata.mockRejectedValue(
      new AppError("GOOGLE_DRIVE_REAUTH_REQUIRED", "Google Drive authorization expired. Please reconnect.", 401),
    );
    await expectCode(
      importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" }),
      "GOOGLE_DRIVE_REAUTH_REQUIRED",
      401,
    );
    expect(mocks.recordConnectionError).toHaveBeenCalledWith(
      CONNECTION_ID,
      "GOOGLE_DRIVE_REAUTH_REQUIRED",
      "Google Drive authorization expired. Reconnect required.",
    );
    expect(mocks.downloadGoogleDriveFile).not.toHaveBeenCalled();
  });

  it("preserves a Drive 404 without recording a credential failure", async () => {
    mocks.getGoogleDriveFileMetadata.mockRejectedValue(
      new AppError("GOOGLE_DRIVE_FILE_NOT_FOUND", "The selected Google Drive file was not found.", 404),
    );
    await expectCode(
      importGoogleDriveFile(actor(), { googleFileId: "missing", projectId: "dubai-tower" }),
      "GOOGLE_DRIVE_FILE_NOT_FOUND",
      404,
    );
    expect(mocks.recordConnectionError).not.toHaveBeenCalled();
    expect(mocks.downloadGoogleDriveFile).not.toHaveBeenCalled();
  });

  it("imports a slug-selected project through normal upload using the canonical UUID and safe attribution", async () => {
    const result = await importGoogleDriveFile(actor(), {
      googleFileId: "google-file-1",
      projectId: "dubai-tower",
    });

    expect(mocks.uploadProjectFile).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, userId: USER_ID }),
      PROJECT_ID,
      expect.objectContaining({
        originalName: "source-plan.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from([1, 2, 3]),
        sourceAttribution: {
          provider: "google-drive",
          externalConnectionId: CONNECTION_ID,
          externalFileId: "google-file-1",
          modifiedTime: "2026-08-08T08:00:00.000Z",
          webViewLink: "https://drive.google.com/file/d/google-file-1/view",
        },
      }),
    );
    expect(result).toMatchObject({
      duplicateOfFileId: null,
      project: { id: "dubai-tower", databaseId: PROJECT_ID, name: "Dubai Tower" },
    });
    const persistedInput = JSON.stringify(mocks.uploadProjectFile.mock.calls[0]);
    expect(persistedInput).not.toContain("access-secret");
    expect(persistedInput).not.toContain("refresh-secret");
    expect(persistedInput).not.toContain("Bearer");
  });

  it("preserves the ordinary duplicate signal on a repeated submission without changing source identity", async () => {
    mocks.uploadProjectFile
      .mockResolvedValueOnce({ file: { id: "project-file-1" }, duplicateOfFileId: null })
      .mockResolvedValueOnce({ file: { id: "project-file-2" }, duplicateOfFileId: "project-file-1" });

    const first = await importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" });
    const second = await importGoogleDriveFile(actor(), { googleFileId: "google-file-1", projectId: "dubai-tower" });

    expect(first.duplicateOfFileId).toBeNull();
    expect(second.duplicateOfFileId).toBe("project-file-1");
    expect(mocks.uploadProjectFile).toHaveBeenCalledTimes(2);
    expect(mocks.uploadProjectFile.mock.calls[0][2].sourceAttribution).toEqual(
      mocks.uploadProjectFile.mock.calls[1][2].sourceAttribution,
    );
  });

  it("returns server-derived browse eligibility from the ordinary upload validator", async () => {
    mocks.listGoogleDriveFiles.mockResolvedValue([
      driveFile({ id: "folder", name: "Folder", mimeType: "application/vnd.google-apps.folder", size: null }),
      driveFile({ id: "supported", name: "supported.pdf" }),
      driveFile({ id: "native", name: "Native Doc", mimeType: "application/vnd.google-apps.document", size: null }),
      driveFile({ id: "unsupported", name: "payload.exe", mimeType: "application/octet-stream" }),
      driveFile({ id: "empty", name: "empty.pdf", size: "0" }),
    ]);

    const entries = await browseGoogleDriveFolder(actor());

    expect(entries.map(({ id, canImport }) => ({ id, canImport }))).toEqual([
      { id: "folder", canImport: false },
      { id: "supported", canImport: true },
      { id: "native", canImport: false },
      { id: "unsupported", canImport: false },
      { id: "empty", canImport: false },
    ]);
    expect(entries.find((entry) => entry.id === "native")?.unsupportedReason).toContain("Google-native");
    expect(entries.find((entry) => entry.id === "unsupported")?.unsupportedReason).toContain("not supported");
    expect(entries.find((entry) => entry.id === "empty")?.unsupportedReason).toContain("empty");
  });
});

describe("Google Drive import client safety", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("URL-encodes opaque file IDs before metadata lookup", async () => {
    const actualClient = await vi.importActual<typeof import("../src/lib/integrations/connectors/google-drive-client")>(
      "../src/lib/integrations/connectors/google-drive-client",
    );
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(driveFile()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    await actualClient.getGoogleDriveFileMetadata("access-token", "id/with spaces?#");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/id%2Fwith%20spaces%3F%23?");
  });

  it.each([
    [401, "GOOGLE_DRIVE_REAUTH_REQUIRED", 401],
    [404, "GOOGLE_DRIVE_FILE_NOT_FOUND", 404],
  ])("maps Drive HTTP %i to the controlled %s contract", async (providerStatus, code, status) => {
    const actualClient = await vi.importActual<typeof import("../src/lib/integrations/connectors/google-drive-client")>(
      "../src/lib/integrations/connectors/google-drive-client",
    );
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: providerStatus })) as typeof fetch;

    await expectCode(actualClient.getGoogleDriveFileMetadata("access-token", "file-id"), code, status);
  });

  it("stops a raw download as soon as the provider exceeds the metadata size", async () => {
    const actualClient = await vi.importActual<typeof import("../src/lib/integrations/connectors/google-drive-client")>(
      "../src/lib/integrations/connectors/google-drive-client",
    );
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(Uint8Array.from([1, 2, 3, 4]), {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    })) as typeof fetch;

    await expectCode(
      actualClient.downloadGoogleDriveFile("access-token", "file-id", {
        maxBytes: MAX_FILE_SIZE_BYTES,
        expectedBytes: 3,
      }),
      "GOOGLE_DRIVE_FILE_CHANGED",
      409,
    );
  });
});
