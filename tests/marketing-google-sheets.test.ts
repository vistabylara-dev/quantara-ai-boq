import { afterEach, describe, expect, it, vi } from "vitest";
import { appendMarketingLeadToGoogleSheets } from "@/lib/integrations/connectors/google-sheets-lead-client";
import { readGoogleSheetsLeadConfiguration } from "@/lib/integrations/connectors/google-sheets-lead-client";
import {
  MARKETING_LEAD_SHEET_COLUMNS,
  buildMarketingLeadSheetRow,
  type MarketingLeadRecord,
} from "@/lib/marketing/lead-capture";

const escapedPrivateKey = "-----BEGIN PRIVATE KEY-----\\ntest-key-material\\n-----END PRIVATE KEY-----\\n";
const environment = {
  GOOGLE_SHEETS_CLIENT_EMAIL: "quantara-leads@example-project.iam.gserviceaccount.com",
  GOOGLE_SHEETS_PRIVATE_KEY: escapedPrivateKey,
  GOOGLE_SHEETS_SPREADSHEET_ID: "1AbCdEfGhIjKlMnOpQrStUvWxYz_123456789",
};

const lead: MarketingLeadRecord = {
  submittedAt: "2026-08-23T12:34:56.000Z",
  fullName: "Aisha Al Mansoori",
  email: "aisha@example.com",
  mobile: "+971501234567",
  company: "Example Contracting",
  industry: "Construction & Contracting",
  packageInterest: "Quantara Professional",
  page: "/pricing",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "dubai-boq",
  userId: "user-123",
  marketingConsent: true,
  status: "NEW",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Google Sheets marketing lead append", () => {
  it("defines and builds the exact 14-column operator row", () => {
    expect(MARKETING_LEAD_SHEET_COLUMNS).toEqual([
      "Date",
      "Name",
      "Email",
      "Mobile",
      "Company",
      "Industry",
      "Package Interest",
      "Page",
      "UTM Source",
      "UTM Medium",
      "UTM Campaign",
      "User ID",
      "Consent",
      "Status",
    ]);
    expect(buildMarketingLeadSheetRow(lead)).toEqual([
      "2026-08-23T12:34:56.000Z",
      "Aisha Al Mansoori",
      "aisha@example.com",
      "+971501234567",
      "Example Contracting",
      "Construction & Contracting",
      "Quantara Professional",
      "/pricing",
      "google",
      "cpc",
      "dubai-boq",
      "user-123",
      true,
      "NEW",
    ]);
  });

  it("normalizes escaped private-key newlines and appends exactly one RAW A:N row", async () => {
    const authorize = vi.fn().mockResolvedValue("server-only-access-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updates: { updatedRows: 1 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await appendMarketingLeadToGoogleSheets(lead, {
      environment,
      authorize,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(authorize).toHaveBeenCalledTimes(1);
    const configuration = authorize.mock.calls[0][0] as Record<string, string>;
    expect(configuration.clientEmail).toBe(environment.GOOGLE_SHEETS_CLIENT_EMAIL);
    expect(configuration.privateKey).toContain("\ntest-key-material\n");
    expect(configuration.privateKey).not.toContain("\\n");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [rawUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const url = new URL(rawUrl);
    expect(url.origin).toBe("https://sheets.googleapis.com");
    expect(decodeURIComponent(url.pathname)).toContain(`/values/A:N:append`);
    expect(url.searchParams.get("valueInputOption")).toBe("RAW");
    expect(url.searchParams.get("insertDataOption")).toBe("INSERT_ROWS");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer server-only-access-token");
    expect(JSON.parse(init.body as string)).toEqual({
      majorDimension: "ROWS",
      values: [buildMarketingLeadSheetRow(lead)],
    });
  });

  it("accepts Vercel-safe JSON-quoted PEM and service-account JSON values", () => {
    const pem = escapedPrivateKey.replace(/\\n/g, "\n");
    const jsonQuoted = readGoogleSheetsLeadConfiguration({
      ...environment,
      GOOGLE_SHEETS_PRIVATE_KEY: JSON.stringify(pem),
    });
    const serviceAccountJson = readGoogleSheetsLeadConfiguration({
      ...environment,
      GOOGLE_SHEETS_PRIVATE_KEY: JSON.stringify({
        type: "service_account",
        private_key_id: "not-used-as-the-key",
        private_key: pem,
        client_email: environment.GOOGLE_SHEETS_CLIENT_EMAIL,
      }),
    });

    expect(jsonQuoted.privateKey).toBe(pem.trim());
    expect(serviceAccountJson.privateKey).toBe(pem.trim());
  });

  it("rejects a private-key id and logs only the invalid variable name", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => readGoogleSheetsLeadConfiguration({
      ...environment,
      GOOGLE_SHEETS_PRIVATE_KEY: "0123456789abcdef0123456789abcdef01234567",
    })).toThrowError(expect.objectContaining({
      code: "MARKETING_LEAD_DELIVERY_UNAVAILABLE",
      status: 503,
    }));
    expect(consoleError).toHaveBeenCalledWith(
      "[marketing-leads] Google Sheets configuration has an invalid format.",
      { invalid: ["GOOGLE_SHEETS_PRIVATE_KEY"] },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("0123456789abcdef");
  });

  it("uses RAW input so formula-like lead text is never evaluated by Sheets", async () => {
    const formulaLead = { ...lead, fullName: "=HYPERLINK(\"https://attacker.example\")" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await appendMarketingLeadToGoogleSheets(formulaLead, {
      environment,
      authorize: vi.fn().mockResolvedValue("token"),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const [rawUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(new URL(rawUrl).searchParams.get("valueInputOption")).toBe("RAW");
    expect(JSON.parse(init.body as string).values[0][1]).toBe(formulaLead.fullName);
  });

  it("fails closed when configuration is missing without attempting auth or fetch", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const authorize = vi.fn();
    const fetchMock = vi.fn();

    await expect(appendMarketingLeadToGoogleSheets(lead, {
      environment: {
        GOOGLE_SHEETS_CLIENT_EMAIL: "",
        GOOGLE_SHEETS_PRIVATE_KEY: "",
        GOOGLE_SHEETS_SPREADSHEET_ID: "",
      },
      authorize,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })).rejects.toMatchObject({
      code: "MARKETING_LEAD_DELIVERY_UNAVAILABLE",
      status: 503,
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it("converts authorization, network, and provider failures to credential-free errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secret = "provider-secret-private-key";

    const failures = [
      {
        authorize: vi.fn().mockRejectedValue(new Error(secret)),
        fetchImpl: vi.fn() as unknown as typeof fetch,
      },
      {
        authorize: vi.fn().mockResolvedValue("token"),
        fetchImpl: vi.fn().mockRejectedValue(new Error(secret)) as unknown as typeof fetch,
      },
      {
        authorize: vi.fn().mockResolvedValue("token"),
        fetchImpl: vi.fn().mockResolvedValue(new Response(secret, { status: 403 })) as unknown as typeof fetch,
      },
    ];

    for (const dependencies of failures) {
      let caught: unknown;
      try {
        await appendMarketingLeadToGoogleSheets(lead, { environment, ...dependencies });
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({
        code: "MARKETING_LEAD_DELIVERY_UNAVAILABLE",
        status: 503,
      });
      expect(JSON.stringify(caught)).not.toContain(secret);
      expect((caught as Error).message).not.toMatch(/spreadsheet|credential|private|token/i);
    }
  });

  it("aborts a stalled append and returns the same safe delivery error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));

    await expect(appendMarketingLeadToGoogleSheets(lead, {
      environment,
      authorize: vi.fn().mockResolvedValue("token"),
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 5,
    })).rejects.toMatchObject({
      code: "MARKETING_LEAD_DELIVERY_UNAVAILABLE",
      status: 503,
    });
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(requestInit.signal?.aborted).toBe(true);
  });
});
