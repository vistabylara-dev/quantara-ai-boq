import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { UnauthorizedError } from "@/lib/errors/app-error";

const {
  bootstrapPlatformOwner,
  findUser,
  getCurrentActor,
} = vi.hoisted(() => ({
  bootstrapPlatformOwner: vi.fn(),
  findUser: vi.fn(),
  getCurrentActor: vi.fn(),
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUser,
    },
  },
}));

vi.mock("../scripts/bootstrap-platform-owner", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../scripts/bootstrap-platform-owner")
  >();
  return {
    ...actual,
    bootstrapPlatformOwner,
  };
});

import { PlatformOwnerBootstrapError } from "../scripts/bootstrap-platform-owner";
import { POST } from "@/app/api/admin/platform-owner-recovery/route";

const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;
const ORIGINAL_PLATFORM_OWNER_EMAIL = process.env.PLATFORM_OWNER_EMAIL;
const OWNER_EMAIL = "owner@example.com";
let requestSequence = 0;

function actor(overrides: Partial<CurrentActor> = {}): CurrentActor {
  return {
    userId: `owner-user-${requestSequence}`,
    companyId: "controlled-company",
    role: "COMPANY_OWNER",
    fullName: "Controlled Owner",
    email: OWNER_EMAIL,
    ...overrides,
  };
}

function eligibleAccount(
  overrides: Partial<{
    email: string;
    isActive: boolean;
    emailVerifiedAt: Date | null;
  }> = {},
) {
  return {
    email: OWNER_EMAIL,
    isActive: true,
    emailVerifiedAt: new Date("2026-08-31T00:00:00.000Z"),
    ...overrides,
  };
}

function recoveryRequest(
  payload: unknown = { confirm: "BOOTSTRAP_PLATFORM_OWNER" },
  options: { origin?: string | null; ip?: string; contentType?: string } = {},
) {
  const url = "https://quantara.vistabylara.com/api/admin/platform-owner-recovery";
  const origin = options.origin === undefined
    ? "https://quantara.vistabylara.com"
    : options.origin;
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": options.contentType ?? "application/json",
      "x-forwarded-for": options.ip ?? `198.51.100.${requestSequence}`,
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function responseBody(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

describe("POST /api/admin/platform-owner-recovery", () => {
  beforeEach(() => {
    requestSequence += 1;
    process.env.VERCEL_ENV = "production";
    process.env.PLATFORM_OWNER_EMAIL = OWNER_EMAIL;
    getCurrentActor.mockReset();
    findUser.mockReset();
    bootstrapPlatformOwner.mockReset();
    getCurrentActor.mockResolvedValue(actor());
    findUser.mockResolvedValue(eligibleAccount());
    bootstrapPlatformOwner.mockResolvedValue({
      userId: `owner-user-${requestSequence}`,
      email: OWNER_EMAIL,
      changed: true,
    });
  });

  afterAll(() => {
    if (ORIGINAL_VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
    if (ORIGINAL_PLATFORM_OWNER_EMAIL === undefined) {
      delete process.env.PLATFORM_OWNER_EMAIL;
    } else {
      process.env.PLATFORM_OWNER_EMAIL = ORIGINAL_PLATFORM_OWNER_EMAIL;
    }
  });

  it("refuses execution outside Vercel production", async () => {
    process.env.VERCEL_ENV = "preview";

    const response = await POST(recoveryRequest());

    expect(response.status).toBe(403);
    expect(await responseBody(response)).toMatchObject({
      error: { code: "PLATFORM_OWNER_RECOVERY_PRODUCTION_ONLY" },
    });
    expect(getCurrentActor).not.toHaveBeenCalled();
    expect(bootstrapPlatformOwner).not.toHaveBeenCalled();
  });

  it("requires an authenticated application session", async () => {
    getCurrentActor.mockRejectedValue(new UnauthorizedError());

    const response = await POST(recoveryRequest());

    expect(response.status).toBe(401);
    expect(await responseBody(response)).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(bootstrapPlatformOwner).not.toHaveBeenCalled();
  });

  it("requires the explicit confirmation body", async () => {
    const response = await POST(recoveryRequest({ confirm: "WRONG" }));
    const extraFieldResponse = await POST(
      recoveryRequest({
        confirm: "BOOTSTRAP_PLATFORM_OWNER",
        email: OWNER_EMAIL,
      }),
    );

    for (const invalidResponse of [response, extraFieldResponse]) {
      expect(invalidResponse.status).toBe(400);
      expect(await responseBody(invalidResponse)).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
    }
    expect(getCurrentActor).not.toHaveBeenCalled();
    expect(bootstrapPlatformOwner).not.toHaveBeenCalled();
  });

  it("rejects missing and cross-origin requests before session or database access", async () => {
    const missingOrigin = await POST(recoveryRequest(undefined, { origin: null }));
    const crossOrigin = await POST(
      recoveryRequest(undefined, { origin: "https://attacker.example" }),
    );

    for (const response of [missingOrigin, crossOrigin]) {
      expect(response.status).toBe(403);
      expect(await responseBody(response)).toMatchObject({
        error: { code: "INVALID_ORIGIN" },
      });
    }
    expect(getCurrentActor).not.toHaveBeenCalled();
    expect(findUser).not.toHaveBeenCalled();
    expect(bootstrapPlatformOwner).not.toHaveBeenCalled();
  });

  it("refuses a signed-in email different from PLATFORM_OWNER_EMAIL", async () => {
    getCurrentActor.mockResolvedValue(actor({ email: "different@example.com" }));

    const response = await POST(recoveryRequest());

    expect(response.status).toBe(403);
    expect(await responseBody(response)).toMatchObject({
      error: { code: "PLATFORM_OWNER_RECOVERY_EMAIL_MISMATCH" },
    });
    expect(findUser).not.toHaveBeenCalled();
    expect(bootstrapPlatformOwner).not.toHaveBeenCalled();
  });

  it("refuses an inactive authenticated account", async () => {
    findUser.mockResolvedValue(eligibleAccount({ isActive: false }));

    const response = await POST(recoveryRequest());

    expect(response.status).toBe(403);
    expect(await responseBody(response)).toMatchObject({
      error: { code: "PLATFORM_OWNER_RECOVERY_ACCOUNT_INACTIVE" },
    });
    expect(bootstrapPlatformOwner).not.toHaveBeenCalled();
  });

  it("refuses an unverified authenticated email", async () => {
    findUser.mockResolvedValue(eligibleAccount({ emailVerifiedAt: null }));

    const response = await POST(recoveryRequest());

    expect(response.status).toBe(403);
    expect(await responseBody(response)).toMatchObject({
      error: { code: "PLATFORM_OWNER_RECOVERY_EMAIL_UNVERIFIED" },
    });
    expect(bootstrapPlatformOwner).not.toHaveBeenCalled();
  });

  it("refuses a missing or differently-addressed fresh account row", async () => {
    for (const account of [
      null,
      eligibleAccount({ email: "different@example.com" }),
    ]) {
      findUser.mockResolvedValueOnce(account);
      const response = await POST(recoveryRequest());
      expect(response.status).toBe(403);
      expect(await responseBody(response)).toMatchObject({
        error: { code: "PLATFORM_OWNER_RECOVERY_ACCOUNT_MISMATCH" },
      });
    }
    expect(bootstrapPlatformOwner).not.toHaveBeenCalled();
  });

  it("refuses when the bootstrap service detects a conflicting owner", async () => {
    bootstrapPlatformOwner.mockRejectedValue(
      new PlatformOwnerBootstrapError(
        "A different platform owner already exists. Use the authenticated owner workflow for role changes.",
      ),
    );

    const response = await POST(recoveryRequest());

    expect(response.status).toBe(409);
    expect(await responseBody(response)).toMatchObject({
      error: {
        code: "PLATFORM_OWNER_RECOVERY_BLOCKED",
        message: "Platform owner recovery is blocked by the current account state.",
      },
    });
  });

  it("does not expose a bootstrap error message in the response or console", async () => {
    const secretSentinel = "postgresql://user:password@private-host/production";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    bootstrapPlatformOwner.mockRejectedValue(
      new PlatformOwnerBootstrapError(secretSentinel),
    );

    try {
      const response = await POST(recoveryRequest());
      const serialized = JSON.stringify(await responseBody(response));
      expect(response.status).toBe(409);
      expect(serialized).not.toContain(secretSentinel);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("runs the existing bootstrap service once and returns no identity or secret data", async () => {
    const response = await POST(recoveryRequest());

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      ok: true,
      data: {
        recovered: true,
        roleChanged: true,
        status: "completed",
      },
    });
    expect(bootstrapPlatformOwner).toHaveBeenCalledTimes(1);
    expect(bootstrapPlatformOwner).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      OWNER_EMAIL,
      { auditSource: "trusted-runtime-recovery" },
    );
  });

  it("returns an already-completed no-op result on an idempotent rerun", async () => {
    bootstrapPlatformOwner.mockResolvedValue({
      userId: `owner-user-${requestSequence}`,
      email: OWNER_EMAIL,
      changed: false,
    });

    const response = await POST(recoveryRequest());

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      ok: true,
      data: {
        recovered: true,
        roleChanged: false,
        status: "already_completed",
      },
    });
    expect(bootstrapPlatformOwner).toHaveBeenCalledTimes(1);
  });

  it("rate limits repeated requests by authenticated user", async () => {
    const fixedActor = actor({ userId: `rate-limited-user-${requestSequence}` });
    getCurrentActor.mockResolvedValue(fixedActor);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await POST(
        recoveryRequest(undefined, { ip: `203.0.113.${requestSequence}` }),
      );
      expect(response.status).toBe(200);
    }

    const blocked = await POST(
      recoveryRequest(undefined, { ip: `203.0.113.${requestSequence}` }),
    );
    expect(blocked.status).toBe(429);
    expect(await responseBody(blocked)).toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
    expect(bootstrapPlatformOwner).toHaveBeenCalledTimes(3);
  });

  it("rate limits repeated requests by IP even across authenticated users", async () => {
    let actorSequence = 0;
    getCurrentActor.mockImplementation(async () => {
      actorSequence += 1;
      return actor({ userId: `ip-rate-user-${requestSequence}-${actorSequence}` });
    });

    const ip = `192.0.2.${requestSequence}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(recoveryRequest(undefined, { ip }));
      expect(response.status).toBe(200);
    }

    const blocked = await POST(recoveryRequest(undefined, { ip }));
    expect(blocked.status).toBe(429);
    expect(await responseBody(blocked)).toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
    expect(bootstrapPlatformOwner).toHaveBeenCalledTimes(5);
  });

  it("refuses when PLATFORM_OWNER_EMAIL is missing", async () => {
    delete process.env.PLATFORM_OWNER_EMAIL;

    const response = await POST(recoveryRequest());

    expect(response.status).toBe(503);
    expect(await responseBody(response)).toMatchObject({
      error: { code: "PLATFORM_OWNER_RECOVERY_NOT_CONFIGURED" },
    });
    expect(findUser).not.toHaveBeenCalled();
    expect(bootstrapPlatformOwner).not.toHaveBeenCalled();
  });
});
