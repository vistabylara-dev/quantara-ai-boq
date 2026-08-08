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
  const body = await response.json().catch(() => null) as any;
  if (!response.ok || !body || typeof body.access_token !== "string") {
    throw new AppError(
      "GOOGLE_DRIVE_TOKEN_ERROR",
      "Google Drive could not complete the authorization request. Please reconnect and try again.",
      502,
    );
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

function parseGoogleDriveFile(value: unknown): GoogleDriveFile {
  if (!value || typeof value !== "object") {
    throw new AppError("GOOGLE_DRIVE_API_ERROR", "Google Drive returned invalid file metadata.", 502);
  }
  const file = value as Record<string, unknown>;
  if (
    typeof file.id !== "string"
    || typeof file.name !== "string"
    || typeof file.mimeType !== "string"
  ) {
    throw new AppError("GOOGLE_DRIVE_API_ERROR", "Google Drive returned invalid file metadata.", 502);
  }
  if (file.size !== undefined && file.size !== null && typeof file.size !== "string") {
    throw new AppError("GOOGLE_DRIVE_API_ERROR", "Google Drive returned an invalid file size.", 502);
  }

  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: typeof file.size === "string" ? file.size : null,
    modifiedTime: typeof file.modifiedTime === "string" ? file.modifiedTime : "",
    parents: Array.isArray(file.parents) && file.parents.every((parent) => typeof parent === "string")
      ? file.parents as string[]
      : null,
    iconLink: typeof file.iconLink === "string" ? file.iconLink : null,
    webViewLink: typeof file.webViewLink === "string" ? file.webViewLink : null,
  };
}

async function throwDriveApiError(response: Response, operation: string): Promise<never> {
  // Provider error bodies can contain account or file details. Keep the
  // public Quantara error contract controlled and credential-free.
  await response.body?.cancel().catch(() => undefined);
  if (response.status === 401) {
    throw new AppError("GOOGLE_DRIVE_REAUTH_REQUIRED", "Google Drive authorization expired. Please reconnect.", 401);
  }
  if (response.status === 404) {
    throw new AppError("GOOGLE_DRIVE_FILE_NOT_FOUND", "The selected Google Drive file was not found.", 404);
  }
  if (response.status === 403) {
    throw new AppError("GOOGLE_DRIVE_ACCESS_DENIED", "Google Drive denied access to the selected file.", 403);
  }
  throw new AppError("GOOGLE_DRIVE_API_ERROR", `Google Drive could not ${operation}. Please try again.`, 502);
}

async function fetchGoogleDrive(url: string, accessToken: string): Promise<Response> {
  try {
    return await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new AppError("GOOGLE_DRIVE_API_ERROR", "Google Drive could not be reached. Please try again.", 502);
  }
}

/** Lists files/folders inside a given folder (root Drive if folderId is omitted). Excludes trashed items. */
export async function listGoogleDriveFiles(accessToken: string, folderId?: string): Promise<GoogleDriveFile[]> {
  const parent = folderId ?? "root";
  const params = new URLSearchParams({
    q: `'${parent}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, size, modifiedTime, parents, iconLink, webViewLink)",
    pageSize: "200",
    orderBy: "folder,name",
  });
  const response = await fetchGoogleDrive(`${DRIVE_FILES_ENDPOINT}?${params.toString()}`, accessToken);
  if (!response.ok) {
    return throwDriveApiError(response, "list files");
  }
  const body = await response.json().catch(() => null) as any;
  const files = Array.isArray(body?.files) ? body.files : [];
  return files.map(parseGoogleDriveFile);
}

export function isGoogleDriveFolder(file: Pick<GoogleDriveFile, "mimeType">): boolean {
  return file.mimeType === DRIVE_FOLDER_MIME_TYPE;
}

export async function getGoogleDriveFileMetadata(accessToken: string, fileId: string): Promise<GoogleDriveFile> {
  const params = new URLSearchParams({ fields: "id, name, mimeType, size, modifiedTime, parents, iconLink, webViewLink" });
  const response = await fetchGoogleDrive(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?${params.toString()}`,
    accessToken,
  );
  if (!response.ok) {
    return throwDriveApiError(response, "read file metadata");
  }
  const body = await response.json().catch(() => null) as any;
  return parseGoogleDriveFile(body);
}

/** Downloads a file's raw bytes. Google Docs/Sheets/Slides (no direct binary) are not supported yet — caller should check mimeType first. */
export async function downloadGoogleDriveFile(
  accessToken: string,
  fileId: string,
  options: { maxBytes?: number; expectedBytes?: number } = {},
): Promise<{ bytes: ArrayBuffer; contentType: string | null; contentLength: number | null }> {
  const response = await fetchGoogleDrive(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?alt=media`,
    accessToken,
  );
  if (!response.ok) {
    return throwDriveApiError(response, "download the selected file");
  }

  const rawContentLength = response.headers.get("content-length");
  const contentLength = rawContentLength && /^\d+$/.test(rawContentLength)
    ? Number(rawContentLength)
    : null;
  if (contentLength !== null && options.maxBytes !== undefined && contentLength > options.maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new AppError(
      "FILE_TOO_LARGE",
      `The selected file exceeds the ${Math.floor(options.maxBytes / (1024 * 1024))}MB size limit.`,
      400,
    );
  }
  if (contentLength !== null && options.expectedBytes !== undefined && contentLength !== options.expectedBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new AppError(
      "GOOGLE_DRIVE_FILE_CHANGED",
      "The selected Google Drive file changed while it was being imported. Please try again.",
      409,
    );
  }

  const byteLimit = Math.min(
    options.maxBytes ?? Number.MAX_SAFE_INTEGER,
    options.expectedBytes ?? Number.MAX_SAFE_INTEGER,
  );
  const expectedBuffer = options.expectedBytes !== undefined
    ? new Uint8Array(options.expectedBytes)
    : null;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const nextTotalBytes = totalBytes + value.byteLength;
        if (nextTotalBytes > byteLimit) {
          await reader.cancel().catch(() => undefined);
          if (options.expectedBytes !== undefined && nextTotalBytes > options.expectedBytes) {
            throw new AppError(
              "GOOGLE_DRIVE_FILE_CHANGED",
              "The selected Google Drive file changed while it was being imported. Please try again.",
              409,
            );
          }
          throw new AppError(
            "FILE_TOO_LARGE",
            `The selected file exceeds the ${Math.floor(byteLimit / (1024 * 1024))}MB size limit.`,
            400,
          );
        }
        if (expectedBuffer) {
          expectedBuffer.set(value, totalBytes);
        } else {
          chunks.push(value);
        }
        totalBytes = nextTotalBytes;
      }
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("GOOGLE_DRIVE_API_ERROR", "The Google Drive download was interrupted. Please try again.", 502);
  }

  if (options.expectedBytes !== undefined && totalBytes !== options.expectedBytes) {
    throw new AppError(
      "GOOGLE_DRIVE_FILE_CHANGED",
      "The selected Google Drive file changed while it was being imported. Please try again.",
      409,
    );
  }

  let bytes: ArrayBuffer;
  if (expectedBuffer) {
    bytes = expectedBuffer.buffer;
  } else {
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    bytes = combined.buffer;
  }

  return {
    bytes,
    contentType: response.headers.get("content-type"),
    contentLength,
  };
}
