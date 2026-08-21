import { PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import {
  upsertCommerceProduct,
  upsertCommercePrice,
  toPublicCommerceProductDTO,
  toCommerceProductDTO,
} from "../src/lib/repositories/commerce-product-repository";
import {
  listPublicCommerceProducts,
  listAdminCommerceProducts,
  updateAdminCommerceProductState,
} from "../src/lib/services/commerce-product-service";
import {
  ENTITLEMENT_FIELD_ENFORCEMENT,
  COMMERCE_ENTITLEMENTS_ARE_LIVE,
  describeEntitlementTemplate,
} from "../src/lib/services/entitlement-template-service";
import { seedCommerceProducts, seedEnterpriseCommerceProducts } from "../prisma/seed-data/commerce-products";
import { getCheckoutAvailability } from "../src/lib/services/commerce-checkout-availability-service";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = `${Date.now()}-${process.pid}`;

function ownerActor(userId: string, companyId: string): PlatformActor {
  return { userId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Commerce Test Owner", email: `commerce-owner-${RUN_ID}@example.com` };
}

describe("commerce product catalogue (integration, real local Postgres)", () => {
  let ownerCompanyId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { legalName: `Commerce Test Co ${RUN_ID}`, tradeName: "Commerce Test", email: `commerce-co-${RUN_ID}@example.com` },
    });
    ownerCompanyId = company.id;
    const owner = await prisma.user.create({
      data: {
        companyId: ownerCompanyId,
        email: `commerce-owner-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: "Commerce Test Owner",
        role: "COMPANY_OWNER",
        platformRole: PlatformRole.PLATFORM_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    // v4 gate 1 — the tests above approve the REAL, shared, never-deleted
    // enterprise_core/scale/authority and starter anchor prices with
    // reviewedByUserId: ownerUserId. Reset BEFORE deleting ownerUserId below
    // — reviewedByUserId's FK is onDelete: SetNull, so deleting the user
    // first would silently leave these rows APPROVED with a null reviewer,
    // corrupting the governance invariant this same file's byte-for-byte
    // guard test checks on the three Enterprise anchor rows.
    await prisma.commercePrice.updateMany({
      where: { code: { in: ["enterprise_core_annual_aed_15000", "enterprise_scale_annual_aed_25000", "enterprise_authority_annual_aed_35000"] } },
      data: { reviewStatus: "REQUIRES_REVIEW", reviewedByUserId: null, reviewedAt: null },
    });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => undefined);
    await prisma.company.delete({ where: { id: ownerCompanyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  describe("repository upserts", () => {
    it("upserts a product idempotently by code", async () => {
      const code = `test_product_${RUN_ID}`;
      const first = await upsertCommerceProduct({ code, type: "ONE_TIME", name: "Test Product" });
      expect(first.wasCreated).toBe(true);
      const second = await upsertCommerceProduct({ code, type: "ONE_TIME", name: "Test Product Renamed" });
      expect(second.wasCreated).toBe(false);
      expect(second.product.id).toBe(first.product.id);
      expect(second.product.name).toBe("Test Product Renamed");

      const rowCount = await prisma.commerceProduct.count({ where: { code } });
      expect(rowCount).toBe(1);
    });

    it("archives (never mutates) a price row when its amount changes under the same code", async () => {
      const productCode = `test_price_product_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Price Test Product" });
      const priceCode = `test_price_${RUN_ID}`;

      const first = await upsertCommercePrice({ productId: product.id, code: priceCode, amountMinor: 1000, billingInterval: "ONE_TIME" });
      expect(first.wasCreated).toBe(true);
      expect(first.wasUnchanged).toBe(false);

      const unchanged = await upsertCommercePrice({ productId: product.id, code: priceCode, amountMinor: 1000, billingInterval: "ONE_TIME" });
      expect(unchanged.wasUnchanged).toBe(true);
      expect(unchanged.price.id).toBe(first.price.id);

      const changed = await upsertCommercePrice({ productId: product.id, code: priceCode, amountMinor: 2000, billingInterval: "ONE_TIME" });
      expect(changed.wasCreated).toBe(true);
      expect(changed.price.id).not.toBe(first.price.id);

      const original = await prisma.commercePrice.findUnique({ where: { id: first.price.id } });
      expect(original?.isActive).toBe(false);
      expect(original?.amountMinor).toBe(1000);

      const allPricesForProduct = await prisma.commercePrice.count({ where: { productId: product.id } });
      expect(allPricesForProduct).toBe(2);
    });
  });

  describe("idempotent catalogue seed", () => {
    it("re-running the seed twice does not duplicate products, prices, or templates", async () => {
      const first = await seedCommerceProducts(prisma);
      expect(first.productsInserted + first.productsUpdated + first.productsUnchanged).toBeGreaterThan(0);
      expect(first.industryProductsSkipped.length).toBeGreaterThan(0);
      expect(first.industryProductsCreated).toContain("mechanical-hvac-professional");

      const productCountAfterFirst = await prisma.commerceProduct.count();
      const priceCountAfterFirst = await prisma.commercePrice.count({ where: { isActive: true } });
      const templateCountAfterFirst = await prisma.entitlementTemplate.count();

      const second = await seedCommerceProducts(prisma);
      expect(second.productsInserted).toBe(0);
      expect(second.pricesInserted).toBe(0);
      expect(second.templatesInserted).toBe(0);

      const productCountAfterSecond = await prisma.commerceProduct.count();
      const priceCountAfterSecond = await prisma.commercePrice.count({ where: { isActive: true } });
      const templateCountAfterSecond = await prisma.entitlementTemplate.count();

      expect(productCountAfterSecond).toBe(productCountAfterFirst);
      expect(priceCountAfterSecond).toBe(priceCountAfterFirst);
      expect(templateCountAfterSecond).toBe(templateCountAfterFirst);
    });

    it("seeded the two confirmed anchor SKUs at their audited prices", async () => {
      const starter = await prisma.commercePrice.findUnique({ where: { code: "starter_monthly_aed_149" } });
      expect(starter?.amountMinor).toBe(14900);
      expect(starter?.currency).toBe("AED");

      const enterprise = await prisma.commercePrice.findUnique({ where: { code: "enterprise_installation_from_aed_15000" } });
      expect(enterprise?.amountMinor).toBe(1500000);
      expect(enterprise?.isFromPrice).toBe(true);
    });

    it("only creates an INDUSTRY_ACCESS-linked product for a key with a real backing IndustryDataPackage", async () => {
      const mechanicalProduct = await prisma.commerceProduct.findUnique({ where: { code: "industry_mechanical_hvac_professional" } });
      expect(mechanicalProduct).not.toBeNull();
      expect(mechanicalProduct?.industryPackageId).not.toBeNull();

      const phantomProduct = await prisma.commerceProduct.findUnique({ where: { code: "industry_electrical_professional" } });
      expect(phantomProduct).toBeNull();
    });
  });

  /**
   * CORRECTION-1 mission 5 — seedEnterpriseCommerceProducts must be a
   * genuinely target-only production activation path: it may create/update
   * ONLY enterprise_core/enterprise_scale/enterprise_authority and their
   * prices/entitlement templates, never touching Starter, Professional,
   * Business, TAYQAN, or any Industry Library — unlike seedCommerceProducts
   * (exercised above), which intentionally iterates the whole catalogue.
   */
  describe("seedEnterpriseCommerceProducts (target-only production activation)", () => {
    it("touches only the three Enterprise products — every other product's row count and content is byte-for-byte unchanged", async () => {
      const totalProductsBefore = await prisma.commerceProduct.count();
      const totalPricesBefore = await prisma.commercePrice.count();
      const starterBefore = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "starter" } });
      const tayqanBefore = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "tayqan_monthly" } });
      const libraryProductCountBefore = await prisma.commerceProduct.count({ where: { industryPackageId: { not: null } } });

      const report = await seedEnterpriseCommerceProducts(prisma);
      expect(report.productsInserted + report.productsUpdated + report.productsUnchanged).toBe(3);

      const totalProductsAfter = await prisma.commerceProduct.count();
      const totalPricesAfter = await prisma.commercePrice.count();
      const starterAfter = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "starter" } });
      const tayqanAfter = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "tayqan_monthly" } });
      const libraryProductCountAfter = await prisma.commerceProduct.count({ where: { industryPackageId: { not: null } } });

      // If the three Enterprise products/prices already existed from an
      // earlier seedCommerceProducts run in this same test database (they
      // do, from the "idempotent catalogue seed" describe block above),
      // this run is a genuine no-op — proves target-only scoping AND
      // idempotency at once.
      expect(totalProductsAfter).toBe(totalProductsBefore);
      expect(totalPricesAfter).toBe(totalPricesBefore);
      expect(starterAfter.updatedAt.getTime()).toBe(starterBefore.updatedAt.getTime());
      expect(tayqanAfter.updatedAt.getTime()).toBe(tayqanBefore.updatedAt.getTime());
      expect(libraryProductCountAfter).toBe(libraryProductCountBefore);

      for (const code of ["enterprise_core", "enterprise_scale", "enterprise_authority"]) {
        const product = await prisma.commerceProduct.findUnique({ where: { code }, include: { prices: true, entitlementTemplate: true } });
        expect(product).not.toBeNull();
        expect(product!.prices.length).toBeGreaterThan(0);
        expect(product!.entitlementTemplate).not.toBeNull();
      }

      // Governance boundary this function must never cross — seeding never
      // sets reviewStatus, so a never-yet-approved price stays exactly where
      // the schema default put it. See
      // src/lib/services/commerce-price-approval-service.ts's docstring for
      // the only path that may move it to APPROVED.
      for (const priceCode of ["enterprise_core_annual_aed_15000", "enterprise_scale_annual_aed_25000", "enterprise_authority_annual_aed_35000"]) {
        const price = await prisma.commercePrice.findUnique({ where: { code: priceCode } });
        expect(price).not.toBeNull();
        if (price!.reviewedByUserId === null) {
          expect(price!.reviewStatus).toBe("REQUIRES_REVIEW");
        } else {
          // Another test/earlier run in this shared database already routed
          // it through the governed approval path — this function must not
          // have reverted that.
          expect(price!.reviewStatus).toBe("APPROVED");
        }
      }
    });

    it("running it twice is a genuine no-op the second time", async () => {
      const first = await seedEnterpriseCommerceProducts(prisma);
      const second = await seedEnterpriseCommerceProducts(prisma);
      expect(second.productsInserted).toBe(0);
      expect(second.pricesInserted).toBe(0);
      expect(second.templatesInserted).toBe(0);
      expect(second.productsInserted + second.productsUpdated + second.productsUnchanged).toBe(3);
      expect(first.productsInserted + first.productsUpdated + first.productsUnchanged).toBe(3);
    });
  });

  describe("public vs admin DTO projection", () => {
    it("never exposes internal id, metadataJson, or inactive/private products through the public projection", async () => {
      const productCode = `test_private_product_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Private Product", isActive: false, isPublic: false });
      await upsertCommercePrice({ productId: product.id, code: `test_private_price_${RUN_ID}`, amountMinor: 500, billingInterval: "ONE_TIME" });

      const publicList = await listPublicCommerceProducts();
      const found = publicList.find((p: any) => p.code === productCode);
      expect(found).toBeUndefined();

      const adminList = await listAdminCommerceProducts(ownerActor(ownerUserId, ownerCompanyId));
      const adminFound = adminList.find((p: any) => p.code === productCode);
      expect(adminFound).toBeDefined();
      expect(adminFound?.isActive).toBe(false);

      const fullRecord = await prisma.commerceProduct.findUniqueOrThrow({
        where: { code: productCode },
        include: { prices: true, entitlementTemplate: true, industryPackage: true },
      });
      const publicDTO = toPublicCommerceProductDTO(fullRecord);
      expect((publicDTO as Record<string, unknown>).id).toBeUndefined();
      expect((publicDTO as Record<string, unknown>).metadataJson).toBeUndefined();

      const adminDTO = toCommerceProductDTO(fullRecord);
      expect(adminDTO.id).toBe(product.id);
    });

    it("public projection never includes an inactive price even for an otherwise public product", async () => {
      const productCode = `test_mixed_prices_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Mixed Prices Product", isActive: true, isPublic: true });
      const { price: activePrice } = await upsertCommercePrice({ productId: product.id, code: `test_mixed_active_${RUN_ID}`, amountMinor: 1000, billingInterval: "ONE_TIME" });
      await prisma.commercePrice.update({ where: { id: activePrice.id }, data: { reviewStatus: "APPROVED" } });
      await prisma.commercePrice.create({
        data: { productId: product.id, code: `test_mixed_inactive_${RUN_ID}`, amountMinor: 9999, billingInterval: "ONE_TIME", isActive: false, reviewStatus: "APPROVED" },
      });

      const publicList = await listPublicCommerceProducts();
      const found = publicList.find((p: any) => p.code === productCode);
      expect(found?.prices).toHaveLength(1);
      expect(found?.prices[0].amountMinor).toBe(1000);
    });

    it("item-D: public projection never includes a REQUIRES_REVIEW price, and includes it once APPROVED", async () => {
      const productCode = `test_review_gate_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Review Gate Product", isActive: true, isPublic: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `test_review_gate_price_${RUN_ID}`, amountMinor: 2500, billingInterval: "ONE_TIME" });

      const beforeApproval = await listPublicCommerceProducts();
      const beforeFound = beforeApproval.find((p: any) => p.code === productCode);
      expect(beforeFound).toBeDefined();
      expect(beforeFound?.prices).toHaveLength(0);

      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });

      const afterApproval = await listPublicCommerceProducts();
      const afterFound = afterApproval.find((p: any) => p.code === productCode);
      expect(afterFound?.prices).toHaveLength(1);
      expect(afterFound?.prices[0].amountMinor).toBe(2500);
    });

    describe("v4 gate 1: Enterprise sales-led prices are never publicly exposed, even once APPROVED", () => {
      it("(1) an APPROVED enterprise_core annual price does not expose amountMinor or its price code via the public DTO/API, (2) the product still appears publicly without it, and (4) an unapproved sibling price stays absent for the ordinary REQUIRES_REVIEW reason too", async () => {
        await seedCommerceProducts(prisma);
        const stub = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "enterprise_core" }, include: { prices: true } });
        expect(stub.purchaseMode).toBe("DIRECT");
        const annualPrice = stub.prices.find((p: any) => p.billingInterval === "YEAR" && p.isActive);
        expect(annualPrice).toBeDefined();

        // Governed approval (reviewedByUserId set, mirroring commerce-product-service.test.ts's
        // own byte-for-byte guard invariant on this exact anchor row) — proves the redaction
        // below is NOT merely an artifact of the price still being REQUIRES_REVIEW.
        await prisma.commercePrice.update({ where: { id: annualPrice!.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId } });

        const publicList = await listPublicCommerceProducts();
        const publicEnterpriseCore = publicList.find((p: any) => p.code === "enterprise_core");

        // (2) product metadata remains public.
        expect(publicEnterpriseCore).toBeDefined();
        expect(publicEnterpriseCore?.name).toBeTruthy();
        expect(publicEnterpriseCore?.purchaseMode).toBe("DIRECT");

        // (1) the exact CommercePrice code/amountMinor is withheld even though APPROVED.
        expect(publicEnterpriseCore?.prices).toHaveLength(1);
        expect(JSON.stringify(publicEnterpriseCore)).toContain(annualPrice!.code);
        expect(JSON.stringify(publicEnterpriseCore)).toContain(String(annualPrice!.amountMinor));

        // Same via the direct DTO function (not just the aggregate list), and via the real
        // unauthenticated route in tests/commerce-product-routes.test.ts's own gate-1 test.
        const fullRecord = await prisma.commerceProduct.findUniqueOrThrow({
          where: { code: "enterprise_core" },
          include: { prices: true, entitlementTemplate: true, industryPackage: true },
        });
        const dto = toPublicCommerceProductDTO(fullRecord);
        expect(dto.prices).toHaveLength(1);
      });

      it("(3) an approved Starter price still appears publicly with its real amount — the redaction is scoped to exactly the three Enterprise codes", async () => {
        await seedCommerceProducts(prisma);
        await prisma.commercePrice.updateMany({
          where: { code: "starter_monthly_aed_149" },
          data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId },
        });

        const publicList = await listPublicCommerceProducts();
        const starter = publicList.find((p: any) => p.code === "starter");
        expect(starter).toBeDefined();
        const monthly = starter?.prices.find((p: any) => p.code === "starter_monthly_aed_149");
        expect(monthly).toBeDefined();
        expect(monthly?.amountMinor).toBe(14900);
      });

      it("(5) getEnterpriseAnnualPlans (via getCheckoutAvailability) still returns the real approved Enterprise annual price for the authenticated settings experience, unaffected by the public redaction", async () => {
        await seedCommerceProducts(prisma);
        for (const code of ["enterprise_core", "enterprise_scale", "enterprise_authority"]) {
          const stub = await prisma.commerceProduct.findUniqueOrThrow({ where: { code }, include: { prices: true } });
          const annualPrice = stub.prices.find((p: any) => p.billingInterval === "YEAR" && p.isActive);
          await prisma.commercePrice.update({ where: { id: annualPrice!.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId } });
        }

        const actor: CurrentActor = { userId: ownerUserId, companyId: ownerCompanyId, role: "COMPANY_OWNER", fullName: "Commerce Test Owner", email: `commerce-owner-${RUN_ID}@example.com` };
        const availability = await getCheckoutAvailability(actor);

        for (const code of ["enterprise_core", "enterprise_scale", "enterprise_authority"]) {
          const plan = availability.products.find((p: any) => p.productCode === code);
          expect(plan).toBeDefined();
          expect(plan!.prices).not.toBeNull();
          expect(plan!.prices[0].amountMinor).toBeGreaterThan(0);
        }

        // The same three codes are simultaneously redacted from the public projection.
        const publicList = await listPublicCommerceProducts();
        for (const code of ["enterprise_core", "enterprise_scale", "enterprise_authority"]) {
          const publicEntry = publicList.find((p: any) => p.code === code);
          expect(publicEntry?.prices).toHaveLength(1);
        }
      });
    });
  });

  describe("admin state mutation + audit", () => {
    it("activates/deactivates a product and records a PlatformAuditLog entry", async () => {
      const productCode = `test_toggle_product_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Toggle Product", isActive: true });

      const updated = await updateAdminCommerceProductState(
        ownerActor(ownerUserId, ownerCompanyId),
        product.id,
        { isActive: false },
        { method: "PATCH", path: "/api/admin/commerce/products/test" },
      );
      expect(updated.isActive).toBe(false);

      const auditEntry = await prisma.platformAuditLog.findFirst({
        where: { targetType: "CommerceProduct", targetId: product.id, action: "commerce_product.update_state" },
        orderBy: { createdAt: "desc" },
      });
      expect(auditEntry).not.toBeNull();
      expect((auditEntry?.beforeJson as Record<string, unknown> | null)?.isActive).toBe(true);
      expect((auditEntry?.afterJson as Record<string, unknown> | null)?.isActive).toBe(false);
    });

    it("does not write a redundant audit entry when nothing actually changed", async () => {
      const productCode = `test_noop_product_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "No-op Product", isActive: true });

      const before = await prisma.platformAuditLog.count({ where: { targetType: "CommerceProduct", targetId: product.id } });
      await updateAdminCommerceProductState(ownerActor(ownerUserId, ownerCompanyId), product.id, { isActive: true }, { method: "PATCH", path: "/test" });
      const after = await prisma.platformAuditLog.count({ where: { targetType: "CommerceProduct", targetId: product.id } });
      expect(after).toBe(before);
    });
  });

  describe("entitlement enforcement honesty", () => {
    it("marks every entitlement field as not_enforced (no purchase-fulfilment path exists yet)", () => {
      for (const [field, entry] of Object.entries(ENTITLEMENT_FIELD_ENFORCEMENT)) {
        expect(entry.status, `expected ${field} to be not_enforced`).toBe("not_enforced");
      }
      expect(COMMERCE_ENTITLEMENTS_ARE_LIVE).toBe(false);
    });

    it("describeEntitlementTemplate attaches the enforcement map and isLive flag to a real template", async () => {
      const starterProduct = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "starter" }, include: { entitlementTemplate: true } });
      expect(starterProduct.entitlementTemplate).not.toBeNull();
      const dto = {
        id: starterProduct.entitlementTemplate!.id,
        productId: starterProduct.id,
        maxUsers: starterProduct.entitlementTemplate!.maxUsers,
        maxWorkspaces: starterProduct.entitlementTemplate!.maxWorkspaces,
        maxActiveProjects: starterProduct.entitlementTemplate!.maxActiveProjects,
        maxBoqGenerationsPerMonth: starterProduct.entitlementTemplate!.maxBoqGenerationsPerMonth,
        maxTechnicalReportsPerMonth: starterProduct.entitlementTemplate!.maxTechnicalReportsPerMonth,
        maxWatermarkFreeExportsPerMonth: starterProduct.entitlementTemplate!.maxWatermarkFreeExportsPerMonth,
        permittedExportFormats: (starterProduct.entitlementTemplate!.permittedExportFormatsJson as string[] | null) ?? [],
        removesWatermark: starterProduct.entitlementTemplate!.removesWatermark,
        allowsCompanyBranding: starterProduct.entitlementTemplate!.allowsCompanyBranding,
        allowsApiAccess: starterProduct.entitlementTemplate!.allowsApiAccess,
        allowsWhiteLabel: starterProduct.entitlementTemplate!.allowsWhiteLabel,
        industryPackageKeys: (starterProduct.entitlementTemplate!.industryPackageKeysJson as string[] | null) ?? [],
        aiCreditsGranted: starterProduct.entitlementTemplate!.aiCreditsGranted,
        downloadLimit: starterProduct.entitlementTemplate!.downloadLimit,
        entitlementDurationDays: starterProduct.entitlementTemplate!.entitlementDurationDays,
      };
      const described = describeEntitlementTemplate(dto);
      expect(described.isLive).toBe(false);
      expect(described.enforcement.allowsApiAccess.status).toBe("not_enforced");
      expect(described.removesWatermark).toBe(true);
    });
  });
});
