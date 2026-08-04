import { AppError } from "@/lib/errors/app-error";

/**
 * Thin, honest wrapper over Google's OAuth 2.0 and Drive API v3 endpoints —
 * no SDK dependency, plain fetch, so behavior is exactly what Google's own
 * docs describe (https://developers.google.com/identity/protocols/oauth2/web-server,
 * https://developers.google.com/drive/api/v3/reference/files/list).
 *
 * Requires GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET to be set —
 * throws a clear, actionable error if either is missing rather than silently
 * no-op'ing or using a fake fallback.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";

// Read-only scope — least privilege for browsing/importing files, no write/delete access to the user's Drive.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function requireEnv(name: "GOOGLE_DRIVE_CLIENT_ID" | "GOOGLE_DRIVE_CLIENT_SECRET" | "APP_BASE_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new AppError(
      "GOOGLE_DRIVE_NOT_CONFIGURED",
      `${name} is not set. The Google Drive connector cannot be used until this environment variable is configured.`,
      503,
    );
  }
  return value;
}

function redirectUri(): string {
  return `${requireEnv("APP_BASE_URL")}/api/integrations/google-drive/callback`;
}

export function buildGoogleDriveAuthorizationUrl(state: string): string {
  const clientId = requireEnv("GOOGLE_DRIVE_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // forces the consent screen every time, guaranteeing a refresh_token even on re-connect
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

async function parseTokenResponse(response: Response): Promise<GoogleTokenResponse> {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body.access_token !== "string") {
    const message = body && typeof body.error_description === "string" ? body.error_description : `Google token request failed (${response.status}).`;
    throw new AppError("GOOGLE_DRIVE_TOKEN_ERROR", message, 502);
  }
  return body as GoogleTokenResponse;
}

export async function exchangeGoogleDriveAuthorizationCode(code: string): Promise<GoogleTokenResponse> {
  const clientId = requireEnv("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_DRIVE_CLIENT_SECRET");
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  return parseTokenResponse(response);
}

export async function refreshGoogleDriveAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const clientId = requireEnv("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_DRIVE_CLIENT_SECRET");
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  return parseTokenResponse(response);
}

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string;
  parents: string[] | null;
  iconLink: string | null;
  webViewLink: string | null;
};

const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

/** Lists files/folders inside a given folder (root Drive if folderId is omitted). Excludes trashed items. */
export async function listGoogleDriveFiles(accessToken: string, folderId?: string): Promise<GoogleDriveFile[]> {
  const parent = folderId ?? "root";
  const params = new URLSearchParams({
    q: `'${parent}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, size, modifiedTime, parents, iconLink, webViewLink)",
    pageSize: "200",
    orderBy: "folder,name",
  });
  const response = await fetch(`${DRIVE_FILES_ENDPOINT}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? `Google Drive files.list failed (${response.status}).`;
    throw new AppError("GOOGLE_DRIVE_API_ERROR", message, response.status === 401 ? 401 : 502);
  }
  return (body.files ?? []) as GoogleDriveFile[];
}

export function isGoogleDriveFolder(file: Pick<GoogleDriveFile, "mimeType">): boolean {
  return file.mimeType === DRIVE_FOLDER_MIME_TYPE;
}

export async function getGoogleDriveFileMetadata(accessToken: string, fileId: string): Promise<GoogleDriveFile> {
  const params = new URLSearchParams({ fields: "id, name, mimeType, size, modifiedTime, parents, iconLink, webViewLink" });
  const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? `Google Drive files.get failed (${response.status}).`;
    throw new AppError("GOOGLE_DRIVE_API_ERROR", message, response.status === 401 ? 401 : 502);
  }
  return body as GoogleDriveFile;
}

/** Downloads a file's raw bytes. Google Docs/Sheets/Slides (no direct binary) are not supported yet — caller should check mimeType first. */
export async function downloadGoogleDriveFile(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new AppError("GOOGLE_DRIVE_API_ERROR", `Google Drive file download failed (${response.status}).`, response.status === 401 ? 401 : 502);
  }
  return response.arrayBuffer();
}
