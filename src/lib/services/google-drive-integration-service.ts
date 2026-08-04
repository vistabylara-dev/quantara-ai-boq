import { randomBytes } from "crypto";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import {
  buildGoogleDriveAuthorizationUrl,
  exchangeGoogleDriveAuthorizationCode,
  refreshGoogleDriveAccessToken,
  listGoogleDriveFiles,
  isGoogleDriveFolder,
  type GoogleTokenResponse,
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

const PROVIDER_ID = "google-drive";
const STATE_COOKIE_NAME = "google_drive_oauth_state";

function tokenResponseToStoredCredentials(token: GoogleTokenResponse, previousRefreshToken: string | null): StoredOAuthCredentials {
  return {
    accessToken: token.access_token,
    // Google only returns refresh_token on first consent (or with prompt=consent, which the
    // authorize URL always sets) — fall back to the previous one on refresh calls, which don't
    // return a new refresh_token at all.
    refreshToken: token.refresh_token ?? previousRefreshToken,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    scope: token.scope,
    tokenType: token.token_type,
  };
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export { STATE_COOKIE_NAME };

export function initiateGoogleDriveConnection(actor: CurrentActor, state: string): string {
  requireCapability(actor, "integrations:connect");
  return buildGoogleDriveAuthorizationUrl(state);
}

export async function completeGoogleDriveConnection(actor: CurrentActor, code: string): Promise<void> {
  requireCapability(actor, "integrations:connect");
  const token = await exchangeGoogleDriveAuthorizationCode(code);
  if (!token.refresh_token) {
    throw new AppError(
      "GOOGLE_DRIVE_NO_REFRESH_TOKEN",
      "Google did not return a refresh token. This can happen if the app is still in Testing mode with a stale prior grant — try disconnecting any prior authorization for this app in your Google Account's third-party access settings, then reconnect.",
      502,
    );
  }
  const credentials = tokenResponseToStoredCredentials(token, null);
  await upsertConnectedExternalConnection({
    companyId: actor.companyId,
    connectedByUserId: actor.userId,
    providerId: PROVIDER_ID,
    credentials,
    providerAccountId: null,
    grantedScopesJson: token.scope.split(" "),
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

  const credentials = await getDecryptedCredentialsForConnection(actor.companyId, connection.id);
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
    const nextCredentials = tokenResponseToStoredCredentials(refreshed, credentials.refreshToken);
    await updateStoredCredentials(actor.companyId, connection.id, nextCredentials);
    return { connectionId: connection.id, accessToken: nextCredentials.accessToken };
  } catch (error) {
    await recordConnectionError(connection.id, "TOKEN_REFRESH_FAILED", error instanceof Error ? error.message : "Token refresh failed.");
    throw new AppError("GOOGLE_DRIVE_REAUTH_REQUIRED", "Google Drive connection could not be refreshed. Please reconnect.", 401);
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
};

export async function browseGoogleDriveFolder(actor: CurrentActor, folderId?: string): Promise<GoogleDriveBrowseEntry[]> {
  requireCapability(actor, "integrations:sync");
  const { accessToken } = await getValidAccessToken(actor);
  const files = await listGoogleDriveFiles(accessToken, folderId);
  return files.map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    isFolder: isGoogleDriveFolder(file),
    sizeBytes: file.size ? Number(file.size) : null,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
  }));
}
