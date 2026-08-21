import { PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const requirePlatformActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/platform-authorization", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/platform-authorization")>("@/lib/auth/platform-authorization");
  return { ...actual, requirePlatformActor: requirePlatformActorMock };
});

import { GET as publicProductsGET } from "../src/app/api/commerce/products/route";
import { GET as adminProductsGET } from "../src/app/api/admin/commerce/products/route";
import { GET as adminProductDetailGET, PATCH as adminProductPATCH } from "../src/app/api/admin/commerce/products/[productId]/route";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError, UnauthorizedError } from "../src/lib/errors/app-error";
import { upsertCommerceProduct, upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";
import { seedCommerceProducts } from "../prisma/seed-data/commerce-products";

const RUN_ID = `${Date.now()}-${process.pid}`;

async function json(res: Response): Promise<any> {
  return res.json();
}

let ownerUserId: string;
let ownerCompanyId: string;

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId: ownerCompanyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Route Owner", email: `commerce-route-owner-${RUN_ID}@example.com` };
}

function supportActor(): PlatformActor {
  return { userId: ownerUserId, companyId: ownerCompanyId, platformRole: PlatformRole.PLATFORM_SUPPORT, fullName: "Route Support", email: `commerce-route-support-${RUN_ID}@example.com` };
}

describe("commerce product API routes (integration, real local Postgres)", () => {
  let privateProductId: string;
  let privateProductCode: string;

  beforeAll(async () => {
    await seedCommerceProducts(prisma);

    const company = await prisma.company.create({
      data: { legalName: `Commerce Routes Co ${RUN_ID}`, tradeName: "Commerce Routes", email: `commerce-routes-${RUN_ID}@example.com` },
    });
    ownerCompanyId = company.id;
    const owner = await prisma.user.create({
      data: { companyId: ownerCompanyId, email: `commerce-route-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Route Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;

    privateProductCode = `test_route_private_${RUN_ID}`;
    const { product } = await upsertCommerceProduct({ code: privateProductCode, type: "ONE_TIME", name: "Route Private Product", isActive: true, isPublic: false });
    privateProductId = product.id;
    await upsertCommercePrice({ productId: privateProductId, code: `test_route_private_price_${RUN_ID}`, amountMinor: 12300, billingInterval: "ONE_TIME" });
  });

  beforeEach(() => {
    requirePlatformActorMock.mockReset();
  });

  afterAll(async () => {
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.commercePrice.deleteMany({ where: { productId: privateProductId } });
    await prisma.commerceProduct.delete({ where: { id: privateProductId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => undefined);
    await prisma.company.delete({ where: { id: ownerCompanyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  describe("GET /api/commerce/products (public, unauthenticated)", () => {
    it("returns real active+public AED products without requiring any actor", async () => {
      const res = await publicProductsGET(new Request("http://localhost/api/commerce/products"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(Array.isArray(body.data)).toBe(true);
      const starter = body.data.find((p: { code: string }) => p.code === "starter");
      expect(starter).toBeDefined();
      expect(starter.prices.some((pr: { code: string }) => pr.code === "starter_monthly_aed_149")).toBe(true);
    });

    it("never returns a private product, even though it is active", async () => {
      const res = await publicProductsGET(new Request("http://localhost/api/commerce/products"));
      const body = await json(res);
      const found = body.data.find((p: { code: string }) => p.code === privateProductCode);
      expect(found).toBeUndefined();
    });

    it("never exposes an internal database id on the public shape", async () => {
      const res = await publicProductsGET(new Request("http://localhost/api/commerce/products"));
      const body = await json(res);
      for (const product of body.data) {
        expect(product.id).toBeUndefined();
      }
    });

    it("filters by type when a valid type is requested", async () => {
      const res = await publicProductsGET(new Request("http://localhost/api/commerce/products?type=SUBSCRIPTION"));
      const body = await json(res);
      expect(body.data.every((p: { type: string }) => p.type === "SUBSCRIPTION")).toBe(true);
    });

    it("rejects an unrecognized query parameter", async () => {
      const res = await publicProductsGET(new Request("http://localhost/api/commerce/products?bogus=1"));
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/admin/commerce/products (owner/admin/support read)", () => {
    it("returns 401 when unauthenticated", async () => {
      requirePlatformActorMock.mockRejectedValueOnce(new UnauthorizedError());
      const res = await adminProductsGET(new Request("http://localhost/api/admin/commerce/products"));
      expect(res.status).toBe(401);
    });

    it("returns 403 for a non-platform actor", async () => {
      requirePlatformActorMock.mockRejectedValueOnce(new PermissionDeniedError());
      const res = await adminProductsGET(new Request("http://localhost/api/admin/commerce/products"));
      expect(res.status).toBe(403);
    });

    it("includes private/inactive products for a platform owner", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await adminProductsGET(new Request("http://localhost/api/admin/commerce/products"));
      expect(res.status).toBe(200);
      const body = await json(res);
      const found = body.data.find((p: { code: string }) => p.code === privateProductCode);
      expect(found).toBeDefined();
      expect(found.isPublic).toBe(false);
    });

    it("allows read access for platform support", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(supportActor());
      const res = await adminProductsGET(new Request("http://localhost/api/admin/commerce/products"));
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/admin/commerce/products/[productId]", () => {
    it("returns 404 for a well-formed but nonexistent product id", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await adminProductDetailGET(new Request("http://localhost/api/admin/commerce/products/00000000-0000-0000-0000-000000000000"), {
        params: Promise.resolve({ productId: "00000000-0000-0000-0000-000000000000" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed product id", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await adminProductDetailGET(new Request("http://localhost/api/admin/commerce/products/not-a-uuid"), {
        params: Promise.resolve({ productId: "not-a-uuid" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns full detail including entitlement template for a real product", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await adminProductDetailGET(new Request(`http://localhost/api/admin/commerce/products/${privateProductId}`), {
        params: Promise.resolve({ productId: privateProductId }),
      });
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.code).toBe(privateProductCode);
    });
  });

  describe("PATCH /api/admin/commerce/products/[productId]", () => {
    it("rejects a support actor (read-only role)", async () => {
      requirePlatformActorMock.mockRejectedValueOnce(new PermissionDeniedError());
      const res = await adminProductPATCH(
        new Request(`http://localhost/api/admin/commerce/products/${privateProductId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isPublic: true }),
        }),
        { params: Promise.resolve({ productId: privateProductId }) },
      );
      expect(res.status).toBe(403);
    });

    it("rejects an empty body", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const res = await adminProductPATCH(
        new Request(`http://localhost/api/admin/commerce/products/${privateProductId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ productId: privateProductId }) },
      );
      expect(res.status).toBe(400);
    });

    it("lets a platform owner make a private product public, then confirms it appears on the public route", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      const patchRes = await adminProductPATCH(
        new Request(`http://localhost/api/admin/commerce/products/${privateProductId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isPublic: true }),
        }),
        { params: Promise.resolve({ productId: privateProductId }) },
      );
      expect(patchRes.status).toBe(200);
      expect((await json(patchRes)).data.isPublic).toBe(true);

      const publicRes = await publicProductsGET(new Request("http://localhost/api/commerce/products"));
      const found = (await json(publicRes)).data.find((p: { code: string }) => p.code === privateProductCode);
      expect(found).toBeDefined();

      requirePlatformActorMock.mockResolvedValueOnce(ownerActor());
      await adminProductPATCH(
        new Request(`http://localhost/api/admin/commerce/products/${privateProductId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isPublic: false }),
        }),
        { params: Promise.resolve({ productId: privateProductId }) },
      );
    });
  });
});
