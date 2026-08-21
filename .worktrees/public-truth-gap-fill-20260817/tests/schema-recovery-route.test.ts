import { readFileSync } from "node:fs";
import path from "node:path";
import { PlatformRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The production schema recovery (six migrations, 43/43/0 verified) has
 * already run successfully. POST is now permanently disabled — these tests
 * replace the old migration-gate coverage (wrong database, global
 * unfinished, refund guard, core-count drift, clean-semantics), which no
 * longer applies since POST never touches the database anymore.
 */

const requirePlatformActorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/platform-authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/platform-authorization")>();
  return { ...actual, requirePlatformActor: requirePlatformActorMock };
});

import { PlatformAuthorizationError } from "../src/lib/auth/platform-authorization";

const OWNER_ACTOR = {
  userId: "00000000-0000-4000-8000-000000000001",
  companyId: "00000000-0000-4000-8000-000000000002",
  platformRole: PlatformRole.PLATFORM_OWNER,
  fullName: "Owner",
  email: "owner@example.com",
};

describe("POST /api/admin/system-health/schema-recovery — permanently disabled", () => {
  beforeEach(() => {
    requirePlatformActorMock.mockReset();
  });

  it("returns 410 SCHEMA_RECOVERY_DISABLED for a PLATFORM_OWNER", async () => {
    requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
    const { POST } = await import("../src/app/api/admin/system-health/schema-recovery/route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toMatchObject({ ok: false, error: { code: "SCHEMA_RECOVERY_DISABLED" } });
  });

  it("still denies a non-owner before reaching the disabled check", async () => {
    requirePlatformActorMock.mockRejectedValue(
      new PlatformAuthorizationError("This account does not have platform access.", "PLATFORM_ROLE_NOT_ALLOWED"),
    );
    const { POST } = await import("../src/app/api/admin/system-health/schema-recovery/route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ ok: false, error: { code: "PERMISSION_DENIED" } });
  });

  it("requires PLATFORM_OWNER specifically", async () => {
    requirePlatformActorMock.mockResolvedValue(OWNER_ACTOR);
    const { POST } = await import("../src/app/api/admin/system-health/schema-recovery/route");

    await POST();

    expect(requirePlatformActorMock).toHaveBeenCalledWith([PlatformRole.PLATFORM_OWNER]);
  });
});

describe("schema-recovery route source — POST never references Pool/pg", () => {
  it("the disabled POST handler contains no Pool construction or database connection", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/app/api/admin/system-health/schema-recovery/route.ts"),
      "utf8",
    );
    const postBody = source.slice(source.indexOf("export async function POST()"));
    expect(postBody).not.toContain("new Pool");
    expect(postBody).not.toContain("pool.connect");
    expect(postBody).not.toContain("client.query");
  });
});
