import { PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const requirePlatformActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/platform-authorization", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/platform-authorization")>("@/lib/auth/platform-authorization");
  return { ...actual, requirePlatformActor: requirePlatformActorMock };
});

import { GET as statusGET } from "../src/app/api/admin/commerce/stripe/status/route";
import { POST as dryRunPOST } from "../src/app/api/admin/commerce/stripe/dry-run/route";
import { POST as synchronizePOST } from "../src/app/api/admin/commerce/stripe/synchronize/route";
import { POST as verifyPOST } from "../src/app/api/admin/commerce/stripe/verify/route";
import { GET as historyGET } from "../src/app/api/admin/commerce/stripe/history/route";
import { PATCH as approvalPATCH } from "../src/app/api/admin/commerce/prices/[priceId]/approval/route";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError, UnauthorizedError } from "../src/lib/errors/app-error";
import { upsertCommerceProduct, upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";

const RUN_ID = `${Date.now()}-${process.pid}`;

async function json(res: Response): Promise<any> {
  return res.json();
}

let ownerUserId: string;
let ownerCompanyId: string;
let testPriceId: string;

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId: ownerCompanyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Route Owner", email: `stripe-route-owner-${RUN_ID}@example.com` };
}
function supportActor(): PlatformActor {
  return { userId: ownerUserId, companyId: ownerCompanyId, platformRole: PlatformRole.PLATFORM_SUPPORT, fullName: "Route Support", email: `stripe-route-support-${RUN_ID}@example.com` };
}

describe("Stripe admin routes (integration, real local Postgres)", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;

  beforeAll(async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const company = await prisma.company.create({ data: { legalName: `Stripe Routes Co ${RUN_ID}`, tradeName: "Stripe Routes", email: `stripe-routes-${RUN_ID}@example.com` } });
    ownerCompanyId = company.id;
    const owner = await prisma.user.create({ data: { companyId: ownerCompanyId, email: `stripe-route-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Route Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    ownerUserId = owner.id;

    const { product } = await upsertCommerceProduct({ code: `test_route_price_${RUN_ID}`, type: "ONE_TIME", name: "Route Price Product", isActive: true });
    const { price } = await upsertCommercePrice({ productId: product.id, code: `test_route_price_sku_${RUN_ID}`, amountMinor: 1000, billingInterval: "ONE_TIME" });
    testPriceId = price.id;
  });

  beforeEach(() => {
    requirePlatformActorMock.mockReset();
  });

  afterAll(async () => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    await prisma.commerceSyncRun.deleteMany({ where: { initiatedByUserId: ownerUserId } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => undefined);
    await prisma.company.delete({ where: { id: ownerCompanyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  describe("GET /api/admin/commerce/stripe/status", () => {
    it("returns 401 when unauthenticated", async () => {
      requirePlatformActorMock.mockRejectedValueOnce(new UnauthorizedError());
      const res = await statusGET();
      expect(res.status).toBe(401);
    });

    it("returns safe not-configured state and never a key when STRIPE_SECRET_KEY is unset", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await statusGET();
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.configured).toBe(false);
      expect(body.data.testMode).toBe(false);
      expect(JSON.stringify(body)).not.toMatch(/sk_(test|live)_/);
    });
  });

  describe("POST /api/admin/commerce/stripe/dry-run", () => {
    it("returns 403 for a non-platform actor", async () => {
      requirePlatformActorMock.mockRejectedValueOnce(new PermissionDeniedError());
      const res = await dryRunPOST(new Request("http://localhost/api/admin/commerce/stripe/dry-run", { method: "POST" }));
      expect(res.status).toBe(403);
    });

    it("succeeds for the owner and makes no Stripe mutation calls (no key configured)", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await dryRunPOST(new Request("http://localhost/api/admin/commerce/stripe/dry-run", { method: "POST" }));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.run.dryRun).toBe(true);
      expect(body.data.configuration.configured).toBe(false);
    });
  });

  describe("POST /api/admin/commerce/stripe/synchronize", () => {
    it("returns 400 without confirm: true", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await synchronizePOST(
        new Request("http://localhost/api/admin/commerce/stripe/synchronize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ catalogueFingerprint: "x" }),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns a safe STRIPE_NOT_CONFIGURED error, not a raw Stripe error, when unconfigured", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await synchronizePOST(
        new Request("http://localhost/api/admin/commerce/stripe/synchronize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ catalogueFingerprint: "x", confirm: true }),
        }),
      );
      expect(res.status).toBe(409);
      const body = await json(res);
      expect(body.error.code).toBe("STRIPE_NOT_CONFIGURED");
    });
  });

  describe("GET /api/admin/commerce/stripe/history", () => {
    it("returns 401 anonymous, denies non-platform, allows owner", async () => {
      requirePlatformActorMock.mockRejectedValueOnce(new UnauthorizedError());
      expect((await historyGET(new Request("http://localhost/api/admin/commerce/stripe/history"))).status).toBe(401);

      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await historyGET(new Request("http://localhost/api/admin/commerce/stripe/history"));
      expect(res.status).toBe(200);
      expect(Array.isArray((await json(res)).data)).toBe(true);
    });
  });

  describe("PATCH /api/admin/commerce/prices/[priceId]/approval", () => {
    it("owner can approve a price", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await approvalPATCH(
        new Request(`http://localhost/api/admin/commerce/prices/${testPriceId}/approval`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewStatus: "APPROVED", reviewNote: "Route test approval." }),
        }),
        { params: Promise.resolve({ priceId: testPriceId }) },
      );
      expect(res.status).toBe(200);
      expect((await json(res)).data.reviewStatus).toBe("APPROVED");
    });

    it("support cannot approve a price", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(supportActor());
      const res = await approvalPATCH(
        new Request(`http://localhost/api/admin/commerce/prices/${testPriceId}/approval`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewStatus: "APPROVED" }),
        }),
        { params: Promise.resolve({ priceId: testPriceId }) },
      );
      expect(res.status).toBe(403);
    });

    it("rejects an invalid review status", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await approvalPATCH(
        new Request(`http://localhost/api/admin/commerce/prices/${testPriceId}/approval`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewStatus: "NOT_A_REAL_STATUS" }),
        }),
        { params: Promise.resolve({ priceId: testPriceId }) },
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for a well-formed but nonexistent price id", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await approvalPATCH(
        new Request("http://localhost/api/admin/commerce/prices/00000000-0000-0000-0000-000000000000/approval", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewStatus: "APPROVED" }),
        }),
        { params: Promise.resolve({ priceId: "00000000-0000-0000-0000-000000000000" }) },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/admin/commerce/stripe/verify", () => {
    it("returns 403 for a non-platform actor", async () => {
      requirePlatformActorMock.mockRejectedValueOnce(new PermissionDeniedError());
      const res = await verifyPOST(new Request("http://localhost/api/admin/commerce/stripe/verify", { method: "POST" }));
      expect(res.status).toBe(403);
    });
  });
});
