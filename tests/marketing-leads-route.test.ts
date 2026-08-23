import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { AppError } from "@/lib/errors/app-error";

const { appendLead, currentActor } = vi.hoisted(() => ({
  appendLead: vi.fn(),
  currentActor: vi.fn(),
}));

vi.mock("@/lib/integrations/connectors/google-sheets-lead-client", () => ({
  appendMarketingLeadToGoogleSheets: appendLead,
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActorOrNull: currentActor,
}));

import { POST } from "@/app/api/marketing/leads/route";

const actor: CurrentActor = {
  userId: "user-quantara-123",
  companyId: "company-quantara-456",
  role: "COMPANY_OWNER",
  fullName: "Aisha Al Mansoori",
  email: "aisha@example.com",
};

function payload(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "  Aisha Al Mansoori  ",
    email: "  AISHA@EXAMPLE.COM  ",
    mobile: "050 123 4567",
    company: "Quantara Test Contracting",
    industry: "Construction & Contracting",
    packageInterest: "Quantara Professional",
    page: "/pricing",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "dubai-boq",
    marketingConsent: true,
    website: "",
    ...overrides,
  };
}

function request(
  body: unknown,
  options: { ip?: string; origin?: string; contentType?: string } = {},
) {
  return new Request("http://localhost:3000/api/marketing/leads", {
    method: "POST",
    headers: {
      "content-type": options.contentType ?? "application/json",
      "x-forwarded-for": options.ip ?? `198.51.100.${Math.floor(Math.random() * 100) + 1}`,
      ...(options.origin ? { origin: options.origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function responseBody(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

describe("POST /api/marketing/leads", () => {
  beforeEach(() => {
    appendLead.mockReset();
    appendLead.mockResolvedValue(undefined);
    currentActor.mockReset();
    currentActor.mockResolvedValue(null);
  });

  it("accepts a valid lead, normalizes email/mobile, captures package and UTM context, and derives server fields", async () => {
    currentActor.mockResolvedValue(actor);
    const before = Date.now();
    const response = await POST(request(payload(), { ip: "198.51.100.10", origin: "http://localhost:3000" }));
    const after = Date.now();

    expect(response.status).toBe(201);
    expect(await responseBody(response)).toEqual({ ok: true, data: { received: true } });
    expect(appendLead).toHaveBeenCalledTimes(1);

    const lead = appendLead.mock.calls[0][0] as Record<string, unknown>;
    expect(lead).toMatchObject({
      fullName: "Aisha Al Mansoori",
      email: "aisha@example.com",
      mobile: "+971501234567",
      company: "Quantara Test Contracting",
      industry: "Construction & Contracting",
      packageInterest: "Quantara Professional",
      page: "/pricing",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "dubai-boq",
      userId: actor.userId,
      marketingConsent: true,
      status: "NEW",
    });
    const submittedAt = new Date(lead.submittedAt as string).getTime();
    expect(submittedAt).toBeGreaterThanOrEqual(before);
    expect(submittedAt).toBeLessThanOrEqual(after);
  });

  it.each(["fullName", "email", "mobile", "industry"])(
    "rejects a missing required %s without calling Google Sheets",
    async (field) => {
      const invalid = payload();
      delete invalid[field as keyof typeof invalid];
      const response = await POST(request(invalid, { ip: `198.51.101.${field.length}` }));
      expect(response.status).toBe(400);
      expect(await responseBody(response)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(appendLead).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid email, malformed mobile, query-bearing page, and missing consent", async () => {
    const invalidBodies = [
      payload({ email: "not-an-email" }),
      payload({ mobile: "call-me" }),
      payload({ page: "/pricing?token=must-not-be-stored" }),
      payload({ marketingConsent: false }),
    ];

    for (let index = 0; index < invalidBodies.length; index += 1) {
      const response = await POST(request(invalidBodies[index], { ip: `198.51.102.${index + 1}` }));
      expect(response.status).toBe(400);
      expect(await responseBody(response)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
    }
    expect(appendLead).not.toHaveBeenCalled();
  });

  it("strictly rejects client-supplied identity, timestamp, status, and credential fields", async () => {
    const forbidden = [
      payload({ userId: "forged-user" }),
      payload({ submittedAt: "2026-08-23T00:00:00.000Z" }),
      payload({ status: "QUALIFIED" }),
      payload({ privateKey: "secret" }),
    ];

    for (let index = 0; index < forbidden.length; index += 1) {
      const response = await POST(request(forbidden[index], { ip: `198.51.103.${index + 1}` }));
      expect(response.status).toBe(400);
    }
    expect(appendLead).not.toHaveBeenCalled();
  });

  it("returns a controlled error for Google Sheets failure and allows a safe retry", async () => {
    const safeError = new AppError(
      "MARKETING_LEAD_DELIVERY_UNAVAILABLE",
      "We could not receive your request right now. Please try again shortly.",
      503,
    );
    appendLead.mockRejectedValueOnce(safeError).mockResolvedValueOnce(undefined);
    const body = payload({ email: "retry@example.com", mobile: "+971501234568" });

    const failed = await POST(request(body, { ip: "198.51.100.20" }));
    expect(failed.status).toBe(503);
    const failedBody = await responseBody(failed);
    expect(failedBody).toMatchObject({
      ok: false,
      error: { code: "MARKETING_LEAD_DELIVERY_UNAVAILABLE" },
    });
    expect(JSON.stringify(failedBody)).not.toMatch(/private|spreadsheet|credential|token/i);

    const retried = await POST(request(body, { ip: "198.51.100.20" }));
    expect(retried.status).toBe(201);
    expect(appendLead).toHaveBeenCalledTimes(2);
  });

  it("rejects an identical rapid submission and appends it only once", async () => {
    const duplicate = payload({ email: "duplicate@example.com", mobile: "+971501234569" });
    const first = await POST(request(duplicate, { ip: "198.51.100.30" }));
    const second = await POST(request(duplicate, { ip: "198.51.100.30" }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(await responseBody(second)).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_LEAD_SUBMISSION" },
    });
    expect(appendLead).toHaveBeenCalledTimes(1);
  });

  it("applies the existing per-instance IP abuse limiter", async () => {
    const ip = "198.51.100.40";
    for (let index = 0; index < 5; index += 1) {
      const response = await POST(request(payload({
        email: `rate-${index}@example.com`,
        mobile: `+9715012346${String(index).padStart(2, "0")}`,
      }), { ip }));
      expect(response.status).toBe(201);
    }

    const blocked = await POST(request(payload({
      email: "rate-blocked@example.com",
      mobile: "+971501234699",
    }), { ip }));
    expect(blocked.status).toBe(429);
    expect(await responseBody(blocked)).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
  });

  it("keeps authenticated users on separate limiter keys behind a shared IP", async () => {
    const sharedIp = "198.51.100.50";
    currentActor.mockResolvedValue({ ...actor, userId: "user-rate-a" });
    for (let index = 0; index < 5; index += 1) {
      const response = await POST(request(payload({
        email: `authenticated-a-${index}@example.com`,
        mobile: `+9715012350${String(index).padStart(2, "0")}`,
      }), { ip: sharedIp }));
      expect(response.status).toBe(201);
    }

    currentActor.mockResolvedValue({ ...actor, userId: "user-rate-b" });
    const otherUser = await POST(request(payload({
      email: "authenticated-b@example.com",
      mobile: "+971501235099",
    }), { ip: sharedIp }));
    expect(otherUser.status).toBe(201);
  });
});
