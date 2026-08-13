import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "@/lib/auth/current-actor";

const { createInquiry, currentActor } = vi.hoisted(() => ({
  createInquiry: vi.fn(),
  currentActor: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    salesInquiry: {
      create: createInquiry,
    },
  },
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActorOrNull: currentActor,
}));

import { POST } from "@/app/api/contact/route";

const actor: CurrentActor = {
  userId: "server-user-123",
  companyId: "server-company-456",
  role: "COMPANY_OWNER",
  fullName: "Noura Al Mansoori",
  email: "noura@example.com",
};

const supportPayload = {
  kind: "SUPPORT",
  requestType: "PROBLEM",
  title: "Review screen is not loading",
  description: "The reviewed items section remains empty after opening the BOQ.",
  goal: "Continue reviewing items without sending confidential project data.",
  email: "noura@example.com",
  company: "Example QS",
  consent: true,
  context: {
    currentRoute: "/projects/project-123/boq",
    surface: "SAAS",
    locale: "en",
  },
  website: "",
};

function contactRequest(
  payload: unknown,
  options: { origin?: string; contentType?: string } = {},
) {
  return new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: {
      "content-type": options.contentType ?? "application/json",
      ...(options.origin ? { origin: options.origin } : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function body(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

describe("POST /api/contact support contract", () => {
  beforeEach(() => {
    createInquiry.mockReset();
    currentActor.mockReset();
    currentActor.mockResolvedValue(actor);
    createInquiry.mockResolvedValue({ id: "stored-request-123" });
  });

  it("rejects non-JSON and cross-origin requests before actor lookup or database access", async () => {
    const unsupported = await POST(contactRequest(supportPayload, { contentType: "text/plain" }));
    expect(unsupported.status).toBe(415);
    expect(await body(unsupported)).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });

    const crossOrigin = await POST(
      contactRequest(supportPayload, { origin: "https://attacker.example" }),
    );
    expect(crossOrigin.status).toBe(403);
    expect(await body(crossOrigin)).toMatchObject({
      ok: false,
      error: { code: "INVALID_ORIGIN" },
    });
    expect(currentActor).not.toHaveBeenCalled();
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("strictly rejects client identity, timestamps, tokens and query-bearing routes without a write", async () => {
    const rejectedBodies = [
      { ...supportPayload, userId: "client-user" },
      { ...supportPayload, companyId: "client-company" },
      { ...supportPayload, submittedAt: "2026-08-13T00:00:00.000Z" },
      { ...supportPayload, token: "secret" },
      { ...supportPayload, cookie: "secret" },
      { ...supportPayload, consent: false },
      {
        ...supportPayload,
        context: { ...supportPayload.context, currentRoute: "/dashboard?token=secret" },
      },
      {
        ...supportPayload,
        context: { ...supportPayload.context, projectId: "client-project" },
      },
    ];

    for (const rejected of rejectedBodies) {
      const response = await POST(contactRequest(rejected));
      expect(response.status).toBe(400);
      expect(await body(response)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
    }
    expect(currentActor).not.toHaveBeenCalled();
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("creates exactly one safe record and derives actor IDs and time on the server", async () => {
    const before = Date.now();
    const response = await POST(
      contactRequest(supportPayload, { origin: "http://localhost:3000" }),
    );
    const after = Date.now();

    expect(response.status).toBe(201);
    expect(await body(response)).toEqual({
      ok: true,
      data: { requestId: "stored-request-123", deliveryStatus: "stored" },
    });
    expect(currentActor).toHaveBeenCalledTimes(1);
    expect(createInquiry).toHaveBeenCalledTimes(1);

    const call = createInquiry.mock.calls[0][0] as {
      data: Record<string, unknown>;
      select: Record<string, boolean>;
    };
    expect(call.select).toEqual({ id: true });
    expect(call.data).toMatchObject({
      firstName: "Noura",
      lastName: "Al Mansoori",
      workEmail: supportPayload.email,
      companySize: supportPayload.company,
      useCase: `[PROBLEM] ${supportPayload.title}`,
      preferredContactMethod: "Email",
      consent: true,
      deliveryStatus: "stored",
    });

    const details = JSON.parse(call.data.integrationRequirements as string);
    expect(Object.keys(details).sort()).toEqual(["company", "context", "description", "goal", "kind"]);
    expect(details).toMatchObject({
      kind: "SUPPORT",
      description: supportPayload.description,
      goal: supportPayload.goal,
      company: supportPayload.company,
      context: {
        currentRoute: supportPayload.context.currentRoute,
        surface: "SAAS",
        locale: "en",
        userId: actor.userId,
        companyId: actor.companyId,
      },
    });
    const submittedAt = new Date(details.context.submittedAt).getTime();
    expect(submittedAt).toBeGreaterThanOrEqual(before);
    expect(submittedAt).toBeLessThanOrEqual(after);
    expect(JSON.stringify(call.data)).not.toContain("client-user");
    expect(JSON.stringify(call.data)).not.toContain("client-company");
  });
});
