import { PlatformRole } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { PermissionDeniedError } from "../src/lib/errors/app-error";
import { getCommerceProduct, upsertCommerceProduct, upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";
import { createMapping, findPriceMapping, findProductMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import {
  buildLiveSyncPlan,
  classifyLiveCheckoutEligibility,
  runLiveDryRun,
  synchronizeLiveCommerceCatalogue,
  verifyLiveStripeMapping,
} from "../src/lib/services/stripe-live-sync-service";

const RUN_ID = `${Date.now()}-${process.pid}-livesync`;

function ownerActor(userId: string, companyId: string): PlatformActor {
  return { userId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Live Sync Test Owner", email: `livesync-owner-${RUN_ID}@example.com` };
}
function adminActor(userId: string, companyId: string): PlatformActor {
  return { userId, companyId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "Live Sync Test Admin", email: `livesync-admin-${RUN_ID}@example.com` };
}

// Module-level (not per-mockStripeClient() call) — mappings are looked up
// globally (listMappingsForEnvironment has no per-test scoping), and
// CommerceProviderMapping enforces a real uniqueness constraint on
// providerProductId/providerPriceId per provider+environment. A counter
// reset to 0 in each test previously let two different tests' first
// created product/price both mint "..._1" and collide on that constraint.
let globalProductCounter = 0;
let globalPriceCounter = 0;

function mockStripeClient() {
  return {
    products: {
      create: vi.fn(async () => ({ id: `prod_live_test_${RUN_ID}_${++globalProductCounter}` })),
      update: vi.fn(async (id: string) => ({ id })),
      retrieve: vi.fn(async (id: string) => ({ id, name: "Mock Live Product", active: true })),
    },
    prices: {
      create: vi.fn(async () => ({ id: `price_live_test_${RUN_ID}_${++globalPriceCounter}` })),
      update: vi.fn(async (id: string) => ({ id })),
      retrieve: vi.fn(async (id: string) => ({ id, unit_amount: 14900, currency: "aed", recurring: { interval: "month" } })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

async function makeEligibleProduct(codeSuffix: string, overrides: { isPublic?: boolean; purchaseMode?: "DIRECT" | "QUOTATION_REQUIRED" | "CONTACT_SALES"; type?: "SUBSCRIPTION" | "ONE_TIME" | "ADD_ON"; billingInterval?: "MONTH" | "YEAR" | "ONE_TIME"; approved?: boolean } = {}) {
  const { product } = await upsertCommerceProduct({
    code: `test_live_${codeSuffix}_${RUN_ID}`,
    type: overrides.type ?? "SUBSCRIPTION",
    name: `Live Sync Test ${codeSuffix}`,
    purchaseMode: overrides.purchaseMode ?? "DIRECT",
    isActive: true,
    isPublic: overrides.isPublic ?? true,
  });
  const { price } = await upsertCommercePrice({
    productId: product.id,
    code: `test_live_${codeSuffix}_price_${RUN_ID}`,
    amountMinor: 14900,
    billingInterval: overrides.billingInterval ?? "MONTH",
    isActive: true,
  });
  if (overrides.approved !== false) {
    await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
  }
  const full = await getCommerceProduct(product.id);
  return { product: full, price: full.prices.find((p) => p.id === price.id)! };
}

describe("classifyLiveCheckoutEligibility (pure business logic over fixtures)", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalMode = process.env.STRIPE_MODE;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
  });

  it("is eligible for a public, DIRECT, SUBSCRIPTION, APPROVED, MONTH price", async () => {
    const { product, price } = await makeEligibleProduct("eligible");
    expect(classifyLiveCheckoutEligibility(product, price)).toEqual({ eligible: true });
  });

  it("blocks a private (isPublic: false) product even if otherwise fully eligible — FIX 7", async () => {
    const { product, price } = await makeEligibleProduct("private", { isPublic: false });
    expect(classifyLiveCheckoutEligibility(product, price)).toMatchObject({ eligible: false, reason: "PRODUCT_NOT_PUBLIC" });
  });

  it("blocks a QUOTATION_REQUIRED (non-DIRECT) product", async () => {
    const { product, price } = await makeEligibleProduct("quote", { purchaseMode: "QUOTATION_REQUIRED" });
    expect(classifyLiveCheckoutEligibility(product, price)).toMatchObject({ eligible: false, reason: "PURCHASE_MODE_NOT_DIRECT" });
  });

  it("blocks a non-SUBSCRIPTION product type — FIX 5/8", async () => {
    const { product, price } = await makeEligibleProduct("addon", { type: "ADD_ON", purchaseMode: "DIRECT" });
    expect(classifyLiveCheckoutEligibility(product, price)).toMatchObject({ eligible: false, reason: "PRODUCT_NOT_SUBSCRIPTION" });
  });

  it("blocks a ONE_TIME billing interval — FIX 5", async () => {
    const { product, price } = await makeEligibleProduct("onetime", { billingInterval: "ONE_TIME" });
    expect(classifyLiveCheckoutEligibility(product, price)).toMatchObject({ eligible: false, reason: "UNSUPPORTED_LIVE_INTERVAL" });
  });

  it("blocks a REQUIRES_REVIEW (non-APPROVED) price", async () => {
    const { product, price } = await makeEligibleProduct("unapproved", { approved: false });
    expect(classifyLiveCheckoutEligibility(product, price)).toMatchObject({ eligible: false, reason: "PRICE_NOT_APPROVED" });
  });
});

describe("stripe-live-sync-service (integration, real local Postgres, mocked Stripe) — FIX 8", () => {
  let ownerUserId: string;
  let ownerCompanyId: string;
  let adminUserId: string;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalMode = process.env.STRIPE_MODE;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { legalName: `Live Sync Co ${RUN_ID}`, tradeName: "Live Sync Co", email: `livesync-${RUN_ID}@example.com` } });
    ownerCompanyId = company.id;
    const owner = await prisma.user.create({ data: { companyId: ownerCompanyId, email: `livesync-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    ownerUserId = owner.id;
    const admin = await prisma.user.create({ data: { companyId: ownerCompanyId, email: `livesync-admin-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Admin", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_ADMIN, isActive: true, emailVerifiedAt: new Date() } });
    adminUserId = admin.id;
  });

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_live_fixture_key_not_real";
    process.env.STRIPE_MODE = "live";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
  });

  afterAll(async () => {
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.commerceSyncRun.deleteMany({ where: { initiatedByUserId: { in: [ownerUserId, adminUserId] } } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: { in: [ownerUserId, adminUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, adminUserId] } } });
    await prisma.company.delete({ where: { id: ownerCompanyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("runLiveDryRun rejects a non-owner platform actor (PLATFORM_ADMIN)", async () => {
    await expect(runLiveDryRun(adminActor(adminUserId, ownerCompanyId), { method: "POST", path: "/test" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("runLiveDryRun makes zero Stripe writes and works even without a live key configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_MODE;
    const result = await runLiveDryRun(ownerActor(ownerUserId, ownerCompanyId), { method: "POST", path: "/test" });
    expect(result.run.dryRun).toBe(true);
    expect(result.run.environment).toBe("LIVE");
  });

  it("synchronizeLiveCommerceCatalogue rejects a non-owner platform actor", async () => {
    const plan = await buildLiveSyncPlan();
    await expect(
      synchronizeLiveCommerceCatalogue(adminActor(adminUserId, ownerCompanyId), { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, mockStripeClient()),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("synchronizeLiveCommerceCatalogue rejects a stale catalogueFingerprint", async () => {
    const staleFingerprint = (await buildLiveSyncPlan()).catalogueFingerprint;
    await makeEligibleProduct("stale-check"); // mutates the catalogue after the fingerprint was captured
    await expect(
      synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: staleFingerprint, confirm: true }, { method: "POST", path: "/test" }, mockStripeClient()),
    ).rejects.toMatchObject({ code: "STALE_SYNC_PLAN" });
  });

  it("only syncs a PUBLIC + DIRECT + APPROVED + SUBSCRIPTION + MONTH/YEAR price, never a private/non-direct/one-time/unapproved one, and records environment LIVE", async () => {
    const eligible = await makeEligibleProduct("sync-eligible");
    const privateProduct = await makeEligibleProduct("sync-private", { isPublic: false });
    const quoteProduct = await makeEligibleProduct("sync-quote", { purchaseMode: "QUOTATION_REQUIRED" });
    const unapprovedProduct = await makeEligibleProduct("sync-unapproved", { approved: false });

    const plan = await buildLiveSyncPlan();
    const stripe = mockStripeClient();
    await synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, stripe);

    const eligibleMapping = await findPriceMapping("STRIPE", "LIVE", eligible.price.id);
    expect(eligibleMapping).not.toBeNull();
    expect(eligibleMapping?.environment).toBe("LIVE");
    expect(eligibleMapping?.providerPriceId).toMatch(/^price_live_test_/);

    for (const blocked of [privateProduct, quoteProduct, unapprovedProduct]) {
      const blockedMapping = await findPriceMapping("STRIPE", "LIVE", blocked.price.id);
      expect(blockedMapping).toBeNull();
    }

    const eligibleProductMapping = await findProductMapping("STRIPE", "LIVE", eligible.product.id);
    expect(eligibleProductMapping).not.toBeNull();
    for (const blocked of [privateProduct, quoteProduct, unapprovedProduct]) {
      const blockedProductMapping = await findProductMapping("STRIPE", "LIVE", blocked.product.id);
      expect(blockedProductMapping).toBeNull();
    }
  });

  it("never reuses a TEST-environment mapping as if it were a LIVE one", async () => {
    const { product, price } = await makeEligibleProduct("test-isolation");
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_${RUN_ID}`, providerPriceId: `price_test_${RUN_ID}`, providerObjectType: "PRICE" });

    const plan = await buildLiveSyncPlan();
    const entry = plan.prices.find((p) => p.priceId === price.id);
    // A TEST mapping existing must not make the LIVE plan think this price is already synced/unchanged.
    expect(entry?.action).toBe("CREATE");
  });

  it("provider failures during synchronize are recorded safely as warnings, never crash the run", async () => {
    const { price } = await makeEligibleProduct("provider-fail");
    const plan = await buildLiveSyncPlan();
    const stripe = mockStripeClient();
    stripe.products.create.mockRejectedValueOnce(Object.assign(new Error("boom"), { type: "StripeConnectionError" }));

    const result = await synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, stripe);
    expect(result.run.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.errors.length).toBeGreaterThan(0);

    const mapping = await findPriceMapping("STRIPE", "LIVE", price.id);
    expect(mapping).toBeNull(); // the price's product mapping never got created, so the price itself was correctly skipped too
  });

  it("verify detects relevant drift (amount mismatch) without overwriting the internal price, and PLATFORM_ADMIN cannot call it", async () => {
    const { product, price } = await makeEligibleProduct("drift");
    const productMapping = await createMapping({ provider: "STRIPE", environment: "LIVE", commerceProductId: product.id, providerProductId: `prod_live_drift_${RUN_ID}`, providerObjectType: "PRODUCT" });
    await createMapping({ provider: "STRIPE", environment: "LIVE", commerceProductId: product.id, commercePriceId: price.id, providerProductId: productMapping.providerProductId, providerPriceId: `price_live_drift_${RUN_ID}`, providerObjectType: "PRICE" });

    await expect(verifyLiveStripeMapping(adminActor(adminUserId, ownerCompanyId), { method: "POST", path: "/test" }, mockStripeClient())).rejects.toBeInstanceOf(PermissionDeniedError);

    // listMappingsForEnvironment is global (not scoped to this test's fixtures), and earlier
    // tests in this file leave their own LIVE mappings in place — key the drifted response off
    // the specific providerPriceId under test rather than relying on call order.
    const driftedStripe = mockStripeClient();
    driftedStripe.prices.retrieve.mockImplementation(async (id: string) => {
      if (id === `price_live_drift_${RUN_ID}`) return { id, unit_amount: 99900, currency: "aed", recurring: { interval: "month" } };
      return { id, unit_amount: 14900, currency: "aed", recurring: { interval: "month" } };
    });
    const result = await verifyLiveStripeMapping(ownerActor(ownerUserId, ownerCompanyId), { method: "POST", path: "/test" }, driftedStripe);

    expect(result.drift.some((d) => d.field === "amount" && d.code === price.code)).toBe(true);
    const stillOriginal = await prisma.commercePrice.findUnique({ where: { id: price.id } });
    expect(stillOriginal?.amountMinor).toBe(14900); // never overwritten
  });

  it("archives a price (and its product) that was previously live-synced but has since become ineligible (e.g. turned private)", async () => {
    const { product, price } = await makeEligibleProduct("archive-flow");
    const firstPlan = await buildLiveSyncPlan();
    const stripe = mockStripeClient();
    await synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: firstPlan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, stripe);
    expect(await findPriceMapping("STRIPE", "LIVE", price.id)).not.toBeNull();

    // The product turns private after being synced — it must no longer be represented as checkout-ready.
    await prisma.commerceProduct.update({ where: { id: product.id }, data: { isPublic: false } });

    const secondPlan = await buildLiveSyncPlan();
    const priceEntry = secondPlan.prices.find((p) => p.priceId === price.id);
    const productEntry = secondPlan.products.find((p) => p.productId === product.id);
    expect(priceEntry?.action).toBe("ARCHIVE");
    expect(productEntry?.action).toBe("ARCHIVE");

    await synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: secondPlan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, stripe);
    const mappingAfter = await findPriceMapping("STRIPE", "LIVE", price.id);
    expect(mappingAfter?.providerActive).toBe(false);
    expect(mappingAfter?.synchronizationStatus).toBe("ARCHIVED");
  });
});
