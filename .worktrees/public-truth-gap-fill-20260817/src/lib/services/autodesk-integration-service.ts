import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { loadIntegrationCredentialsEncryptionKey } from "@/lib/config/security-secrets";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import type { StoredOAuthCredentials } from "@/lib/integrations/credential-encryption";
import {
  AUTODESK_READ_SCOPE,
  buildAutodeskAuthorizationUrl,
  exchangeAutodeskAuthorizationCode,
  getAutodeskConfigurationStatus,
  getVerifiedAutodeskReadScope,
  listAutodeskFolderContents,
  listAutodeskHubs,
  listAutodeskProjects,
  listAutodeskTopFolders,
  refreshAutodeskAccessToken,
  type AutodeskConfigurationStatus,
  type AutodeskContentEntry,
  type AutodeskHub,
  type AutodeskProject,
  type AutodeskTokenResponse,
} from "@/lib/integrations/connectors/autodesk-client";
import {
  getConnectionForProvider,
  getDecryptedCredentialsForConnection,
  markConnectionDisconnected,
  recordConnectionError,
  updateStoredCredentials,
  upsertConnectedExternalConnection,
} from "@/lib/repositories/integration-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getIntegrationEntitlements } from "@/lib/entitlements/integration-entitlement-service";

const PROVIDER_ID = "autodesk";
export const STATE_COOKIE_NAME = "autodesk_oauth_state";
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const REFRESH_WINDOW_MS = 60_000;

export async function assertAutodeskIntegrationEntitled(actor: CurrentActor): Promise<void> {
  const entitlements = await getIntegrationEntitlements(actor);
  const allowed = entitlements.allowedProviderFamilies === "all"
    || entitlements.allowedProviderFamilies.includes("autodesk");

  if (!allowed) {
    throw new AppError(
      "INTEGRATION_NOT_ENTITLED",
      "AutoCAD / Autodesk integration is available on the Quantara Business plan.",
      403,
    );
  }
}

const AUTODESK_OAUTH_INTENTS = ["boq-source"] as const;
export type AutodeskOAuthIntent = (typeof AUTODESK_OAUTH_INTENTS)[number];

export function parseAutodeskOAuthIntent(value: string | null): AutodeskOAuthIntent | null {
  return value && (AUTODESK_OAUTH_INTENTS as readonly string[]).includes(value)
    ? (value as AutodeskOAuthIntent)
    : null;
}

export type AutodeskOAuthContext = {
  projectId: string | null;
  intent: AutodeskOAuthIntent | null;
  returnTo: string | null;
};

type OAuthStateCookiePayload = {
  state: string;
  userId: string;
  companyId: string;
  issuedAt: number;
  projectId?: string | null;
  intent?: AutodeskOAuthIntent | null;
  returnTo?: string | null;
};

type ValidAutodeskAccess = {
  connectionId: string;
  accessToken: string;
};

function isValidReturnTo(returnTo: string, projectId: string): boolean {
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return false;
  const projectPrefix = `/projects/${encodeURIComponent(projectId)}`;
  const normalizedUrl = new URL(returnTo, "https://oauth-context.invalid");
  return normalizedUrl.pathname === projectPrefix || normalizedUrl.pathname.startsWith(`${projectPrefix}/`);
}

async function resolveOAuthContext(
  actor: CurrentActor,
  candidate: { projectId?: string | null; intent?: string | null; returnTo?: string | null },
): Promise<AutodeskOAuthContext> {
  const intent = parseAutodeskOAuthIntent(candidate.intent ?? null);
  if (!candidate.projectId) return { projectId: null, intent: null, returnTo: null };

  try {
    const project = await getProjectRecord(actor.companyId, candidate.projectId);
    const projectId = project.slug;
    const returnTo = candidate.returnTo && isValidReturnTo(candidate.returnTo, projectId)
      ? candidate.returnTo
      : null;
    return { projectId, intent, returnTo };
  } catch {
    return { projectId: null, intent: null, returnTo: null };
  }
}

const refreshesInFlight = new Map<string, Promise<ValidAutodeskAccess>>();

function hasRequiredScope(scope: string | null | undefined): boolean {
  return scope?.split(/\s+/).includes(AUTODESK_READ_SCOPE) === true;
}

function tokenResponseToStoredCredentials(
  token: AutodeskTokenResponse,
  verifiedScope: string,
  previous: Pick<StoredOAuthCredentials, "refreshToken" | "scope" | "tokenType"> | null = null,
): StoredOAuthCredentials {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? previous?.refreshToken ?? null,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    scope: verifiedScope || previous?.scope || null,
    tokenType: token.token_type ?? previous?.tokenType ?? "Bearer",
  };
}

const AUTODESK_OAUTH_STATE_KEY_CONTEXT = "quantara:autodesk-oauth-state:v1";

function stateSigningSecret(): Buffer {
  // OAuth state protects Quantara's own browser round-trip.
  // It must not depend on the Autodesk provider Client Secret.
  // Derive a purpose-specific HMAC key from Quantara's existing
  // server-only integration credential encryption root key.
  return createHmac("sha256", loadIntegrationCredentialsEncryptionKey())
    .update(AUTODESK_OAUTH_STATE_KEY_CONTEXT)
    .digest();
}

function signOAuthStatePayload(encodedPayload: string): string {
  return createHmac("sha256", stateSigningSecret()).update(encodedPayload).digest("base64url");
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.byteLength === rightBuffer.byteLength && timingSafeEqual(leftBuffer, rightBuffer);
}

function oauthStateMismatch(): AppError {
  return new AppError(
    "AUTODESK_OAUTH_STATE_MISMATCH",
    "The Autodesk connection request could not be verified. Please reconnect.",
    400,
  );
}

/** Creates an opaque state and a signed, HttpOnly-cookie payload bound to the active tenant and project context. */
export async function createAutodeskOAuthState(
  actor: CurrentActor,
  candidateContext: { projectId?: string | null; intent?: string | null; returnTo?: string | null } = {},
): Promise<{ state: string; cookieValue: string }> {
  requireCapability(actor, "integrations:connect");
  await assertAutodeskIntegrationEntitled(actor);
  const context = await resolveOAuthContext(actor, candidateContext);
  const payload: OAuthStateCookiePayload = {
    state: randomBytes(24).toString("base64url"),
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

/** Verifies signature, expiry, actor binding, and the returned APS state in constant time. */
export async function verifyAutodeskOAuthState(
  actor: CurrentActor,
  returnedState: string | null,
  cookieValue: string | null,
): Promise<AutodeskOAuthContext> {
  requireCapability(actor, "integrations:connect");
  if (!returnedState || !cookieValue) throw oauthStateMismatch();
  const [encodedPayload, suppliedSignature, ...extraParts] = cookieValue.split(".");
  if (!encodedPayload || !suppliedSignature || extraParts.length > 0) throw oauthStateMismatch();

  const expectedSignature = signOAuthStatePayload(encodedPayload);
  if (!constantTimeStringEqual(suppliedSignature, expectedSignature)) throw oauthStateMismatch();

  let payload: OAuthStateCookiePayload;
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") throw new Error("Malformed OAuth state payload.");
    payload = parsed as OAuthStateCookiePayload;
  } catch {
    throw oauthStateMismatch();
  }

  const ageMs = Date.now() - payload.issuedAt;
  if (
    typeof payload.state !== "string"
    || typeof payload.userId !== "string"
    || typeof payload.companyId !== "string"
    || typeof payload.issuedAt !== "number"
    || !Number.isFinite(payload.issuedAt)
    || ageMs < 0
    || ageMs > OAUTH_STATE_MAX_AGE_MS
    || !constantTimeStringEqual(payload.userId, actor.userId)
    || !constantTimeStringEqual(payload.companyId, actor.companyId)
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

export function initiateAutodeskConnection(actor: CurrentActor, state: string): string {
  requireCapability(actor, "integrations:connect");
  return buildAutodeskAuthorizationUrl(state);
}

export async function completeAutodeskConnection(actor: CurrentActor, code: string): Promise<void> {
  requireCapability(actor, "integrations:connect");
  await assertAutodeskIntegrationEntitled(actor);
  const token = await exchangeAutodeskAuthorizationCode(code);
  if (!token.refresh_token) {
    throw new AppError(
      "AUTODESK_NO_REFRESH_TOKEN",
      "Autodesk did not provide durable authorization. Please reconnect and approve the requested permission.",
      502,
    );
  }

  const verifiedScope = await getVerifiedAutodeskReadScope(token.access_token);
  if (!hasRequiredScope(verifiedScope)) {
    throw new AppError(
      "AUTODESK_AUTH_DENIED",
      "Autodesk read-only access was not granted. Please reconnect and approve the requested permission.",
      403,
    );
  }
  // Token exchange + introspection prove OAuth authorization. Hub access is a
  // separate Autodesk account-provisioning boundary and must not invalidate
  // a valid Autodesk connection.

  await upsertConnectedExternalConnection({
    companyId: actor.companyId,
    connectedByUserId: actor.userId,
    providerId: PROVIDER_ID,
    credentials: tokenResponseToStoredCredentials(token, verifiedScope),
    providerAccountId: null,
    grantedScopesJson: verifiedScope.split(/\s+/),
  });
}

export async function disconnectAutodesk(actor: CurrentActor): Promise<void> {
  requireCapability(actor, "integrations:disconnect");
  const connection = await getConnectionForProvider(actor.companyId, PROVIDER_ID);
  if (!connection) throw new NotFoundError("No active Autodesk connection.");
  await markConnectionDisconnected(actor.companyId, connection.id);
}

async function refreshAutodeskCredentials(
  actor: CurrentActor,
  connection: { id: string },
  credentials: StoredOAuthCredentials,
): Promise<ValidAutodeskAccess> {
  const refreshKey = `${actor.companyId}:${connection.id}`;
  const inFlight = refreshesInFlight.get(refreshKey);
  if (inFlight) return inFlight;

  const refreshPromise = (async (): Promise<ValidAutodeskAccess> => {
    if (!credentials.refreshToken) {
      await recordConnectionError(
        connection.id,
        "TOKEN_EXPIRED_NO_REFRESH",
        "Autodesk access token expired and no refresh token is stored. Reconnect required.",
      );
      throw new AppError("AUTODESK_REAUTH_REQUIRED", "Autodesk connection expired. Please reconnect.", 401);
    }

    try {
      const refreshed = await refreshAutodeskAccessToken(credentials.refreshToken);
      const verifiedScope = await getVerifiedAutodeskReadScope(refreshed.access_token);
      const nextCredentials = tokenResponseToStoredCredentials(refreshed, verifiedScope, credentials);
      if (!hasRequiredScope(nextCredentials.scope) || !nextCredentials.refreshToken) {
        throw new AppError("AUTODESK_REAUTH_REQUIRED", "Autodesk read-only access must be renewed.", 401);
      }
      await updateStoredCredentials(actor.companyId, connection.id, nextCredentials);
      return { connectionId: connection.id, accessToken: nextCredentials.accessToken };
    } catch {
      await recordConnectionError(
        connection.id,
        "TOKEN_REFRESH_FAILED",
        "Autodesk token refresh failed. Reconnect required.",
      );
      throw new AppError("AUTODESK_REAUTH_REQUIRED", "Autodesk connection could not be refreshed. Please reconnect.", 401);
    }
  })();

  refreshesInFlight.set(refreshKey, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    if (refreshesInFlight.get(refreshKey) === refreshPromise) refreshesInFlight.delete(refreshKey);
  }
}

/** Returns a valid, tenant-scoped 3-legged token and refreshes it proactively. */
async function getValidAutodeskAccessToken(actor: CurrentActor): Promise<ValidAutodeskAccess> {
  const connection = await getConnectionForProvider(actor.companyId, PROVIDER_ID);
  if (!connection) throw new NotFoundError("No active Autodesk connection. Connect Autodesk first.");
  if (["ERROR", "REAUTH_REQUIRED"].includes(connection.status)) {
    throw new AppError("AUTODESK_REAUTH_REQUIRED", "Autodesk authorization needs to be renewed.", 401);
  }

  const credentials = await getDecryptedCredentialsForConnection(actor.companyId, connection.id);
  if (!hasRequiredScope(credentials.scope)) {
    await recordConnectionError(
      connection.id,
      "AUTODESK_REAUTH_REQUIRED",
      "The stored Autodesk grant does not include the required read-only scope.",
    );
    throw new AppError("AUTODESK_REAUTH_REQUIRED", "Autodesk read-only access must be renewed.", 401);
  }

  const expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt).getTime() : 0;
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() >= REFRESH_WINDOW_MS) {
    return { connectionId: connection.id, accessToken: credentials.accessToken };
  }
  return refreshAutodeskCredentials(actor, connection, credentials);
}

export type AutodeskRuntimeStatus = AutodeskConfigurationStatus & {
  connectionStatus: "NOT_CONFIGURED" | "NOT_CONNECTED" | "CONNECTED" | "REAUTH_REQUIRED" | "UNAVAILABLE";
};

/** Browser-safe connection state: no provider token, secret, or account data is returned. */
export async function getAutodeskRuntimeStatus(actor: CurrentActor): Promise<AutodeskRuntimeStatus> {
  requireCapability(actor, "integrations:connect");
  const configuration = getAutodeskConfigurationStatus();
  if (!configuration.configured) return { ...configuration, connectionStatus: "NOT_CONFIGURED" };

  const connection = await getConnectionForProvider(actor.companyId, PROVIDER_ID);
  if (!connection) return { ...configuration, connectionStatus: "NOT_CONNECTED" };
  if (["ERROR", "REAUTH_REQUIRED"].includes(connection.status)) {
    return { ...configuration, connectionStatus: "REAUTH_REQUIRED" };
  }

  try {
    const { accessToken } = await getValidAutodeskAccessToken(actor);
    await getVerifiedAutodeskReadScope(accessToken);
    return { ...configuration, connectionStatus: "CONNECTED" };
  } catch (error) {
    const requiresReauth = error instanceof AppError && [
      "AUTODESK_REAUTH_REQUIRED",
      "AUTODESK_ACCESS_DENIED",
      "AUTODESK_AUTH_DENIED",
    ].includes(error.code);
    if (requiresReauth) {
      await recordConnectionError(
        connection.id,
        "AUTODESK_REAUTH_REQUIRED",
        "Autodesk authorization could not be validated. Reconnect required.",
      ).catch(() => undefined);
      return { ...configuration, connectionStatus: "REAUTH_REQUIRED" };
    }
    if (error instanceof NotFoundError) return { ...configuration, connectionStatus: "NOT_CONNECTED" };
    return { ...configuration, connectionStatus: "UNAVAILABLE" };
  }
}

async function runAutodeskApiCall<T>(connectionId: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError && error.code === "AUTODESK_REAUTH_REQUIRED") {
      await recordConnectionError(
        connectionId,
        "AUTODESK_REAUTH_REQUIRED",
        "Autodesk authorization expired. Reconnect required.",
      ).catch(() => undefined);
    }
    throw error;
  }
}

/**
 * Runs a server-only, read-only APS operation with the tenant's current
 * encrypted connection. The browser never receives the access token.
 */
export async function withAutodeskReadAccess<T>(
  actor: CurrentActor,
  operation: (accessToken: string) => Promise<T>,
): Promise<T> {
  requireCapability(actor, "integrations:connect");
  await assertAutodeskIntegrationEntitled(actor);
  const { connectionId, accessToken } = await getValidAutodeskAccessToken(actor);
  return runAutodeskApiCall(connectionId, () => operation(accessToken));
}

export async function browseAutodeskHubs(actor: CurrentActor): Promise<AutodeskHub[]> {
  requireCapability(actor, "integrations:connect");
  await assertAutodeskIntegrationEntitled(actor);
  const { connectionId, accessToken } = await getValidAutodeskAccessToken(actor);
  return runAutodeskApiCall(connectionId, () => listAutodeskHubs(accessToken));
}

export async function browseAutodeskProjects(actor: CurrentActor, hubId: string): Promise<AutodeskProject[]> {
  requireCapability(actor, "integrations:connect");
  await assertAutodeskIntegrationEntitled(actor);
  const { connectionId, accessToken } = await getValidAutodeskAccessToken(actor);
  return runAutodeskApiCall(connectionId, () => listAutodeskProjects(accessToken, hubId));
}

export async function browseAutodeskContents(
  actor: CurrentActor,
  input: { hubId: string; projectId: string; folderId?: string },
): Promise<AutodeskContentEntry[]> {
  requireCapability(actor, "integrations:connect");
  await assertAutodeskIntegrationEntitled(actor);
  const { connectionId, accessToken } = await getValidAutodeskAccessToken(actor);
  return runAutodeskApiCall(connectionId, () => (
    input.folderId
      ? listAutodeskFolderContents(accessToken, input.projectId, input.folderId)
      : listAutodeskTopFolders(accessToken, input.hubId, input.projectId)
  ));
}
