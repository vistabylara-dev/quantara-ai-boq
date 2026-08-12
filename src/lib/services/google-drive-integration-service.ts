import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import {
  buildGoogleDriveAuthorizationUrl,
  exchangeGoogleDriveAuthorizationCode,
  refreshGoogleDriveAccessToken,
  listGoogleDriveFiles,
  isGoogleDriveFolder,
  getGoogleDriveFileMetadata,
  downloadGoogleDriveFile,
  getGoogleDriveConfigurationStatus,
  googleDriveTokenHasReadOnlyScope,
  verifyGoogleDriveAccess,
  type GoogleDriveFile,
  type GoogleTokenResponse,
  type GoogleDriveConfigurationStatus,
} from "@/lib/integrations/connectors/google-drive-client";
import {
  getConnectionForProvider,
  upsertConnectedExternalConnection,
  getDecryptedCredentialsForConnection,
  updateStoredCredentials,
  markConnectionDisconnected,
  recordConnectionError,
} from "@/lib/repositories/integration-repository";
import type { StoredOAuthCredentials } from "@/lib/integrations/credential-encryption";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { MAX_FILE_SIZE_BYTES, validateUpload } from "@/lib/files/file-security";
import { uploadProjectFile } from "@/lib/services/project-file-service";
import { getIntegrationEntitlements } from "@/lib/entitlements/integration-entitlement-service";

const PROVIDER_ID = "google-drive";
const PROVIDER_FAMILY = "google";
const STATE_COOKIE_NAME = "google_drive_oauth_state";
const GOOGLE_NATIVE_MIME_PREFIX = "application/vnd.google-apps.";
const GOOGLE_DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function tokenResponseToStoredCredentials(
  token: GoogleTokenResponse,
  previousRefreshToken: string | null,
  previousScope: string | null = null,
  previousTokenType: string | null = null,
): StoredOAuthCredentials {
  return {
    accessToken: token.access_token,
    // Google only returns refresh_token on first consent (or with prompt=consent, which the
    // authorize URL always sets) — fall back to the previous one on refresh calls, which don't
    // return a new refresh_token at all.
    refreshToken: token.refresh_token ?? previousRefreshToken,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    scope: token.scope ?? previousScope ?? "",
    tokenType: token.token_type ?? previousTokenType ?? "Bearer",
  };
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export { STATE_COOKIE_NAME };

/**
 * The only intents the first-OAuth journey currently needs to distinguish.
 * An unrecognized value from the query string is treated as absent rather
 * than rejected outright — a stale/foreign intent string should never block
 * the connection itself, only fail to restore context.
 */
const GOOGLE_DRIVE_OAUTH_INTENTS = ["boq-source"] as const;
export type GoogleDriveOAuthIntent = (typeof GOOGLE_DRIVE_OAUTH_INTENTS)[number];

export function parseGoogleDriveOAuthIntent(value: string | null): GoogleDriveOAuthIntent | null {
  return value && (GOOGLE_DRIVE_OAUTH_INTENTS as readonly string[]).includes(value)
    ? (value as GoogleDriveOAuthIntent)
    : null;
}

/**
 * A same-origin, relative path scoped to the given project — rules out open
 * redirects (absolute/protocol-relative URLs) and rules out landing the user
 * in a different project's workspace than the one that sent them here.
 * Mirrors src/app/integrations/project-context.tsx's client-side check;
 * duplicated (not imported) because that module is "use client" and this
 * one runs in route handlers.
 */
function isValidReturnTo(returnTo: string, projectId: string): boolean {
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return false;
  const projectPrefix = `/projects/${encodeURIComponent(projectId)}`;
  return returnTo === projectPrefix || returnTo.startsWith(`${projectPrefix}/`);
}

export type GoogleDriveOAuthContext = {
  projectId: string | null;
  intent: GoogleDriveOAuthIntent | null;
  returnTo: string | null;
};

type OAuthStateCookiePayload = {
  state: string;
  userId: string;
  companyId: string;
  issuedAt: number;
  projectId: string | null;
  intent: GoogleDriveOAuthIntent | null;
  returnTo: string | null;
};

function stateSigningSecret(): string {
  const status = getGoogleDriveConfigurationStatus();
  const secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!status.configured || !secret) {
    throw new AppError(
      "GOOGLE_DRIVE_NOT_CONFIGURED",
      "Google Drive connection needs administrator configuration.",
      503,
    );
  }
  return secret;
}

function signOAuthStatePayload(encodedPayload: string): string {
  return createHmac("sha256", stateSigningSecret()).update(encodedPayload).digest("base64url");
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.byteLength === rightBuffer.byteLength && timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Validates a candidate first-OAuth context against this company's real
 * data before it's ever signed into the state cookie — a stale/foreign/
 * malformed projectId, or a returnTo pointing outside that project, is
 * dropped silently (never blocks the connection itself) rather than trusted.
 */
async function resolveOAuthContext(
  actor: CurrentActor,
  candidate: { projectId?: string | null; intent?: string | null; returnTo?: string | null },
): Promise<GoogleDriveOAuthContext> {
  const intent = parseGoogleDriveOAuthIntent(candidate.intent ?? null);
  if (!candidate.projectId) return { projectId: null, intent: null, returnTo: null };

  try {
    const project = await getProjectRecord(actor.companyId, candidate.projectId);
    const returnTo = candidate.returnTo && isValidReturnTo(candidate.returnTo, project.id) ? candidate.returnTo : null;
    return { projectId: project.id, intent, returnTo };
  } catch {
    return { projectId: null, intent: null, returnTo: null };
  }
}

export async function createGoogleDriveOAuthState(
  actor: CurrentActor,
  candidateContext: { projectId?: string | null; intent?: string | null; returnTo?: string | null } = {},
): Promise<{ state: string; cookieValue: string }> {
  requireCapability(actor, "integrations:connect");
  const context = await resolveOAuthContext(actor, candidateContext);
  const payload: OAuthStateCookiePayload = {
    state: generateOAuthState(),
    userId: actor.userId,
    companyId: actor.companyId,
    issuedAt: Date.now(),
    ...context,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return {
    state: payload.state,
    cookieValue: `${encodedPayload}.${signOAuthStatePayload(encodedPayload)}`,
  };
}

function oauthStateMismatch(): AppError {
  return new AppError(
    "GOOGLE_DRIVE_OAUTH_STATE_MISMATCH",
    "The Google Drive connection request could not be verified. Please reconnect.",
    400,
  );
}

/**
 * Verifies the round-tripped OAuth state and returns the first-OAuth
 * context it carried (if any) so the callback route can restore the exact
 * project/intent/returnTo the user started from. Re-validates project
 * ownership against the CURRENT actor (not just trusting what was signed
 * minutes ago) — company membership can't have changed in a 10-minute
 * window, but this keeps the ownership check in one place rather than two.
 */
export async function verifyGoogleDriveOAuthState(
  actor: CurrentActor,
  returnedState: string | null,
  cookieValue: string | null,
): Promise<GoogleDriveOAuthContext> {
  if (!returnedState || !cookieValue) throw oauthStateMismatch();
  const [encodedPayload, suppliedSignature, ...extraParts] = cookieValue.split(".");
  if (!encodedPayload || !suppliedSignature || extraParts.length > 0) throw oauthStateMismatch();

  const expectedSignature = signOAuthStatePayload(encodedPayload);
  if (!constantTimeStringEqual(suppliedSignature, expectedSignature)) throw oauthStateMismatch();

  let payload: OAuthStateCookiePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as OAuthStateCookiePayload;
  } catch {
    throw oauthStateMismatch();
  }

  const ageMs = Date.now() - payload.issuedAt;
  if (
    typeof payload.state !== "string"
    || typeof payload.userId !== "string"
    || typeof payload.companyId !== "string"
    || typeof payload.issuedAt !== "number"
    || ageMs < 0
    || ageMs > 10 * 60 * 1000
    || payload.userId !== actor.userId
    || payload.companyId !== actor.companyId
    || !constantTimeStringEqual(payload.state, returnedState)
  ) {
    throw oauthStateMismatch();
  }

  return resolveOAuthContext(actor, {
    projectId: payload.projectId ?? null,
    intent: payload.intent ?? null,
    returnTo: payload.returnTo ?? null,
  });
}

export function initiateGoogleDriveConnection(actor: CurrentActor, state: string): string {
  requireCapability(actor, "integrations:connect");
  return buildGoogleDriveAuthorizationUrl(state);
}

export async function completeGoogleDriveConnection(actor: CurrentActor, code: string): Promise<void> {
  requireCapability(actor, "integrations:connect");
  const token = await exchangeGoogleDriveAuthorizationCode(code);
  if (!googleDriveTokenHasReadOnlyScope(token)) {
    throw new AppError(
      "GOOGLE_DRIVE_AUTH_DENIED",
      "Google Drive read-only access was not granted. Please reconnect and approve the requested permission.",
      403,
    );
  }
  if (!token.refresh_token) {
    throw new AppError(
      "GOOGLE_DRIVE_NO_REFRESH_TOKEN",
      "Google did not return a refresh token. This can happen if the app is still in Testing mode with a stale prior grant — try disconnecting any prior authorization for this app in your Google Account's third-party access settings, then reconnect.",
      502,
    );
  }
  await verifyGoogleDriveAccess(token.access_token);
  const credentials = tokenResponseToStoredCredentials(token, null);
  await upsertConnectedExternalConnection({
    companyId: actor.companyId,
    connectedByUserId: actor.userId,
    providerId: PROVIDER_ID,
    credentials,
    providerAccountId: null,
    grantedScopesJson: token.scope?.split(/\s+/) ?? [],
  });
}

export async function disconnectGoogleDrive(actor: CurrentActor): Promise<void> {
  requireCapability(actor, "integrations:disconnect");
  const connection = await getConnectionForProvider(actor.companyId, PROVIDER_ID);
  if (!connection) throw new NotFoundError("No active Google Drive connection.");
  await markConnectionDisconnected(actor.companyId, connection.id);
}

/** Returns a valid (refreshed if necessary) access token for this company's Google Drive connection. */
async function getValidAccessToken(actor: CurrentActor): Promise<{ connectionId: string; accessToken: string }> {
  const connection = await getConnectionForProvider(actor.companyId, PROVIDER_ID);
  if (!connection) throw new NotFoundError("No active Google Drive connection. Connect Google Drive first.");

  if (["ERROR", "REAUTH_REQUIRED"].includes(connection.status)) {
    throw new AppError("GOOGLE_DRIVE_REAUTH_REQUIRED", "Google Drive authorization needs to be renewed.", 401);
  }

  const credentials = await getDecryptedCredentialsForConnection(actor.companyId, connection.id);
  if (!credentials.scope?.split(/\s+/).includes(GOOGLE_DRIVE_READONLY_SCOPE)) {
    await recordConnectionError(
      connection.id,
      "GOOGLE_DRIVE_REAUTH_REQUIRED",
      "The stored Google Drive grant does not include the required read-only scope.",
    );
    throw new AppError("GOOGLE_DRIVE_REAUTH_REQUIRED", "Google Drive read-only access must be renewed.", 401);
  }
  const expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt).getTime() : 0;
  const isExpiringSoon = expiresAt - Date.now() < 60_000; // refresh proactively within 60s of expiry

  if (!isExpiringSoon) {
    return { connectionId: connection.id, accessToken: credentials.accessToken };
  }

  if (!credentials.refreshToken) {
    await recordConnectionError(connection.id, "TOKEN_EXPIRED_NO_REFRESH", "Access token expired and no refresh token is stored. Reconnect required.");
    throw new AppError("GOOGLE_DRIVE_REAUTH_REQUIRED", "Google Drive connection expired. Please reconnect.", 401);
  }

  try {
    const refreshed = await refreshGoogleDriveAccessToken(credentials.refreshToken);
    const nextCredentials = tokenResponseToStoredCredentials(
      refreshed,
      credentials.refreshToken,
      credentials.scope,
      credentials.tokenType,
    );
    if (!nextCredentials.scope?.split(/\s+/).includes(GOOGLE_DRIVE_READONLY_SCOPE)) {
      throw new AppError("GOOGLE_DRIVE_REAUTH_REQUIRED", "Google Drive read-only access must be renewed.", 401);
    }
    await updateStoredCredentials(actor.companyId, connection.id, nextCredentials);
    return { connectionId: connection.id, accessToken: nextCredentials.accessToken };
  } catch {
    await recordConnectionError(
      connection.id,
      "TOKEN_REFRESH_FAILED",
      "Google Drive token refresh failed. Reconnect required.",
    );
    throw new AppError("GOOGLE_DRIVE_REAUTH_REQUIRED", "Google Drive connection could not be refreshed. Please reconnect.", 401);
  }
}

export type GoogleDriveRuntimeStatus = GoogleDriveConfigurationStatus & {
  connectionStatus: "NOT_CONFIGURED" | "NOT_CONNECTED" | "CONNECTED" | "REAUTH_REQUIRED" | "UNAVAILABLE";
};

/**
 * Returns a browser-safe status based on configuration, stored state, and a
 * live read-only Drive request. A database row alone never proves CONNECTED.
 */
export async function getGoogleDriveRuntimeStatus(actor: CurrentActor): Promise<GoogleDriveRuntimeStatus> {
  requireCapability(actor, "integrations:connect");
  const configuration = getGoogleDriveConfigurationStatus();
  if (!configuration.configured) {
    return { ...configuration, connectionStatus: "NOT_CONFIGURED" };
  }

  const connection = await getConnectionForProvider(actor.companyId, PROVIDER_ID);
  if (!connection) {
    return { ...configuration, connectionStatus: "NOT_CONNECTED" };
  }
  if (["ERROR", "REAUTH_REQUIRED"].includes(connection.status)) {
    return { ...configuration, connectionStatus: "REAUTH_REQUIRED" };
  }

  try {
    const { accessToken } = await getValidAccessToken(actor);
    await verifyGoogleDriveAccess(accessToken);
    return { ...configuration, connectionStatus: "CONNECTED" };
  } catch (error) {
    const requiresReauth = error instanceof AppError && [
      "GOOGLE_DRIVE_REAUTH_REQUIRED",
      "GOOGLE_DRIVE_ACCESS_DENIED",
    ].includes(error.code);
    if (requiresReauth) {
      await recordConnectionError(
        connection.id,
        "GOOGLE_DRIVE_REAUTH_REQUIRED",
        "Google Drive authorization could not be validated. Reconnect required.",
      ).catch(() => undefined);
      return { ...configuration, connectionStatus: "REAUTH_REQUIRED" };
    }
    if (error instanceof NotFoundError) {
      return { ...configuration, connectionStatus: "NOT_CONNECTED" };
    }
    return { ...configuration, connectionStatus: "UNAVAILABLE" };
  }
}

async function assertGoogleDriveImportEntitled(actor: CurrentActor): Promise<void> {
  const entitlements = await getIntegrationEntitlements(actor);
  const providerAllowed = entitlements.allowedProviderFamilies === "all"
    || entitlements.allowedProviderFamilies.includes(PROVIDER_FAMILY);
  if (!entitlements.manualSync || !providerAllowed) {
    throw new AppError(
      "INTEGRATION_NOT_ENTITLED",
      "Your current plan does not include Google Drive file import.",
      403,
    );
  }
}

function isGoogleNativeFile(file: Pick<GoogleDriveFile, "mimeType">): boolean {
  return file.mimeType.startsWith(GOOGLE_NATIVE_MIME_PREFIX);
}

function getRequiredMetadataSize(file: Pick<GoogleDriveFile, "name" | "mimeType" | "size">): number {
  if (file.size === null || !/^\d+$/.test(file.size)) {
    throw new AppError(
      "GOOGLE_DRIVE_FILE_SIZE_UNAVAILABLE",
      "Google Drive did not provide a valid size for the selected file.",
      400,
    );
  }

  const size = BigInt(file.size);
  // Pass the existing validator a bounded sentinel for arbitrarily large
  // provider values so it owns the public size-limit error contract.
  const sizeForValidation = size > BigInt(MAX_FILE_SIZE_BYTES)
    ? MAX_FILE_SIZE_BYTES + 1
    : Number(size);
  validateUpload(file.name, file.mimeType, sizeForValidation);
  return sizeForValidation;
}

function normalizeMimeType(value: string): string {
  return value.split(";", 1)[0].trim().toLowerCase();
}

function assertDownloadedFileMatchesMetadata(
  file: Pick<GoogleDriveFile, "name" | "mimeType">,
  expectedSize: number,
  download: { bytes: ArrayBuffer; contentType: string | null; contentLength: number | null },
): Buffer {
  const downloadedMime = download.contentType ? normalizeMimeType(download.contentType) : null;
  const metadataMime = normalizeMimeType(file.mimeType);
  if (downloadedMime && downloadedMime !== metadataMime) {
    throw new AppError(
      "GOOGLE_DRIVE_FILE_METADATA_MISMATCH",
      "The downloaded file type does not match its Google Drive metadata.",
      409,
    );
  }

  if (download.contentLength !== null && download.contentLength !== expectedSize) {
    throw new AppError(
      "GOOGLE_DRIVE_FILE_CHANGED",
      "The selected Google Drive file changed while it was being imported. Please try again.",
      409,
    );
  }

  const buffer = Buffer.from(download.bytes);
  if (buffer.byteLength !== expectedSize) {
    throw new AppError(
      "GOOGLE_DRIVE_FILE_CHANGED",
      "The selected Google Drive file changed while it was being imported. Please try again.",
      409,
    );
  }

  // The normal upload service validates again before persistence. Keeping
  // this boundary check here ensures provider inconsistencies fail before
  // any private-storage write begins.
  validateUpload(file.name, file.mimeType, buffer.byteLength);
  return buffer;
}

async function runGoogleDriveApiCall<T>(connectionId: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError && error.code === "GOOGLE_DRIVE_REAUTH_REQUIRED") {
      await recordConnectionError(
        connectionId,
        "GOOGLE_DRIVE_REAUTH_REQUIRED",
        "Google Drive authorization expired. Reconnect required.",
      ).catch(() => undefined);
    }
    throw error;
  }
}

export type GoogleDriveBrowseEntry = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  sizeBytes: number | null;
  modifiedTime: string;
  webViewLink: string | null;
  canImport: boolean;
  unsupportedReason: string | null;
};

function getImportEligibility(file: GoogleDriveFile): { canImport: boolean; unsupportedReason: string | null } {
  if (isGoogleDriveFolder(file)) return { canImport: false, unsupportedReason: null };
  if (isGoogleNativeFile(file)) {
    return {
      canImport: false,
      unsupportedReason: "Google-native Docs, Sheets, Slides, and shortcuts are not supported for raw import.",
    };
  }
  try {
    getRequiredMetadataSize(file);
    return { canImport: true, unsupportedReason: null };
  } catch (error) {
    return {
      canImport: false,
      unsupportedReason: error instanceof AppError ? error.message : "This file cannot be imported.",
    };
  }
}

export async function browseGoogleDriveFolder(actor: CurrentActor, folderId?: string): Promise<GoogleDriveBrowseEntry[]> {
  requireCapability(actor, "integrations:sync");
  const { connectionId, accessToken } = await getValidAccessToken(actor);
  const files = await runGoogleDriveApiCall(connectionId, () => listGoogleDriveFiles(accessToken, folderId));
  return files.map((file) => {
    const eligibility = getImportEligibility(file);
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isFolder: isGoogleDriveFolder(file),
      sizeBytes: file.size && /^\d+$/.test(file.size) ? Number(file.size) : null,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      ...eligibility,
    };
  });
}

export type ImportGoogleDriveFileInput = {
  googleFileId: string;
  projectId: string;
};

/** Imports one selected raw Drive file through Quantara's ordinary project-file path. */
export async function importGoogleDriveFile(actor: CurrentActor, input: ImportGoogleDriveFileInput) {
  requireCapability(actor, "integrations:sync");
  requireCapability(actor, "files:manage");
  await assertGoogleDriveImportEntitled(actor);

  // Resolve tenant ownership before making any provider request. The normal
  // upload service receives only this canonical UUID.
  const project = await getProjectRecord(actor.companyId, input.projectId);
  const { connectionId, accessToken } = await getValidAccessToken(actor);
  const file = await runGoogleDriveApiCall(connectionId, () => (
    getGoogleDriveFileMetadata(accessToken, input.googleFileId)
  ));

  if (isGoogleDriveFolder(file)) {
    throw new AppError("GOOGLE_DRIVE_FOLDER_NOT_IMPORTABLE", "Select a file, not a Google Drive folder.", 400);
  }
  if (isGoogleNativeFile(file)) {
    throw new AppError(
      "GOOGLE_DRIVE_NATIVE_FILE_UNSUPPORTED",
      "Google-native Docs, Sheets, Slides, and shortcuts cannot be imported as raw files yet.",
      400,
    );
  }

  const expectedSize = getRequiredMetadataSize(file);
  const download = await runGoogleDriveApiCall(connectionId, () => (
    downloadGoogleDriveFile(accessToken, input.googleFileId, {
      maxBytes: MAX_FILE_SIZE_BYTES,
      expectedBytes: expectedSize,
    })
  ));
  const buffer = assertDownloadedFileMatchesMetadata(file, expectedSize, download);

  const result = await uploadProjectFile(actor, project.id, {
    originalName: file.name,
    mimeType: normalizeMimeType(file.mimeType),
    buffer,
    sourceAttribution: {
      provider: PROVIDER_ID,
      externalConnectionId: connectionId,
      externalFileId: file.id,
      modifiedTime: file.modifiedTime || null,
      webViewLink: file.webViewLink,
    },
  });

  return {
    ...result,
    project: { id: project.slug, databaseId: project.id, name: project.name },
  };
}
