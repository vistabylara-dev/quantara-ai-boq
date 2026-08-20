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

    // item-D (Round 3 correction) — the public catalogue route now excludes
    // any price still REQUIRES_REVIEW (see toPublicCommerceProductDTO). This
    // anchor SKU's price is otherwise never routed through the governed
    // approval flow in this suite, so approve it directly here (a
    // test-database-only fixture write, not a production approval) so the
    // "public route returns real active+public AED products" assertion
    // below continues to reflect a real, approved catalogue entry.
    await prisma.commercePrice.updateMany({
      where: { code: "starter_monthly_aed_149" },
      data: { reviewStatus: "APPROVED" },
    });

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
    // v4 gate 1 — reset the REAL, shared, never-deleted enterprise_core
    // anchor price BEFORE deleting ownerUserId below — reviewedByUserId's
    // FK is onDelete: SetNull, so deleting the user first would silently
    // leave it APPROVED with a null reviewer, corrupting the governance
    // invariant commerce-product-service.test.ts's byte-for-byte guard test
    // checks on this same row.
    await prisma.commercePrice.updateMany({
      where: { code: { in: ["enterprise_core_annual_aed_15000", "enterprise_scale_annual_aed_25000", "enterprise_authority_annual_aed_35000"] } },
      data: { reviewStatus: "REQUIRES_REVIEW", reviewedByUserId: null, reviewedAt: null },
    });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.commercePrice.deleteMany({ where: { productId: privateProductId } });
    await prisma.commerceProduct.delete({ where: { id: privateProductId } }).catch(() => undefined);
    await prisma.commercePrice.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
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

    it("item-D: a REQUIRES_REVIEW price is absent from the public projection, and appears once APPROVED", async () => {
      const productCode = `test_route_review_gate_${RUN_ID}`;
      const priceCode = `test_route_review_gate_price_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "SUBSCRIPTION", name: "Review Gate Product", purchaseMode: "DIRECT", isActive: true, isPublic: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: priceCode, amountMinor: 5000, billingInterval: "MONTH" });

      // Freshly created — never approved. reviewStatus defaults to
      // REQUIRES_REVIEW (see prisma/schema.prisma), so the price must not be
      // published yet, even though the product itself is active+public.
      const beforeApproval = await publicProductsGET(new Request("http://localhost/api/commerce/products"));
      const beforeBody = await json(beforeApproval);
      const beforeProduct = beforeBody.data.find((p: { code: string }) => p.code === productCode);
      expect(beforeProduct).toBeDefined();
      expect(beforeProduct.prices.some((pr: { code: string }) => pr.code === priceCode)).toBe(false);

      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });

      const afterApproval = await publicProductsGET(new Request("http://localhost/api/commerce/products"));
      const afterBody = await json(afterApproval);
      const afterProduct = afterBody.data.find((p: { code: string }) => p.code === productCode);
      expect(afterProduct).toBeDefined();
      expect(afterProduct.prices.some((pr: { code: string }) => pr.code === priceCode)).toBe(true);
    });

    it("v4 gate 1: an APPROVED enterprise_core annual price never exposes its amountMinor or price code through GET /api/commerce/products, while an approved Starter price still does", async () => {
      await seedCommerceProducts(prisma);
      const enterpriseStub = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "enterprise_core" }, include: { prices: true } });
      expect(enterpriseStub.purchaseMode).toBe("CONTACT_SALES");
      const annualPrice = enterpriseStub.prices.find((p) => p.billingInterval === "YEAR" && p.isActive);
      expect(annualPrice).toBeDefined();
      await prisma.commercePrice.update({ where: { id: annualPrice!.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId } });
      await prisma.commercePrice.updateMany({ where: { code: "starter_monthly_aed_149" }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId } });

      const res = await publicProductsGET(new Request("http://localhost/api/commerce/products"));
      const body = await json(res);

      const enterpriseCore = body.data.find((p: { code: string }) => p.code === "enterprise_core");
      // Product metadata stays public...
      expect(enterpriseCore).toBeDefined();
      expect(enterpriseCore.purchaseMode).toBe("CONTACT_SALES");
      // ...but the approved annual price is withheld entirely — no price code, no amount.
      expect(enterpriseCore.prices).toHaveLength(0);
      expect(JSON.stringify(body.data)).not.toContain(annualPrice!.code);
      expect(JSON.stringify(body.data)).not.toContain(String(annualPrice!.amountMinor));

      // Starter — a non-redacted, non-Enterprise product — is entirely unaffected.
      const starter = body.data.find((p: { code: string }) => p.code === "starter");
      expect(starter).toBeDefined();
      const starterMonthly = starter.prices.find((p: { code: string }) => p.code === "starter_monthly_aed_149");
      expect(starterMonthly).toBeDefined();
      expect(starterMonthly.amountMinor).toBe(14900);
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
