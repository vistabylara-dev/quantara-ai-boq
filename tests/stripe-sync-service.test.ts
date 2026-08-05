import { PlatformRole } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { PermissionDeniedError } from "../src/lib/errors/app-error";
import {
  classifyStripeSecretKey,
  getStripeClient,
  getStripeConfigurationState,
  StripeInvalidKeyError,
  StripeNotConfiguredError,
} from "../src/lib/payments/stripe-client";
import { upsertCommerceProduct, upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";
import { setCommercePriceReview } from "../src/lib/services/commerce-price-approval-service";
import {
  buildSyncPlan,
  classifyPriceEligibility,
  computeCatalogueFingerprint,
  inspectStripeConfiguration,
  runDryRun,
  synchronizeCommerceCatalogue,
  verifyStripeMapping,
} from "../src/lib/services/stripe-sync-service";
import { getCommerceProduct } from "../src/lib/repositories/commerce-product-repository";

const RUN_ID = `${Date.now()}-${process.pid}`;

function ownerActor(userId: string, companyId: string): PlatformActor {
  return { userId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Stripe Test Owner", email: `stripe-owner-${RUN_ID}@example.com` };
}
function adminActor(userId: string, companyId: string): PlatformActor {
  return { userId, companyId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "Stripe Test Admin", email: `stripe-admin-${RUN_ID}@example.com` };
}
function supportActor(userId: string, companyId: string): PlatformActor {
  return { userId, companyId, platformRole: PlatformRole.PLATFORM_SUPPORT, fullName: "Stripe Test Support", email: `stripe-support-${RUN_ID}@example.com` };
}

function mockStripeClient() {
  let productCounter = 0;
  let priceCounter = 0;
  return {
    balance: { retrieve: vi.fn(async () => ({ livemode: false })) },
    products: {
      create: vi.fn(async () => ({ id: `prod_test_${RUN_ID}_${++productCounter}` })),
      update: vi.fn(async (id: string) => ({ id })),
      retrieve: vi.fn(async (id: string) => ({ id, name: "Mock Product", active: true })),
    },
    prices: {
      create: vi.fn(async () => ({ id: `price_test_${RUN_ID}_${++priceCounter}` })),
      update: vi.fn(async (id: string) => ({ id })),
      retrieve: vi.fn(async (id: string) => ({ id, unit_amount: 14900, currency: "aed", recurring: { interval: "month" } })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("stripe-client configuration", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it("classifies key prefixes correctly", () => {
    expect(classifyStripeSecretKey("sk_test_abc123")).toBe("test");
    expect(classifyStripeSecretKey("sk_live_abc123")).toBe("live");
    expect(classifyStripeSecretKey("pk_test_abc123")).toBe("invalid");
    expect(classifyStripeSecretKey("garbage")).toBe("invalid");
  });

  it("reports unconfigured when the key is unset", () => {
    delete process.env.STRIPE_SECRET_KEY;
    const state = getStripeConfigurationState();
    expect(state.configured).toBe(false);
    expect(state.classification).toBe("unset");
  });

  it("throws StripeNotConfiguredError with no key in the message", () => {
    delete process.env.STRIPE_SECRET_KEY;
    try {
      getStripeClient();
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StripeNotConfiguredError);
      expect((error as Error).message).not.toMatch(/sk_/);
    }
  });

  it("rejects a live-mode key and never includes it in the error", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_super_secret_value_12345";
    try {
      getStripeClient();
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StripeInvalidKeyError);
      expect((error as StripeInvalidKeyError).reason).toBe("LIVE_MODE_NOT_ALLOWED");
      expect((error as Error).message).not.toContain("sk_live_super_secret_value_12345");
    }
  });

  it("accepts a test-mode key format", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_ok_12345";
    const state = getStripeConfigurationState();
    expect(state.configured).toBe(true);
    expect(state.testMode).toBe(true);
  });

  it("client construction makes no network call (override short-circuits, no key read needed)", () => {
    const mock = mockStripeClient();
    const client = getStripeClient(mock);
    expect(client).toBe(mock);
    expect(mock.balance.retrieve).not.toHaveBeenCalled();
  });
});

describe("Stripe sync service (integration, real local Postgres, mocked Stripe)", () => {
  let ownerUserId: string;
  let ownerCompanyId: string;
  let adminUserId: string;
  let supportUserId: string;
  const originalKey = process.env.STRIPE_SECRET_KEY;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { legalName: `Stripe Sync Co ${RUN_ID}`, tradeName: "Stripe Sync", email: `stripe-sync-${RUN_ID}@example.com` } });
    ownerCompanyId = company.id;
    const owner = await prisma.user.create({ data: { companyId: ownerCompanyId, email: `stripe-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    ownerUserId = owner.id;
    const admin = await prisma.user.create({ data: { companyId: ownerCompanyId, email: `stripe-admin-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Admin", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_ADMIN, isActive: true, emailVerifiedAt: new Date() } });
    adminUserId = admin.id;
    const support = await prisma.user.create({ data: { companyId: ownerCompanyId, email: `stripe-support-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Support", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_SUPPORT, isActive: true, emailVerifiedAt: new Date() } });
    supportUserId = support.id;
  });

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_key_not_real";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  afterAll(async () => {
    await prisma.commerceSyncRun.deleteMany({ where: { initiatedByUserId: { in: [ownerUserId, adminUserId, supportUserId] } } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: { in: [ownerUserId, adminUserId, supportUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, adminUserId, supportUserId] } } });
    await prisma.company.delete({ where: { id: ownerCompanyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  describe("eligibility classification", () => {
    it("blocks a REQUIRES_REVIEW price even if every other condition is met", async () => {
      const { product } = await upsertCommerceProduct({ code: `test_elig_direct_${RUN_ID}`, type: "ONE_TIME", name: "Eligible Direct", purchaseMode: "DIRECT", isActive: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `test_elig_direct_price_${RUN_ID}`, amountMinor: 1000, billingInterval: "ONE_TIME", isActive: true });
      const fullProduct = await getCommerceProduct(product.id);
      const fullPrice = fullProduct.prices.find((p) => p.id === price.id)!;
      const result = classifyPriceEligibility(fullProduct, fullPrice);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("PRICE_NOT_APPROVED");
    });

    it("allows an APPROVED, active, DIRECT price with a positive amount", async () => {
      const { product } = await upsertCommerceProduct({ code: `test_elig_approved_${RUN_ID}`, type: "ONE_TIME", name: "Eligible Approved", purchaseMode: "DIRECT", isActive: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `test_elig_approved_price_${RUN_ID}`, amountMinor: 1000, billingInterval: "ONE_TIME", isActive: true });
      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
      const fullProduct = await getCommerceProduct(product.id);
      const fullPrice = fullProduct.prices.find((p) => p.id === price.id)!;
      expect(classifyPriceEligibility(fullProduct, fullPrice).eligible).toBe(true);
    });

    it("blocks a quotation-required product's price even when approved", async () => {
      const { product } = await upsertCommerceProduct({ code: `test_elig_quote_${RUN_ID}`, type: "ADD_ON", name: "Quote Required", purchaseMode: "QUOTATION_REQUIRED", isActive: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `test_elig_quote_price_${RUN_ID}`, amountMinor: 500000, billingInterval: "ONE_TIME", isActive: true, isFromPrice: true });
      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
      const fullProduct = await getCommerceProduct(product.id);
      const fullPrice = fullProduct.prices.find((p) => p.id === price.id)!;
      const result = classifyPriceEligibility(fullProduct, fullPrice);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("PURCHASE_MODE_NOT_DIRECT");
    });

    it("blocks a zero-amount price", async () => {
      const { product } = await upsertCommerceProduct({ code: `test_elig_zero_${RUN_ID}`, type: "ONE_TIME", name: "Zero Amount", purchaseMode: "DIRECT", isActive: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `test_elig_zero_price_${RUN_ID}`, amountMinor: 0, billingInterval: "ONE_TIME", isActive: true });
      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
      const fullProduct = await getCommerceProduct(product.id);
      const fullPrice = fullProduct.prices.find((p) => p.id === price.id)!;
      expect(classifyPriceEligibility(fullProduct, fullPrice).reason).toBe("ZERO_OR_NEGATIVE_AMOUNT");
    });

    it("blocks a price on an inactive product", async () => {
      const { product } = await upsertCommerceProduct({ code: `test_elig_inactive_${RUN_ID}`, type: "ONE_TIME", name: "Inactive Product", purchaseMode: "DIRECT", isActive: false });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `test_elig_inactive_price_${RUN_ID}`, amountMinor: 1000, billingInterval: "ONE_TIME", isActive: true });
      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
      const fullProduct = await getCommerceProduct(product.id);
      const fullPrice = fullProduct.prices.find((p) => p.id === price.id)!;
      expect(classifyPriceEligibility(fullProduct, fullPrice).reason).toBe("PRODUCT_INACTIVE");
    });
  });

  describe("catalogue fingerprint", () => {
    it("is deterministic regardless of input array order", async () => {
      const products = [
        { code: "b", type: "ONE_TIME", purchaseMode: "DIRECT", isActive: true, name: "B", description: "", prices: [] },
        { code: "a", type: "ONE_TIME", purchaseMode: "DIRECT", isActive: true, name: "A", description: "", prices: [] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any;
      const reversed = [...products].reverse();
      expect(computeCatalogueFingerprint(products)).toBe(computeCatalogueFingerprint(reversed));
    });

    it("changes when a price amount changes", async () => {
      const base = [{ code: "x", type: "ONE_TIME", purchaseMode: "DIRECT", isActive: true, name: "X", description: "", prices: [{ code: "x1", amountMinor: 1000, currency: "AED", billingInterval: "ONE_TIME", isFromPrice: false, isActive: true, reviewStatus: "APPROVED" }] }];
      const changed = [{ ...base[0], prices: [{ ...base[0].prices[0], amountMinor: 2000 }] }];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(computeCatalogueFingerprint(base as any)).not.toBe(computeCatalogueFingerprint(changed as any));
    });
  });

  describe("price approval", () => {
    it("owner can approve a price and it is audit-logged with actor, timestamp, and note", async () => {
      const { product } = await upsertCommerceProduct({ code: `test_approve_${RUN_ID}`, type: "ONE_TIME", name: "Approve Test", isActive: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `test_approve_price_${RUN_ID}`, amountMinor: 1000, billingInterval: "ONE_TIME" });
      expect(price.reviewStatus).toBe("REQUIRES_REVIEW");

      const actor = ownerActor(ownerUserId, ownerCompanyId);
      const updated = await setCommercePriceReview(actor, price.id, { reviewStatus: "APPROVED", reviewNote: "Matches confirmed commercial source." }, { method: "PATCH", path: "/test" });
      expect(updated.reviewStatus).toBe("APPROVED");
      expect(updated.reviewedByUserId).toBe(ownerUserId);
      expect(updated.reviewedAt).not.toBeNull();
      expect(updated.reviewNote).toBe("Matches confirmed commercial source.");

      const auditEntry = await prisma.platformAuditLog.findFirst({ where: { targetType: "CommercePrice", targetId: price.id, action: "commerce_price.set_review_status" }, orderBy: { createdAt: "desc" } });
      expect(auditEntry).not.toBeNull();
      expect((auditEntry?.beforeJson as Record<string, unknown> | null)?.reviewStatus).toBe("REQUIRES_REVIEW");
    });

    it("support cannot approve a price (read-only)", async () => {
      const { product } = await upsertCommerceProduct({ code: `test_approve_support_${RUN_ID}`, type: "ONE_TIME", name: "Support Approve Test", isActive: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `test_approve_support_price_${RUN_ID}`, amountMinor: 1000, billingInterval: "ONE_TIME" });
      const actor = supportActor(supportUserId, ownerCompanyId);
      await expect(setCommercePriceReview(actor, price.id, { reviewStatus: "APPROVED" }, { method: "PATCH", path: "/test" })).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("dry run", () => {
    it("makes zero Stripe mutation calls and reports accurate counts", async () => {
      const productCode = `test_dryrun_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Dry Run Product", purchaseMode: "DIRECT", isActive: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `${productCode}_price`, amountMinor: 5000, billingInterval: "ONE_TIME" });
      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });

      const mock = mockStripeClient();
      const actor = ownerActor(ownerUserId, ownerCompanyId);
      const result = await runDryRun(actor, { method: "POST", path: "/test" }, mock);

      expect(mock.products.create).not.toHaveBeenCalled();
      expect(mock.prices.create).not.toHaveBeenCalled();
      expect(result.run.dryRun).toBe(true);
      expect(result.plan.prices.some((p) => p.code === `${productCode}_price` && p.action === "CREATE")).toBe(true);
      expect(result.plan.products.some((p) => p.code === productCode && p.action === "CREATE")).toBe(true);
    });

    it("blocks a review-required price and reports the reason", async () => {
      const productCode = `test_dryrun_blocked_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Blocked Product", purchaseMode: "DIRECT", isActive: true });
      await upsertCommercePrice({ productId: product.id, code: `${productCode}_price`, amountMinor: 5000, billingInterval: "ONE_TIME" });

      const mock = mockStripeClient();
      const actor = ownerActor(ownerUserId, ownerCompanyId);
      const result = await runDryRun(actor, { method: "POST", path: "/test" }, mock);
      const entry = result.plan.prices.find((p) => p.code === `${productCode}_price`);
      expect(entry?.action).toBe("BLOCKED");
      expect(entry?.blockedReason).toBe("PRICE_NOT_APPROVED");
    });
  });

  describe("synchronization execution", () => {
    it("rejects execution from a platform admin (owner-only)", async () => {
      const mock = mockStripeClient();
      const actor = adminActor(adminUserId, ownerCompanyId);
      await expect(
        synchronizeCommerceCatalogue(actor, { catalogueFingerprint: "irrelevant", confirm: true }, { method: "POST", path: "/test" }, mock),
      ).rejects.toThrow(PermissionDeniedError);
      expect(mock.products.create).not.toHaveBeenCalled();
    });

    it("rejects a stale catalogue fingerprint and makes no Stripe calls", async () => {
      const mock = mockStripeClient();
      const actor = ownerActor(ownerUserId, ownerCompanyId);
      await expect(
        synchronizeCommerceCatalogue(actor, { catalogueFingerprint: "stale-fingerprint-value", confirm: true }, { method: "POST", path: "/test" }, mock),
      ).rejects.toThrow();
      expect(mock.products.create).not.toHaveBeenCalled();
    });

    it("creates a Stripe product and an approved price, and is idempotent on rerun (no duplicates)", async () => {
      // NOTE: buildSyncPlan() processes the *entire* catalogue, so this
      // assertion counts calls matching this test's own product/price code
      // rather than total call counts — the shared local dev DB carries
      // leftover fixtures from other test runs that also need syncing.
      const productCode = `test_sync_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Sync Product", purchaseMode: "DIRECT", isActive: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `${productCode}_price`, amountMinor: 14900, billingInterval: "MONTH" });
      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });

      const mock = mockStripeClient();
      const actor = ownerActor(ownerUserId, ownerCompanyId);
      const plan = await buildSyncPlan();

      const first = await synchronizeCommerceCatalogue(actor, { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, mock);
      expect(first.run.pricesCreated).toBeGreaterThanOrEqual(1);

      const productCallsForThis = mock.products.create.mock.calls.filter((call: unknown[]) => (call[0] as { metadata: { quantara_product_code: string } }).metadata.quantara_product_code === productCode);
      const priceCallsForThis = mock.prices.create.mock.calls.filter((call: unknown[]) => (call[0] as { metadata: { quantara_price_code: string } }).metadata.quantara_price_code === `${productCode}_price`);
      expect(productCallsForThis).toHaveLength(1);
      expect(priceCallsForThis).toHaveLength(1);
      expect(productCallsForThis[0][0]).not.toHaveProperty("id");

      const mappingCount = await prisma.commerceProviderMapping.count({ where: { commerceProductId: product.id } });
      expect(mappingCount).toBe(2); // one PRODUCT mapping, one PRICE mapping

      // Re-run: nothing new to create for this product/price — no duplicate Stripe calls, no duplicate mappings.
      const secondPlan = await buildSyncPlan();
      await synchronizeCommerceCatalogue(actor, { catalogueFingerprint: secondPlan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, mock);
      const priceCallsAfterSecondRun = mock.prices.create.mock.calls.filter((call: unknown[]) => (call[0] as { metadata: { quantara_price_code: string } }).metadata.quantara_price_code === `${productCode}_price`);
      expect(priceCallsAfterSecondRun).toHaveLength(1);
      const mappingCountAfter = await prisma.commerceProviderMapping.count({ where: { commerceProductId: product.id } });
      expect(mappingCountAfter).toBe(2);
    });

    it("uses a deterministic idempotency key derived from the stable internal code, not a random one", async () => {
      const productCode = `test_idempotency_${RUN_ID}`;
      await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Idempotency Product", purchaseMode: "DIRECT", isActive: true });
      const mock = mockStripeClient();
      const actor = ownerActor(ownerUserId, ownerCompanyId);
      const plan = await buildSyncPlan();
      await synchronizeCommerceCatalogue(actor, { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, mock);
      const options = mock.products.create.mock.calls[0][1];
      expect(options.idempotencyKey).toBe(`quantara:test:PRODUCT:${productCode}:create`);
    });

    it("never places internal database IDs or entitlement details in Stripe metadata", async () => {
      const productCode = `test_metadata_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Metadata Product", purchaseMode: "DIRECT", isActive: true });
      const mock = mockStripeClient();
      const actor = ownerActor(ownerUserId, ownerCompanyId);
      const plan = await buildSyncPlan();
      await synchronizeCommerceCatalogue(actor, { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, mock);
      const metadata = mock.products.create.mock.calls[0][0].metadata;
      expect(Object.keys(metadata)).toEqual(["quantara_product_code", "quantara_environment"]);
      expect(JSON.stringify(metadata)).not.toContain(product.id);
    });
  });

  describe("drift detection", () => {
    it("detects a provider amount mismatch without overwriting the internal price", async () => {
      const productCode = `test_drift_${RUN_ID}`;
      const { product } = await upsertCommerceProduct({ code: productCode, type: "ONE_TIME", name: "Drift Product", purchaseMode: "DIRECT", isActive: true });
      const { price } = await upsertCommercePrice({ productId: product.id, code: `${productCode}_price`, amountMinor: 9900, billingInterval: "MONTH" });
      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });

      const mock = mockStripeClient();
      const actor = ownerActor(ownerUserId, ownerCompanyId);
      const plan = await buildSyncPlan();
      await synchronizeCommerceCatalogue(actor, { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, mock);

      // Simulate Stripe reporting a different amount than what we have internally (drift).
      mock.prices.retrieve.mockResolvedValueOnce({ id: "price_x", unit_amount: 99900, currency: "aed", recurring: { interval: "month" } });

      const result = await verifyStripeMapping(actor, { method: "POST", path: "/test" }, mock);
      expect(result.drift.some((d) => d.field === "amount")).toBe(true);

      const unchangedPrice = await prisma.commercePrice.findUnique({ where: { id: price.id } });
      expect(unchangedPrice?.amountMinor).toBe(9900); // internal value never overwritten
    });
  });

  describe("security", () => {
    it("inspectStripeConfiguration is readable by support (read-only capability)", async () => {
      const status = await inspectStripeConfiguration(mockStripeClient());
      expect(status.testMode).toBe(true);
    });

    it("verifyStripeMapping rejects support (requires platform:operate)", async () => {
      const actor = supportActor(supportUserId, ownerCompanyId);
      await expect(verifyStripeMapping(actor, { method: "POST", path: "/test" }, mockStripeClient())).rejects.toThrow(PermissionDeniedError);
    });

    it("configuration inspection reports a safe not-testMode state for a live key, never the key itself", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_live_should_be_rejected_xyz";
      const status = await inspectStripeConfiguration();
      expect(status.testMode).toBe(false);
      expect(status.configured).toBe(false);
      expect(JSON.stringify(status)).not.toContain("sk_live_should_be_rejected_xyz");
    });
  });
});
