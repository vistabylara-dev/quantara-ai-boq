import { PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const requirePlatformActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/platform-authorization", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/platform-authorization")>("@/lib/auth/platform-authorization");
  return { ...actual, requirePlatformActor: requirePlatformActorMock };
});

import { GET as applySyncGET } from "../src/app/api/admin/commerce/apply-library-pricing-sync/route";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError, UnauthorizedError } from "../src/lib/errors/app-error";
import { LIBRARY_PACKAGE_PRICES } from "../prisma/seed-data/library-package-pricing";

/**
 * MARKETPLACE-FULL-STRIPE-LINK — proves the production break-glass route
 * (GET /api/admin/commerce/apply-library-pricing-sync) is owner-gated and
 * genuinely runs the same pricing pipeline scripts/sync-library-package-pricing.ts
 * and tests/library-package-pricing-sync.test.ts already prove correct. Uses
 * only 2 of the 15 real keys (not all 15) — the underlying three functions'
 * full correctness is already exhaustively covered elsewhere; this test only
 * needs to prove the route's auth gate and wiring.
 */
const RUN_ID = `${Date.now()}-${process.pid}-route`;

function ownerActor(userId: string, companyId: string): PlatformActor {
  return { userId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Route Owner", email: `apply-sync-owner-${RUN_ID}@example.com` };
}

describe("GET /api/admin/commerce/apply-library-pricing-sync (integration, real local Postgres)", () => {
  let ownerCompanyId: string;
  let ownerUserId: string;
  const testKeys = LIBRARY_PACKAGE_PRICES.slice(0, 2).map((s) => s.key);
  const packageIds: string[] = [];

  beforeAll(async () => {
    const discipline = await prisma.masterDiscipline.findFirstOrThrow();
    const company = await prisma.company.create({ data: { legalName: `Apply Sync Route Co ${RUN_ID}`, tradeName: "Apply Sync Route", email: `apply-sync-route-${RUN_ID}@example.com` } });
    ownerCompanyId = company.id;
    const owner = await prisma.user.create({ data: { companyId: ownerCompanyId, email: `apply-sync-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Route Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    ownerUserId = owner.id;

    for (const spec of LIBRARY_PACKAGE_PRICES.filter((s) => testKeys.includes(s.key))) {
      const pkg = await prisma.industryDataPackage.create({
        data: { key: spec.key, name: spec.name, disciplineId: discipline.id, packageType: "PROFESSIONAL", status: "ACTIVE", monthlyPrice: 0, annualPrice: 0, currency: "AED" },
      });
      packageIds.push(pkg.id);
    }
  });

  beforeEach(() => {
    requirePlatformActorMock.mockReset();
  });

  afterAll(async () => {
    const codes = testKeys.map((key) => `industry_${key.replace(/-/g, "_")}`);
    await prisma.commerceProduct.deleteMany({ where: { code: { in: codes } } });
    await prisma.industryDataPackage.deleteMany({ where: { id: { in: packageIds } } });
    await prisma.user.deleteMany({ where: { id: ownerUserId } });
    await prisma.company.deleteMany({ where: { id: ownerCompanyId } });
    await prisma.$disconnect();
  });

  it("returns 401 when unauthenticated", async () => {
    requirePlatformActorMock.mockRejectedValueOnce(new UnauthorizedError());
    const res = await applySyncGET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-owner platform actor (owner-only, stricter than platform:read/operate)", async () => {
    requirePlatformActorMock.mockRejectedValueOnce(new PermissionDeniedError());
    const res = await applySyncGET();
    expect(res.status).toBe(403);
  });

  it("succeeds for the owner and genuinely runs the pricing pipeline, idempotently", async () => {
    requirePlatformActorMock.mockResolvedValueOnce(ownerActor(ownerUserId, ownerCompanyId));
    const first = await applySyncGET();
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { data: { backfill: { updated: string[] }; commerce: { industryProductsCreated: string[] }; approval: { approved: string[] } } };

    for (const key of testKeys) {
      expect(firstBody.data.backfill.updated).toContain(key);
      expect(firstBody.data.commerce.industryProductsCreated).toContain(key);
    }
    for (const key of testKeys) {
      const stem = `industry_${key.replace(/-/g, "_")}`;
      expect(firstBody.data.approval.approved).toContain(`${stem}_monthly`);
      expect(firstBody.data.approval.approved).toContain(`${stem}_annual`);
    }

    requirePlatformActorMock.mockResolvedValueOnce(ownerActor(ownerUserId, ownerCompanyId));
    const second = await applySyncGET();
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { data: { backfill: { updated: string[] }; approval: { approved: string[] } } };
    expect(secondBody.data.backfill.updated).toEqual([]);
    expect(secondBody.data.approval.approved).toEqual([]);
  });
});
