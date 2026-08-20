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
import { seedCommerceProducts } from "../prisma/seed-data/commerce-products";

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
      // Defaults to "nothing recoverable" — the authoritative orphan-recovery LIST scan
      // (STRIPE-COMMERCIAL-22) then always falls through to products.create above.
      list: vi.fn(async () => ({ data: [], has_more: false })),
    },
    prices: {
      create: vi.fn(async () => ({ id: `price_live_test_${RUN_ID}_${++globalPriceCounter}` })),
      update: vi.fn(async (id: string) => ({ id })),
      // active: true by default — matches an eligible price's desired state, so tests that
      // don't care about drift see a clean "no drift" result. FIX D tests override this.
      retrieve: vi.fn(async (id: string) => ({ id, unit_amount: 14900, currency: "aed", recurring: { interval: "month" }, active: true })),
      list: vi.fn(async () => ({ data: [], has_more: false })),
    },
    // ESLint's `@typescript-eslint/no-explicit-any` rule is not registered for tests/** in
    // this repo's config, so a disable comment for it errors as "rule not found". The cast
    // itself stays as plain `any` (not `unknown as Stripe`): several of these methods are
    // reconfigured post-creation via `.mockImplementation` below, which a `Stripe`-typed
    // cast would break.
  } as any;
}

async function makeEligibleProduct(codeSuffix: string, overrides: { isPublic?: boolean; purchaseMode?: "DIRECT" | "QUOTATION_REQUIRED" | "CONTACT_SALES"; type?: "SUBSCRIPTION" | "ONE_TIME" | "ADD_ON"; billingInterval?: "MONTH" | "YEAR" | "ONE_TIME"; approved?: boolean; isFromPrice?: boolean } = {}) {
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
    isFromPrice: overrides.isFromPrice ?? false,
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

  it("blocks an indicative isFromPrice price exactly like customer checkout and checkout-options do — FIX 6", async () => {
    const { product, price } = await makeEligibleProduct("fromprice", { isFromPrice: true });
    expect(classifyLiveCheckoutEligibility(product, price)).toMatchObject({ eligible: false, reason: "INDICATIVE_FROM_PRICE" });
  });

  it("blocks a CONTACT_SALES (non-enterprise-code) product exactly like QUOTATION_REQUIRED — the narrow allowlist never widens to purchaseMode alone", async () => {
    const { product, price } = await makeEligibleProduct("contact-sales-generic", { purchaseMode: "CONTACT_SALES" });
    expect(classifyLiveCheckoutEligibility(product, price)).toMatchObject({ eligible: false, reason: "PURCHASE_MODE_NOT_DIRECT" });
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

    // item-A (Round 3 correction) tests above approve the REAL, shared,
    // never-deleted enterprise_core/scale/authority annual prices and
    // create LIVE CommerceProviderMapping rows for enterprise_core —
    // mirroring commerce-checkout-service.test.ts's own cleanup convention
    // for the shared seeded tayqan_monthly product ("must never be deleted
    // — it's the real seeded product, not test fixture data"). Reset both
    // BEFORE deleting ownerUserId below — reviewedByUserId's FK is
    // onDelete: SetNull, so deleting the user first would silently leave
    // these rows APPROVED with a null reviewer, corrupting the governance
    // invariant commerce-product-service.test.ts's byte-for-byte guard test
    // checks on these same three anchor rows.
    await prisma.commercePrice.updateMany({
      where: { code: { in: ["enterprise_core_annual_aed_15000", "enterprise_scale_annual_aed_25000", "enterprise_authority_annual_aed_35000"] } },
      data: { reviewStatus: "REQUIRES_REVIEW", reviewedByUserId: null, reviewedAt: null },
    });
    await prisma.commerceProviderMapping.deleteMany({
      where: { environment: "LIVE", commerceProduct: { code: "enterprise_core" } },
    });

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

  it("item-A: enterprise_core/scale/authority ARE eligible for LIVE sync despite purchaseMode: CONTACT_SALES — the narrow, exact-code allowlist", async () => {
    // These are the real seeded Enterprise products (not RUN_ID-suffixed
    // test fixtures) — seedCommerceProducts is idempotent, so re-running it
    // here guarantees purchaseMode reflects the current seed spec
    // (CONTACT_SALES) regardless of which test file ran first.
    await seedCommerceProducts(prisma);
    for (const code of ["enterprise_core", "enterprise_scale", "enterprise_authority"]) {
      const stub = await prisma.commerceProduct.findUniqueOrThrow({ where: { code } });
      expect(stub.purchaseMode).toBe("CONTACT_SALES");
      const product = await getCommerceProduct(stub.id);
      const annualPrice = product.prices.find((p) => p.billingInterval === "YEAR");
      expect(annualPrice).toBeDefined();
      // Approve it — a test-database-only direct write (reviewedByUserId
      // set so this reads as a genuinely governed approval, consistent
      // with commerce-product-service.test.ts's byte-for-byte guard test
      // on these same three anchor rows) — so eligibility here reflects
      // only the purchaseMode exception, not an incidental PRICE_NOT_APPROVED.
      await prisma.commercePrice.update({ where: { id: annualPrice!.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId } });
      const reApproved = await getCommerceProduct(stub.id);
      const reApprovedPrice = reApproved.prices.find((p) => p.id === annualPrice!.id)!;
      expect(classifyLiveCheckoutEligibility(reApproved, reApprovedPrice)).toEqual({ eligible: true });
    }
  });

  it("item-A: buildLiveSyncPlan plans enterprise_core/scale/authority for CREATE/REACTIVATE once approved — never BLOCKED by purchaseMode — while Starter/Professional/Business/library sync stays governed by the unchanged DIRECT-only rule", async () => {
    await seedCommerceProducts(prisma);
    for (const code of ["enterprise_core", "enterprise_scale", "enterprise_authority"]) {
      const stub = await prisma.commerceProduct.findUniqueOrThrow({ where: { code } });
      expect(stub.purchaseMode).toBe("CONTACT_SALES");
      const product = await getCommerceProduct(stub.id);
      const annualPrice = product.prices.find((p) => p.billingInterval === "YEAR")!;
      await prisma.commercePrice.update({ where: { id: annualPrice.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId } });
    }

    const plan = await buildLiveSyncPlan();
    for (const code of ["enterprise_core", "enterprise_scale", "enterprise_authority"]) {
      const entry = plan.prices.find((p) => p.productCode === code);
      expect(entry).toBeDefined();
      expect(["CREATE", "REACTIVATE", "UNCHANGED"]).toContain(entry!.action);
      expect(entry!.action).not.toBe("BLOCKED");
    }

    // Starter — real seeded DIRECT product — must be entirely unaffected by
    // this narrow, exact-code exception: still governed by the plain
    // purchaseMode === DIRECT rule, exactly as before this change.
    const starter = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "starter" } });
    const starterFull = await getCommerceProduct(starter.id);
    const starterMonthly = starterFull.prices.find((p) => p.code === "starter_monthly_aed_149");
    expect(starterMonthly).toBeDefined();
    expect(starterFull.purchaseMode).toBe("DIRECT");
  });

  it("item-A: synchronizeLiveCommerceCatalogue actually creates a LIVE Stripe Price mapping for enterprise_core — for a later manually issued sales-led Payment Link", async () => {
    await seedCommerceProducts(prisma);
    const stub = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "enterprise_core" } });
    const product = await getCommerceProduct(stub.id);
    const annualPrice = product.prices.find((p) => p.billingInterval === "YEAR")!;
    await prisma.commercePrice.update({ where: { id: annualPrice.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId } });

    const plan = await buildLiveSyncPlan();
    const stripe = mockStripeClient();
    await synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, stripe);

    const mapping = await findPriceMapping("STRIPE", "LIVE", annualPrice.id);
    expect(mapping).not.toBeNull();
    expect(mapping?.providerActive).toBe(true);
    expect(mapping?.synchronizationStatus).toBe("SYNCED");
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
    const { product, price } = await makeEligibleProduct("provider-fail");
    const plan = await buildLiveSyncPlan();
    const stripe = mockStripeClient();
    // Keyed to the product under test rather than mockRejectedValueOnce (which would reject
    // whichever product buildLiveSyncPlan's CREATE list happens to reach first — buildLiveSyncPlan
    // covers every CommerceProduct in the database, not only this test's own fixture).
    let created = 0;
    stripe.products.create.mockImplementation(async (params: { name?: string }) => {
      if (params?.name === product.name) {
        throw Object.assign(new Error("boom"), { type: "StripeConnectionError" });
      }
      return { id: `prod_live_test_${RUN_ID}_ok_${++created}` };
    });

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
      if (id === `price_live_drift_${RUN_ID}`) return { id, unit_amount: 99900, currency: "aed", recurring: { interval: "month" }, active: true };
      return { id, unit_amount: 14900, currency: "aed", recurring: { interval: "month" }, active: true };
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

  it("FIX C: the live confirmation fingerprint changes when isPublic flips, rejecting a stale plan", async () => {
    const { product } = await makeEligibleProduct("fingerprint-public");
    const plan = await buildLiveSyncPlan();

    await prisma.commerceProduct.update({ where: { id: product.id }, data: { isPublic: false } });

    await expect(
      synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, mockStripeClient()),
    ).rejects.toMatchObject({ code: "STALE_SYNC_PLAN" });
  });

  it("FIX D: verify flags a manually deactivated Stripe Price as DRIFTED, never SYNCED, so checkout-options would no longer show it as checkout-ready", async () => {
    const { product, price } = await makeEligibleProduct("price-deactivated");
    const productMapping = await createMapping({ provider: "STRIPE", environment: "LIVE", commerceProductId: product.id, providerProductId: `prod_live_deactivated_${RUN_ID}`, providerObjectType: "PRODUCT" });
    const priceMapping = await createMapping({ provider: "STRIPE", environment: "LIVE", commerceProductId: product.id, commercePriceId: price.id, providerProductId: productMapping.providerProductId, providerPriceId: `price_live_deactivated_${RUN_ID}`, providerObjectType: "PRICE" });

    const stripe = mockStripeClient();
    stripe.prices.retrieve.mockImplementation(async (id: string) => {
      if (id === `price_live_deactivated_${RUN_ID}`) return { id, unit_amount: 14900, currency: "aed", recurring: { interval: "month" }, active: false };
      return { id, unit_amount: 14900, currency: "aed", recurring: { interval: "month" }, active: true };
    });

    const result = await verifyLiveStripeMapping(ownerActor(ownerUserId, ownerCompanyId), { method: "POST", path: "/test" }, stripe);

    expect(result.drift.some((d) => d.mappingId === priceMapping.id && d.field === "active")).toBe(true);
    const refetched = await prisma.commerceProviderMapping.findUnique({ where: { id: priceMapping.id } });
    expect(refetched?.synchronizationStatus).toBe("DRIFTED");
    expect(refetched?.synchronizationStatus).not.toBe("SYNCED");
  });

  it("FIX D: verify compares product active state against isActive AND having an eligible live price, not raw isActive alone", async () => {
    const { product } = await makeEligibleProduct("product-desired-state", { approved: false }); // no eligible price
    const mapping = await createMapping({ provider: "STRIPE", environment: "LIVE", commerceProductId: product.id, providerProductId: `prod_live_desired_${RUN_ID}`, providerObjectType: "PRODUCT" });

    const stripe = mockStripeClient();
    // Stripe still shows the product active, but it has no eligible price — desired state is
    // inactive. listMappingsForEnvironment is global (not scoped to this test), so this is keyed
    // by providerProductId rather than relying on call order among every mapping in the file.
    stripe.products.retrieve.mockImplementation(async (id: string) => ({ id, name: id === `prod_live_desired_${RUN_ID}` ? product.name : "Mock Live Product", active: true }));

    const result = await verifyLiveStripeMapping(ownerActor(ownerUserId, ownerCompanyId), { method: "POST", path: "/test" }, stripe);

    expect(result.drift.some((d) => d.mappingId === mapping.id && d.field === "active" && d.internalValue === "false")).toBe(true);
  });

  it("FIX E: a previously archived price that becomes eligible again is REACTIVATEd (Stripe active:true, mapping SYNCED) rather than staying UNCHANGED", async () => {
    const { product, price } = await makeEligibleProduct("reactivate-flow");
    const firstPlan = await buildLiveSyncPlan();
    const stripe = mockStripeClient();
    await synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: firstPlan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, stripe);
    expect((await findPriceMapping("STRIPE", "LIVE", price.id))?.providerActive).toBe(true);

    // Archive it (turn the product private, sync, confirm archived).
    await prisma.commerceProduct.update({ where: { id: product.id }, data: { isPublic: false } });
    const archivePlan = await buildLiveSyncPlan();
    await synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: archivePlan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, stripe);
    const archivedMapping = await findPriceMapping("STRIPE", "LIVE", price.id);
    expect(archivedMapping?.providerActive).toBe(false);
    expect(archivedMapping?.synchronizationStatus).toBe("ARCHIVED");

    // Make it public (eligible) again.
    await prisma.commerceProduct.update({ where: { id: product.id }, data: { isPublic: true } });
    const reactivatePlan = await buildLiveSyncPlan();
    const priceEntry = reactivatePlan.prices.find((p) => p.priceId === price.id);
    expect(priceEntry?.action).toBe("REACTIVATE");

    const reactivateResult = await synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: reactivatePlan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, stripe);
    expect(reactivateResult.pricesReactivated).toBe(1);

    const reactivatedMapping = await findPriceMapping("STRIPE", "LIVE", price.id);
    expect(reactivatedMapping?.providerActive).toBe(true);
    expect(reactivatedMapping?.synchronizationStatus).toBe("SYNCED");
    expect(stripe.prices.update).toHaveBeenCalledWith(archivedMapping?.providerPriceId, { active: true });
  });

  describe("STRIPE-COMMERCIAL-22: orphan recovery is decided by an authoritative LIST scan, never by Search absence/presence", () => {
    type FakeProduct = { id: string; name: string; active: boolean; metadata: Record<string, string> };
    type FakePrice = { id: string; unit_amount: number; currency: string; recurring: { interval: string } | null; active: boolean; product: string; metadata: Record<string, string> };

    // A stateful mock backing products.list/prices.list from real in-memory state, so a
    // pre-seeded "orphan" (an object with no corresponding CommerceProviderMapping row) is
    // actually discoverable by the same LIST-based resolver the production code runs —
    // unlike the plain mockStripeClient() above, which always reports an empty catalogue.
    function makeRecoveryStripeClient() {
      const products = new Map<string, FakeProduct>();
      const prices = new Map<string, FakePrice>();
      const client: any = {
        products: {
          // Uses the module-level counters (not a local one) — buildLiveSyncPlan() scans the
          // WHOLE catalogue, including any still-unmapped product left behind by an earlier
          // test in this file (e.g. the deliberately-failed "provider-fail" fixture above), so
          // one test's syncOne() call can end up creating objects for more than just its own
          // fixture. A counter reset to 0 per test previously let two different tests mint the
          // identical fake providerProductId string, which collided on the real unique
          // (provider, environment, providerProductId) database constraint.
          create: vi.fn(async (params: { name: string; active?: boolean; metadata?: Record<string, string> }) => {
            const id = `prod_live_test_${RUN_ID}_${++globalProductCounter}`;
            products.set(id, { id, name: params.name, active: params.active ?? true, metadata: params.metadata ?? {} });
            return { id };
          }),
          update: vi.fn(async (id: string) => ({ id })),
          retrieve: vi.fn(async (id: string) => products.get(id) ?? { id, name: "Mock Live Product", active: true }),
          list: vi.fn(async () => ({ data: Array.from(products.values()), has_more: false })),
        },
        prices: {
          create: vi.fn(async (params: { product: string; unit_amount: number; currency: string; recurring?: { interval: string }; metadata?: Record<string, string> }) => {
            const id = `price_live_test_${RUN_ID}_${++globalPriceCounter}`;
            prices.set(id, { id, unit_amount: params.unit_amount, currency: params.currency, recurring: params.recurring ?? null, active: true, product: params.product, metadata: params.metadata ?? {} });
            return { id };
          }),
          update: vi.fn(async (id: string) => ({ id })),
          retrieve: vi.fn(async (id: string) => prices.get(id) ?? { id, unit_amount: 14900, currency: "aed", recurring: { interval: "month" }, active: true }),
          list: vi.fn(async (params: { product?: string }) => ({
            data: Array.from(prices.values()).filter((p) => !params.product || p.product === params.product),
            has_more: false,
          })),
        },
      };
      return { client, products, prices };
    }

    async function syncOne(stripe: ReturnType<typeof makeRecoveryStripeClient>["client"]) {
      const plan = await buildLiveSyncPlan();
      return synchronizeLiveCommerceCatalogue(ownerActor(ownerUserId, ownerCompanyId), { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, stripe);
    }

    // buildLiveSyncPlan() scans the WHOLE catalogue, not just one test's own fixture — a
    // still-unmapped product/price deliberately left behind by an earlier fail-closed test in
    // this same describe block (or by the "provider-fail"/"stale-check" fixtures higher up in
    // this file) gets reprocessed by every later syncOne() call too, since it self-heals the
    // moment a later test's fresh, unseeded recovery client finds no orphan for it and
    // legitimately creates one. A blanket `.not.toHaveBeenCalled()`/`.toHaveBeenCalledTimes(n)`
    // on the shared create spy is therefore not reliable across this describe block — these
    // helpers check only whether create was invoked for THIS test's own product/price code.
    function wasProductCreateCalledFor(stripe: any, productCode: string): boolean {
      return stripe.products.create.mock.calls.some(([params]: [{ metadata?: Record<string, string> }]) => params?.metadata?.quantara_product_code === productCode);
    }
    function wasPriceCreateCalledFor(stripe: any, priceCode: string): boolean {
      return stripe.prices.create.mock.calls.some(([params]: [{ metadata?: Record<string, string> }]) => params?.metadata?.quantara_price_code === priceCode);
    }

    it("(1) LIST finds one exact orphan Product: adopted, products.create is NOT called", async () => {
      const { product, price } = await makeEligibleProduct("recover-product-orphan");
      const { client: stripe, products } = makeRecoveryStripeClient();
      const orphanId = `prod_live_preexisting_${RUN_ID}`;
      products.set(orphanId, { id: orphanId, name: product.name, active: true, metadata: { quantara_product_code: product.code, quantara_environment: "live" } });

      await syncOne(stripe);

      expect(wasProductCreateCalledFor(stripe, product.code)).toBe(false);
      const mapping = await findProductMapping("STRIPE", "LIVE", product.id);
      expect(mapping?.providerProductId).toBe(orphanId);
      // The price still needs its own Price object — only the Product step is under test here.
      void price;
    });

    it("(2) LIST completely succeeds with zero candidates: normal create proceeds for both Product and Price", async () => {
      const { product, price } = await makeEligibleProduct("recover-normal-create");
      const { client: stripe } = makeRecoveryStripeClient();

      await syncOne(stripe);

      expect(wasProductCreateCalledFor(stripe, product.code)).toBe(true);
      expect(wasPriceCreateCalledFor(stripe, price.code)).toBe(true);
      const productMapping = await findProductMapping("STRIPE", "LIVE", product.id);
      const priceMapping = await findPriceMapping("STRIPE", "LIVE", price.id);
      expect(productMapping).not.toBeNull();
      expect(priceMapping).not.toBeNull();
    });

    it("(3) products.list itself fails: fails closed, products.create is NOT called for this product", async () => {
      const { product } = await makeEligibleProduct("recover-product-list-fail");
      const { client: stripe } = makeRecoveryStripeClient();
      // Persistent (not -Once): the catalogue may contain other still-unmapped products from
      // earlier tests, and every one of their list() calls must also fail closed here — a
      // single-shot rejection could let a later, unrelated product's list() call succeed.
      stripe.products.list.mockRejectedValue(new Error("Stripe unreachable"));

      const result = await syncOne(stripe);

      expect(wasProductCreateCalledFor(stripe, product.code)).toBe(false);
      expect(result.errors.some((e: string) => e.includes(`${product.code}: STRIPE_PRODUCT_RECOVERY_LIST_FAILED`))).toBe(true);
      const mapping = await findProductMapping("STRIPE", "LIVE", product.id);
      expect(mapping).toBeNull();
    });

    it("(4) prices.list itself fails: fails closed, prices.create is NOT called for this price", async () => {
      const { product, price } = await makeEligibleProduct("recover-price-list-fail");
      const { client: stripe } = makeRecoveryStripeClient();
      stripe.prices.list.mockRejectedValue(new Error("Stripe unreachable"));

      const result = await syncOne(stripe);

      // The Product step is unaffected (only prices.list is made to fail), so this product's
      // own mapping is created normally.
      expect(wasProductCreateCalledFor(stripe, product.code)).toBe(true);
      expect(wasPriceCreateCalledFor(stripe, price.code)).toBe(false);
      expect(result.errors.some((e: string) => e.includes(`${price.code}: STRIPE_PRICE_RECOVERY_LIST_FAILED`))).toBe(true);
      const mapping = await findPriceMapping("STRIPE", "LIVE", price.id);
      expect(mapping).toBeNull();
    });

    it("(5) multiple candidate Products carry the same quantara_product_code: fails closed, no Product is arbitrarily chosen, no create", async () => {
      const { product } = await makeEligibleProduct("recover-product-multi");
      const { client: stripe, products } = makeRecoveryStripeClient();
      products.set(`prod_dup_a_${RUN_ID}`, { id: `prod_dup_a_${RUN_ID}`, name: product.name, active: true, metadata: { quantara_product_code: product.code, quantara_environment: "live" } });
      products.set(`prod_dup_b_${RUN_ID}`, { id: `prod_dup_b_${RUN_ID}`, name: product.name, active: true, metadata: { quantara_product_code: product.code, quantara_environment: "live" } });

      const result = await syncOne(stripe);

      expect(wasProductCreateCalledFor(stripe, product.code)).toBe(false);
      expect(result.errors.some((e: string) => e.includes(`${product.code}: STRIPE_PRODUCT_RECOVERY_MULTIPLE_CANDIDATES`))).toBe(true);
      const mapping = await findProductMapping("STRIPE", "LIVE", product.id);
      expect(mapping).toBeNull();
    });

    it("(6) multiple candidate Prices carry the same quantara_price_code: fails closed, no Price is arbitrarily chosen, no create", async () => {
      const { product, price } = await makeEligibleProduct("recover-price-multi");
      const { client: stripe, products, prices } = makeRecoveryStripeClient();
      const providerProductId = `prod_for_price_multi_${RUN_ID}`;
      products.set(providerProductId, { id: providerProductId, name: product.name, active: true, metadata: { quantara_product_code: product.code, quantara_environment: "live" } });
      prices.set(`price_dup_a_${RUN_ID}`, { id: `price_dup_a_${RUN_ID}`, unit_amount: price.amountMinor, currency: "aed", recurring: { interval: "month" }, active: true, product: providerProductId, metadata: { quantara_price_code: price.code, quantara_environment: "live" } });
      prices.set(`price_dup_b_${RUN_ID}`, { id: `price_dup_b_${RUN_ID}`, unit_amount: price.amountMinor, currency: "aed", recurring: { interval: "month" }, active: true, product: providerProductId, metadata: { quantara_price_code: price.code, quantara_environment: "live" } });

      const result = await syncOne(stripe);

      expect(wasPriceCreateCalledFor(stripe, price.code)).toBe(false);
      expect(result.errors.some((e: string) => e.includes(`${price.code}: STRIPE_PRICE_RECOVERY_MULTIPLE_CANDIDATES`))).toBe(true);
      const mapping = await findPriceMapping("STRIPE", "LIVE", price.id);
      expect(mapping).toBeNull();
    });

    it("(7) recovered Price candidate has the wrong amount: fails closed, not adopted, no create, no mapping", async () => {
      const { product, price } = await makeEligibleProduct("recover-price-wrong-amount");
      const { client: stripe, products, prices } = makeRecoveryStripeClient();
      const providerProductId = `prod_for_wrong_amount_${RUN_ID}`;
      products.set(providerProductId, { id: providerProductId, name: product.name, active: true, metadata: { quantara_product_code: product.code, quantara_environment: "live" } });
      prices.set(`price_wrong_amount_${RUN_ID}`, { id: `price_wrong_amount_${RUN_ID}`, unit_amount: price.amountMinor + 100, currency: "aed", recurring: { interval: "month" }, active: true, product: providerProductId, metadata: { quantara_price_code: price.code, quantara_environment: "live" } });

      const result = await syncOne(stripe);

      expect(wasPriceCreateCalledFor(stripe, price.code)).toBe(false);
      expect(result.errors.some((e: string) => e.includes(`${price.code}: STRIPE_PRICE_RECOVERY_DRIFT`))).toBe(true);
      expect(await findPriceMapping("STRIPE", "LIVE", price.id)).toBeNull();
    });

    it("(8) recovered Price candidate has the wrong currency: fails closed", async () => {
      const { product, price } = await makeEligibleProduct("recover-price-wrong-currency");
      const { client: stripe, products, prices } = makeRecoveryStripeClient();
      const providerProductId = `prod_for_wrong_currency_${RUN_ID}`;
      products.set(providerProductId, { id: providerProductId, name: product.name, active: true, metadata: { quantara_product_code: product.code, quantara_environment: "live" } });
      prices.set(`price_wrong_currency_${RUN_ID}`, { id: `price_wrong_currency_${RUN_ID}`, unit_amount: price.amountMinor, currency: "usd", recurring: { interval: "month" }, active: true, product: providerProductId, metadata: { quantara_price_code: price.code, quantara_environment: "live" } });

      const result = await syncOne(stripe);

      expect(wasPriceCreateCalledFor(stripe, price.code)).toBe(false);
      expect(result.errors.some((e: string) => e.includes(`${price.code}: STRIPE_PRICE_RECOVERY_DRIFT`))).toBe(true);
      expect(await findPriceMapping("STRIPE", "LIVE", price.id)).toBeNull();
    });

    it("(9) recovered Price candidate has the wrong billing interval: fails closed", async () => {
      const { product, price } = await makeEligibleProduct("recover-price-wrong-interval");
      const { client: stripe, products, prices } = makeRecoveryStripeClient();
      const providerProductId = `prod_for_wrong_interval_${RUN_ID}`;
      products.set(providerProductId, { id: providerProductId, name: product.name, active: true, metadata: { quantara_product_code: product.code, quantara_environment: "live" } });
      prices.set(`price_wrong_interval_${RUN_ID}`, { id: `price_wrong_interval_${RUN_ID}`, unit_amount: price.amountMinor, currency: "aed", recurring: { interval: "year" }, active: true, product: providerProductId, metadata: { quantara_price_code: price.code, quantara_environment: "live" } });

      const result = await syncOne(stripe);

      expect(wasPriceCreateCalledFor(stripe, price.code)).toBe(false);
      expect(result.errors.some((e: string) => e.includes(`${price.code}: STRIPE_PRICE_RECOVERY_DRIFT`))).toBe(true);
      expect(await findPriceMapping("STRIPE", "LIVE", price.id)).toBeNull();
    });

    it("(10) recovered Price candidate belongs to the wrong Stripe Product: fails closed", async () => {
      const { product, price } = await makeEligibleProduct("recover-price-wrong-product");
      const { client: stripe, products, prices } = makeRecoveryStripeClient();
      const correctProviderProductId = `prod_correct_${RUN_ID}`;
      const wrongProviderProductId = `prod_wrong_${RUN_ID}`;
      products.set(correctProviderProductId, { id: correctProviderProductId, name: product.name, active: true, metadata: { quantara_product_code: product.code, quantara_environment: "live" } });
      // The price candidate's metadata code matches, but it hangs off a DIFFERENT Stripe Product
      // than the one this run resolves for the internal product. Stripe's real prices.list API,
      // scoped by `product`, would never actually return a price attached to a different
      // product — this exercises the defensive re-check as a belt-and-suspenders guard against
      // an unexpected/malformed provider response, so the mock's list() deliberately does NOT
      // apply the production code's `product` filter here (all other tests in this describe
      // block rely on the default filtered behavior; only this one needs the raw list).
      const wrongProductPriceId = `price_wrong_product_${RUN_ID}`;
      prices.set(wrongProductPriceId, { id: wrongProductPriceId, unit_amount: price.amountMinor, currency: "aed", recurring: { interval: "month" }, active: true, product: wrongProviderProductId, metadata: { quantara_price_code: price.code, quantara_environment: "live" } });
      stripe.prices.list.mockImplementation(async (params: { product?: string }) => ({
        data: params.product === correctProviderProductId ? [prices.get(wrongProductPriceId)] : Array.from(prices.values()).filter((p) => p.product === params.product),
        has_more: false,
      }));

      const result = await syncOne(stripe);

      expect(wasPriceCreateCalledFor(stripe, price.code)).toBe(false);
      expect(result.errors.some((e: string) => e.includes(`${price.code}: STRIPE_PRICE_RECOVERY_DRIFT`))).toBe(true);
      expect(await findPriceMapping("STRIPE", "LIVE", price.id)).toBeNull();
    });

    it("(11) an exactly-matching recovered Price is adopted: mapping created, prices.create is NOT called", async () => {
      const { product, price } = await makeEligibleProduct("recover-price-exact");
      const { client: stripe, products, prices } = makeRecoveryStripeClient();
      const providerProductId = `prod_for_exact_${RUN_ID}`;
      const orphanPriceId = `price_exact_orphan_${RUN_ID}`;
      products.set(providerProductId, { id: providerProductId, name: product.name, active: true, metadata: { quantara_product_code: product.code, quantara_environment: "live" } });
      prices.set(orphanPriceId, { id: orphanPriceId, unit_amount: price.amountMinor, currency: "aed", recurring: { interval: "month" }, active: true, product: providerProductId, metadata: { quantara_price_code: price.code, quantara_environment: "live" } });

      await syncOne(stripe);

      expect(wasPriceCreateCalledFor(stripe, price.code)).toBe(false);
      const mapping = await findPriceMapping("STRIPE", "LIVE", price.id);
      expect(mapping?.providerPriceId).toBe(orphanPriceId);
    });

    it("(12) simulates a genuine Stripe-create-succeeded/DB-mapping-failed orphan: a later retry's LIST finds it and adopts the SAME object, minting no second one", async () => {
      const { product, price } = await makeEligibleProduct("recover-retry-after-partial-failure");
      const { client: stripe, products, prices } = makeRecoveryStripeClient();

      // First attempt: Stripe create succeeds for both Product and Price (the mock records
      // them in `products`/`prices`), but we simulate the process crashing before the second
      // (Price) createMapping call ever ran, by deleting the CommerceProviderMapping rows this
      // run just wrote — reproducing exactly the DB state a real partial failure leaves behind:
      // live Stripe objects that exist, with no mapping row pointing at them.
      const firstRun = await syncOne(stripe);
      expect(firstRun.errors).toHaveLength(0);
      await prisma.commerceProviderMapping.deleteMany({ where: { commerceProductId: product.id } });
      expect(await findProductMapping("STRIPE", "LIVE", product.id)).toBeNull();
      expect(await findPriceMapping("STRIPE", "LIVE", price.id)).toBeNull();
      const stripeProductIdFromFirstRun = Array.from(products.values()).find((p) => p.metadata.quantara_product_code === product.code)?.id;
      const stripePriceIdFromFirstRun = Array.from(prices.values()).find((p) => p.metadata.quantara_price_code === price.code)?.id;

      // Retry: the plan sees no mapping (exactly like after a real partial failure) and would
      // normally re-emit CREATE, but the authoritative LIST scan now finds the SAME objects the
      // first attempt already created.
      const retryResult = await syncOne(stripe);

      expect(retryResult.errors).toHaveLength(0);
      // Not called again FOR THIS product/price specifically (the retry's syncOne() may still
      // legitimately call create for unrelated still-unmapped fixtures left behind by earlier
      // tests in this describe block — that pollution is not what this test is about).
      expect(stripe.products.create.mock.calls.filter(([params]: [{ metadata?: Record<string, string> }]) => params?.metadata?.quantara_product_code === product.code)).toHaveLength(1);
      expect(stripe.prices.create.mock.calls.filter(([params]: [{ metadata?: Record<string, string> }]) => params?.metadata?.quantara_price_code === price.code)).toHaveLength(1);
      expect(Array.from(products.values()).filter((p) => p.metadata.quantara_product_code === product.code)).toHaveLength(1);
      expect(Array.from(prices.values()).filter((p) => p.metadata.quantara_price_code === price.code)).toHaveLength(1);
      const recoveredProductMapping = await findProductMapping("STRIPE", "LIVE", product.id);
      const recoveredPriceMapping = await findPriceMapping("STRIPE", "LIVE", price.id);
      expect(recoveredProductMapping?.providerProductId).toBe(stripeProductIdFromFirstRun);
      expect(recoveredPriceMapping?.providerPriceId).toBe(stripePriceIdFromFirstRun);
    });
  });
});
