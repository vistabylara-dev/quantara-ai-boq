import { JWT } from "google-auth-library";
import { AppError } from "@/lib/errors/app-error";
import {
  buildMarketingLeadSheetRow,
  type MarketingLeadRecord,
} from "@/lib/marketing/lead-capture";

const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GOOGLE_SHEETS_APPEND_RANGE = "A:N";
const GOOGLE_SHEETS_REQUEST_TIMEOUT_MS = 10_000;

const REQUIRED_ENVIRONMENT_NAMES = [
  "GOOGLE_SHEETS_CLIENT_EMAIL",
  "GOOGLE_SHEETS_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
] as const;

type GoogleSheetsEnvironment = Record<string, string | undefined>;

export type GoogleSheetsLeadConfiguration = {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
};

export type GoogleSheetsLeadDependencies = {
  environment?: GoogleSheetsEnvironment;
  authorize?: (configuration: GoogleSheetsLeadConfiguration) => Promise<string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

let cachedJwtClient: JWT | null = null;
let cachedJwtEmail: string | null = null;

function unavailableError() {
  return new AppError(
    "MARKETING_LEAD_DELIVERY_UNAVAILABLE",
    "We could not receive your request right now. Please try again shortly.",
    503,
  );
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout?.();
      reject(new Error("Google Sheets request timed out."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export function readGoogleSheetsLeadConfiguration(
  environment: GoogleSheetsEnvironment = process.env,
): GoogleSheetsLeadConfiguration {
  const missing = REQUIRED_ENVIRONMENT_NAMES.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    console.error("[marketing-leads] Google Sheets configuration is incomplete.", { missing });
    throw unavailableError();
  }

  const clientEmail = environment.GOOGLE_SHEETS_CLIENT_EMAIL!.trim();
  const privateKey = normalizePrivateKey(environment.GOOGLE_SHEETS_PRIVATE_KEY!);
  const spreadsheetId = environment.GOOGLE_SHEETS_SPREADSHEET_ID!.trim();

  if (
    !/^[^@\s]+@[^@\s]+$/.test(clientEmail)
    || !privateKey.startsWith("-----BEGIN PRIVATE KEY-----")
    || !privateKey.endsWith("-----END PRIVATE KEY-----")
    || !/^[A-Za-z0-9_-]{10,200}$/.test(spreadsheetId)
  ) {
    console.error("[marketing-leads] Google Sheets configuration has an invalid format.");
    throw unavailableError();
  }

  return { clientEmail, privateKey, spreadsheetId };
}

async function authorizeGoogleSheets(configuration: GoogleSheetsLeadConfiguration): Promise<string> {
  if (!cachedJwtClient || cachedJwtEmail !== configuration.clientEmail) {
    cachedJwtEmail = configuration.clientEmail;
    cachedJwtClient = new JWT({
      email: configuration.clientEmail,
      key: configuration.privateKey,
      scopes: [GOOGLE_SHEETS_SCOPE],
    });
  }

  const accessToken = await cachedJwtClient.getAccessToken();
  if (!accessToken.token) throw new Error("Google authorization returned no access token.");
  return accessToken.token;
}

export async function appendMarketingLeadToGoogleSheets(
  lead: MarketingLeadRecord,
  dependencies: GoogleSheetsLeadDependencies = {},
): Promise<void> {
  const configuration = readGoogleSheetsLeadConfiguration(dependencies.environment ?? process.env);
  const authorize = dependencies.authorize ?? authorizeGoogleSheets;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const timeoutMs = Math.max(1, dependencies.timeoutMs ?? GOOGLE_SHEETS_REQUEST_TIMEOUT_MS);

  let accessToken: string;
  try {
    accessToken = await withTimeout(authorize(configuration), timeoutMs);
  } catch {
    console.error("[marketing-leads] Google Sheets authorization failed.");
    throw unavailableError();
  }

  const endpoint = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(configuration.spreadsheetId)}/values/${encodeURIComponent(GOOGLE_SHEETS_APPEND_RANGE)}:append`,
  );
  endpoint.searchParams.set("valueInputOption", "RAW");
  endpoint.searchParams.set("insertDataOption", "INSERT_ROWS");

  let response: Response;
  const controller = new AbortController();
  try {
    response = await withTimeout(
      fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          majorDimension: "ROWS",
          values: [buildMarketingLeadSheetRow(lead)],
        }),
        signal: controller.signal,
      }),
      timeoutMs,
      () => controller.abort(),
    );
  } catch {
    console.error("[marketing-leads] Google Sheets could not be reached.");
    throw unavailableError();
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    console.error("[marketing-leads] Google Sheets append failed.", { status: response.status });
    throw unavailableError();
  }
}
