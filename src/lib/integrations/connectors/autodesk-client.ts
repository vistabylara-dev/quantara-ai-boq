import { AppError } from "@/lib/errors/app-error";

/**
 * Read-only Autodesk Platform Services (APS) OAuth and Data Management
 * client. Tokens stay server-side; this module never returns credentials to
 * browser callers.
 */

const AUTHORIZATION_ENDPOINT = "https://developer.api.autodesk.com/authentication/v2/authorize";
const TOKEN_ENDPOINT = "https://developer.api.autodesk.com/authentication/v2/token";
const INTROSPECTION_ENDPOINT = "https://developer.api.autodesk.com/authentication/v2/introspect";
const DATA_MANAGEMENT_ENDPOINT = "https://developer.api.autodesk.com";
const MODEL_DERIVATIVE_ENDPOINT = "https://developer.api.autodesk.com/modelderivative/v2/designdata";

export const AUTODESK_READ_SCOPE = "data:read";

const REQUIRED_AUTODESK_ENV = [
  "AUTODESK_CLIENT_ID",
  "AUTODESK_CLIENT_SECRET",
  "APP_BASE_URL",
] as const;

type AutodeskEnvironmentName = (typeof REQUIRED_AUTODESK_ENV)[number];

export type AutodeskConfigurationStatus = {
  configured: boolean;
  redirectUri: string | null;
  missingConfiguration: AutodeskEnvironmentName[];
};

function parseAppBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    const isProduction = process.env.NODE_ENV === "production";

    if (
      url.username
      || url.password
      || url.search
      || url.hash
      || (url.pathname !== "/" && url.pathname !== "")
      || (isProduction && url.protocol !== "https:")
      || (isProduction && isLocalHost)
      || (isProduction && process.env.VERCEL_ENV === "preview")
      || (!isProduction && !["http:", "https:"].includes(url.protocol))
    ) {
      return null;
    }

    return new URL(url.origin);
  } catch {
    return null;
  }
}

export function getAutodeskConfigurationStatus(): AutodeskConfigurationStatus {
  const missingConfiguration = REQUIRED_AUTODESK_ENV.filter((name) => !process.env[name]?.trim());
  const baseUrl = process.env.APP_BASE_URL?.trim();
  const parsedBaseUrl = baseUrl ? parseAppBaseUrl(baseUrl) : null;

  if (baseUrl && !parsedBaseUrl && !missingConfiguration.includes("APP_BASE_URL")) {
    missingConfiguration.push("APP_BASE_URL");
  }

  return {
    configured: missingConfiguration.length === 0,
    redirectUri: parsedBaseUrl
      ? new URL("/api/integrations/autodesk/callback", parsedBaseUrl).toString()
      : null,
    missingConfiguration,
  };
}

function requireEnv(name: AutodeskEnvironmentName): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AppError(
      "AUTODESK_NOT_CONFIGURED",
      "Autodesk connection needs administrator configuration.",
      503,
    );
  }
  return value;
}

export function getAutodeskClientSecret(): string {
  return requireEnv("AUTODESK_CLIENT_SECRET");
}

export function getAutodeskClientId(): string {
  return requireEnv("AUTODESK_CLIENT_ID");
}

export function getAutodeskCallbackUri(): string {
  const status = getAutodeskConfigurationStatus();
  if (!status.configured || !status.redirectUri) {
    throw new AppError(
      "AUTODESK_NOT_CONFIGURED",
      "Autodesk connection needs administrator configuration.",
      503,
    );
  }
  return status.redirectUri;
}

export function buildAutodeskAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getAutodeskClientId(),
    response_type: "code",
    redirect_uri: getAutodeskCallbackUri(),
    scope: AUTODESK_READ_SCOPE,
    state,
  });
  return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

export type AutodeskTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
};

type AutodeskIntrospectionResponse = {
  active: boolean;
  scope?: string;
  client_id?: string;
  exp?: number;
};

function basicAuthorizationHeader(): string {
  return `Basic ${Buffer.from(`${getAutodeskClientId()}:${getAutodeskClientSecret()}`, "utf8").toString("base64")}`;
}

async function parseTokenResponse(response: Response): Promise<AutodeskTokenResponse> {
  const body = await response.json().catch(() => null) as unknown;
  if (
    !response.ok
    || !body
    || typeof body !== "object"
    || typeof (body as { access_token?: unknown }).access_token !== "string"
    || typeof (body as { expires_in?: unknown }).expires_in !== "number"
    || !Number.isFinite((body as { expires_in: number }).expires_in)
    || (body as { expires_in: number }).expires_in <= 0
  ) {
    throw new AppError(
      "AUTODESK_TOKEN_ERROR",
      "Autodesk could not complete the authorization request. Please reconnect and try again.",
      502,
    );
  }
  return body as AutodeskTokenResponse;
}

async function postToken(form: URLSearchParams): Promise<AutodeskTokenResponse> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: basicAuthorizationHeader(),
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
  } catch {
    throw new AppError("AUTODESK_TOKEN_ERROR", "Autodesk could not be reached. Please try again.", 502);
  }
  return parseTokenResponse(response);
}

export async function exchangeAutodeskAuthorizationCode(code: string): Promise<AutodeskTokenResponse> {
  return postToken(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getAutodeskCallbackUri(),
  }));
}

export async function refreshAutodeskAccessToken(refreshToken: string): Promise<AutodeskTokenResponse> {
  return postToken(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: AUTODESK_READ_SCOPE,
  }));
}

function scopeIncludesDataRead(scope: string | undefined): boolean {
  return scope?.split(/\s+/).includes(AUTODESK_READ_SCOPE) === true;
}

/**
 * APS token responses do not include granted scope. Introspection is the
 * server-side proof that the access token is active and carries data:read.
 */
export async function getVerifiedAutodeskReadScope(accessToken: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(INTROSPECTION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: basicAuthorizationHeader(),
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: accessToken }),
    });
  } catch {
    throw new AppError("AUTODESK_TOKEN_ERROR", "Autodesk could not verify authorization. Please reconnect.", 502);
  }

  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok || !body || typeof body !== "object") {
    throw new AppError("AUTODESK_TOKEN_ERROR", "Autodesk could not verify authorization. Please reconnect.", 502);
  }

  const token = body as AutodeskIntrospectionResponse;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    token.active !== true
    || !scopeIncludesDataRead(token.scope)
    || (token.client_id !== undefined && token.client_id !== getAutodeskClientId())
    || typeof token.exp !== "number"
    || !Number.isFinite(token.exp)
    || token.exp <= nowSeconds
  ) {
    throw new AppError(
      "AUTODESK_AUTH_DENIED",
      "Autodesk read-only access was not granted. Please reconnect and approve the requested permission.",
      403,
    );
  }

  return token.scope!;
}

type AutodeskApiRecord = Record<string, unknown>;

export type AutodeskHub = {
  id: string;
  name: string;
  type: string;
};

export type AutodeskProject = AutodeskHub;

export type AutodeskContentEntry = {
  id: string;
  name: string;
  type: "folder" | "file";
  isFolder: boolean;
  isFile: boolean;
  isDwg: boolean;
};

/** A normalized immutable reference to the current Autodesk item version. */
export type AutodeskItemTipVersion = {
  itemId: string;
  versionId: string;
  name: string;
  mimeType: string | null;
  versionNumber: number;
  derivativeUrn: string | null;
};

export type AutodeskDerivativeManifest = {
  status: "success";
  progress: "complete";
};

export type AutodeskModelMetadata = {
  modelGuid: string;
  name: string;
  role: "2d" | "3d" | null;
  isMasterView: boolean | null;
};

export type AutodeskModelProperty = {
  objectId: number;
  name: string;
  externalId: string | null;
  properties: Record<string, Record<string, unknown>>;
};

function isRecord(value: unknown): value is AutodeskApiRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getNameFromAttributes(value: unknown): string | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  return value.name;
}

function derivativeNotReady(): AppError {
  return new AppError(
    "AUTODESK_DERIVATIVE_NOT_READY",
    "Autodesk model metadata is not available for this DWG version yet.",
    409,
  );
}

function getRelationshipIdentifier(
  resource: AutodeskApiRecord,
  relationshipName: string,
  expectedType: string,
): string | null {
  const relationships = isRecord(resource.relationships) ? resource.relationships : null;
  const relationshipValue = relationships?.[relationshipName];
  const relationship: AutodeskApiRecord | null = isRecord(relationshipValue) ? relationshipValue : null;
  const dataValue = relationship?.data;
  const data: AutodeskApiRecord | null = isRecord(dataValue) ? dataValue : null;
  return data && data.type === expectedType && typeof data.id === "string" && data.id
    ? data.id
    : null;
}

function parseNamedEntry(value: unknown): AutodeskHub {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || typeof value.type !== "string") {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid cloud data.", 502);
  }
  const name = getNameFromAttributes(value.attributes);
  if (!name) {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid cloud data.", 502);
  }
  return { id: value.id, name, type: value.type };
}

function getVersionName(item: AutodeskApiRecord, included: unknown[]): string | null {
  const relationships = isRecord(item.relationships) ? item.relationships : null;
  const tip = relationships && isRecord(relationships.tip) ? relationships.tip : null;
  const tipData = tip && isRecord(tip.data) ? tip.data : null;
  const tipId = tipData && typeof tipData.id === "string" ? tipData.id : null;
  if (!tipId) return null;
  const version = included.find((candidate) => (
    isRecord(candidate) && candidate.type === "versions" && candidate.id === tipId
  ));
  return version && isRecord(version) ? getNameFromAttributes(version.attributes) : null;
}

function parseContentEntries(body: unknown): AutodeskContentEntry[] {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid folder contents.", 502);
  }
  const included = Array.isArray(body.included) ? body.included : [];
  const entries: AutodeskContentEntry[] = [];

  for (const candidate of body.data) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !candidate.id) {
      throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid folder contents.", 502);
    }
    if (candidate.type === "folders") {
      const name = getNameFromAttributes(candidate.attributes);
      if (!name) throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid folder contents.", 502);
      entries.push({ id: candidate.id, name, type: "folder", isFolder: true, isFile: false, isDwg: false });
      continue;
    }
    if (candidate.type === "items") {
      const name = getVersionName(candidate, included);
      if (!name) continue;
      entries.push({
        id: candidate.id,
        name,
        type: "file",
        isFolder: false,
        isFile: true,
        isDwg: name.toLocaleLowerCase("en-US").endsWith(".dwg"),
      });
    }
  }

  return entries;
}

async function throwAutodeskApiError(response: Response, operation: string): Promise<never> {
  await response.body?.cancel().catch(() => undefined);
  if (response.status === 401) {
    throw new AppError("AUTODESK_REAUTH_REQUIRED", "Autodesk authorization expired. Please reconnect.", 401);
  }
  if (response.status === 403) {
    throw new AppError("AUTODESK_ACCESS_DENIED", "Autodesk denied access to this cloud resource.", 403);
  }
  if (response.status === 404) {
    throw new AppError("AUTODESK_RESOURCE_NOT_FOUND", "The requested Autodesk cloud resource was not found.", 404);
  }
  throw new AppError("AUTODESK_API_ERROR", `Autodesk could not ${operation}. Please try again.`, 502);
}

async function fetchAutodeskData(path: string, accessToken: string, operation: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${DATA_MANAGEMENT_ENDPOINT}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
  } catch {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk could not be reached. Please try again.", 502);
  }
  if (!response.ok) return throwAutodeskApiError(response, operation);
  const body = await response.json().catch(() => null) as unknown;
  if (!body) throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid cloud data.", 502);
  return body;
}

async function fetchAutodeskDerivativeData(path: string, accessToken: string, operation: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${MODEL_DERIVATIVE_ENDPOINT}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
  } catch {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk could not be reached. Please try again.", 502);
  }

  if (response.status === 202 || response.status === 404) {
    await response.body?.cancel().catch(() => undefined);
    throw derivativeNotReady();
  }
  if (!response.ok) return throwAutodeskApiError(response, operation);

  const body = await response.json().catch(() => null) as unknown;
  if (!body) throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid model data.", 502);
  return body;
}

function parseTipVersion(body: unknown, itemId: string): Omit<AutodeskItemTipVersion, "derivativeUrn"> {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid DWG version data.", 502);
  }
  const version = body.data;
  const attributes = isRecord(version.attributes) ? version.attributes : null;
  const name = attributes ? getNameFromAttributes(attributes) : null;
  const versionNumber = attributes?.versionNumber;
  if (
    version.type !== "versions"
    || typeof version.id !== "string"
    || !version.id
    || !name
    || typeof versionNumber !== "number"
    || !Number.isInteger(versionNumber)
  ) {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid DWG version data.", 502);
  }
  return {
    itemId,
    versionId: version.id,
    name,
    mimeType: typeof attributes?.mimeType === "string" && attributes.mimeType ? attributes.mimeType : null,
    versionNumber,
  };
}

async function getDerivativeUrnFromVersionReferences(
  accessToken: string,
  projectId: string,
  versionId: string,
): Promise<string | null> {
  try {
    const body = await fetchAutodeskData(
      `/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/relationships/refs`,
      accessToken,
      "read DWG version references",
    );
    if (!isRecord(body) || !Array.isArray(body.included)) return null;

    const versions = body.included.filter((candidate): candidate is AutodeskApiRecord => (
      isRecord(candidate) && candidate.type === "versions"
    ));
    const matchingVersion = versions.filter((version) => version.id === versionId);
    const candidates = new Set(
      (matchingVersion.length > 0 ? matchingVersion : versions)
        .map((version) => getRelationshipIdentifier(version, "derivatives", "derivatives"))
        .filter((urn): urn is string => Boolean(urn)),
    );
    return candidates.size === 1 ? [...candidates][0] : null;
  } catch (error) {
    if (error instanceof AppError && error.code === "AUTODESK_RESOURCE_NOT_FOUND") return null;
    throw error;
  }
}

/** Resolves only the APS-declared immutable tip/version relationship; it never infers a derivative from a filename. */
export async function getAutodeskItemTipVersion(
  accessToken: string,
  projectId: string,
  itemId: string,
): Promise<AutodeskItemTipVersion> {
  const body = await fetchAutodeskData(
    `/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(itemId)}/tip`,
    accessToken,
    "read the DWG version",
  );
  const tip = parseTipVersion(body, itemId);
  const directDerivative = isRecord(body) && isRecord(body.data)
    ? getRelationshipIdentifier(body.data, "derivatives", "derivatives")
    : null;
  const derivativeUrn = directDerivative ?? await getDerivativeUrnFromVersionReferences(accessToken, projectId, tip.versionId);
  return { ...tip, derivativeUrn };
}

/** Checks that APS has completed the server-generated Model Derivative for the selected DWG version. */
export async function getAutodeskDerivativeManifest(
  accessToken: string,
  derivativeUrn: string,
): Promise<AutodeskDerivativeManifest> {
  const body = await fetchAutodeskDerivativeData(
    `/${encodeURIComponent(derivativeUrn)}/manifest`,
    accessToken,
    "read DWG model metadata",
  );
  if (!isRecord(body) || body.status !== "success" || body.progress !== "complete") {
    throw derivativeNotReady();
  }
  return { status: "success", progress: "complete" };
}

/** Returns only validated model views, with no raw APS response passed to callers. */
export async function getAutodeskModelMetadata(
  accessToken: string,
  derivativeUrn: string,
): Promise<AutodeskModelMetadata[]> {
  const body = await fetchAutodeskDerivativeData(
    `/${encodeURIComponent(derivativeUrn)}/metadata`,
    accessToken,
    "read DWG model views",
  );
  const data = isRecord(body) && isRecord(body.data) ? body.data : null;
  if (!data || data.type !== "metadata" || !Array.isArray(data.metadata)) {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid model metadata.", 502);
  }

  const models: AutodeskModelMetadata[] = [];
  for (const entry of data.metadata) {
    if (!isRecord(entry) || typeof entry.guid !== "string" || !entry.guid || typeof entry.name !== "string" || !entry.name) {
      throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid model metadata.", 502);
    }
    models.push({
      modelGuid: entry.guid,
      name: entry.name,
      role: entry.role === "2d" || entry.role === "3d" ? entry.role : null,
      isMasterView: typeof entry.isMasterView === "boolean" ? entry.isMasterView : null,
    });
  }
  return models;
}

/** Returns validated object properties only. Values are preserved as APS supplied them; no units or quantities are inferred here. */
export async function getAutodeskModelProperties(
  accessToken: string,
  derivativeUrn: string,
  modelGuid: string,
): Promise<AutodeskModelProperty[]> {
  const body = await fetchAutodeskDerivativeData(
    `/${encodeURIComponent(derivativeUrn)}/metadata/${encodeURIComponent(modelGuid)}/properties`,
    accessToken,
    "read DWG object properties",
  );
  const data = isRecord(body) && isRecord(body.data) ? body.data : null;
  if (!data || data.type !== "properties" || !Array.isArray(data.collection)) {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid model properties.", 502);
  }

  return data.collection.map((entry) => {
    if (
      !isRecord(entry)
      || typeof entry.objectid !== "number"
      || !Number.isInteger(entry.objectid)
      || typeof entry.name !== "string"
      || !entry.name
      || !isRecord(entry.properties)
    ) {
      throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid model properties.", 502);
    }

    const groups: Record<string, Record<string, unknown>> = {};
    for (const [groupName, groupProperties] of Object.entries(entry.properties)) {
      if (!isRecord(groupProperties)) {
        throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid model properties.", 502);
      }
      groups[groupName] = groupProperties;
    }
    return {
      objectId: entry.objectid,
      name: entry.name,
      externalId: typeof entry.externalId === "string" && entry.externalId ? entry.externalId : null,
      properties: groups,
    };
  });
}

function parseNamedList(body: unknown): AutodeskHub[] {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    throw new AppError("AUTODESK_API_ERROR", "Autodesk returned invalid cloud data.", 502);
  }
  return body.data.map(parseNamedEntry);
}

export async function listAutodeskHubs(accessToken: string): Promise<AutodeskHub[]> {
  return parseNamedList(await fetchAutodeskData("/project/v1/hubs", accessToken, "list hubs"));
}

export async function listAutodeskProjects(accessToken: string, hubId: string): Promise<AutodeskProject[]> {
  return parseNamedList(await fetchAutodeskData(
    `/project/v1/hubs/${encodeURIComponent(hubId)}/projects`,
    accessToken,
    "list projects",
  ));
}

export async function listAutodeskTopFolders(
  accessToken: string,
  hubId: string,
  projectId: string,
): Promise<AutodeskContentEntry[]> {
  return parseContentEntries(await fetchAutodeskData(
    `/project/v1/hubs/${encodeURIComponent(hubId)}/projects/${encodeURIComponent(projectId)}/topFolders`,
    accessToken,
    "list top folders",
  ));
}

export async function listAutodeskFolderContents(
  accessToken: string,
  projectId: string,
  folderId: string,
): Promise<AutodeskContentEntry[]> {
  return parseContentEntries(await fetchAutodeskData(
    `/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/contents`,
    accessToken,
    "list folder contents",
  ));
}

/** A live, read-only data request that proves the granted token is usable. */
export async function verifyAutodeskAccess(accessToken: string): Promise<void> {
  await listAutodeskHubs(accessToken);
}
