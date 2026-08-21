import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import type { PlatformRequestMetadata } from "../src/lib/repositories/platform-admin-repository";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { STRIPE_API_VERSION } from "../src/lib/payments/stripe-client";
import {
  createEnterpriseSalesCheckoutSession,
  ENTERPRISE_SALES_LED_PRICE_CODES,
  isEnterpriseSalesLedPriceCode,
} from "../src/lib/services/enterprise-sales-checkout-service";
import { createCommerceCheckoutSession } from "../src/lib/services/commerce-checkout-service";
import { processStripeWebhookEvent } from "../src/lib/services/stripe-webhook-service";
import { upsertCommerceProduct, upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";
import { enterpriseCheckoutRequestSchema } from "../src/lib/validation/commerce-schema";
import { seedEnterpriseCommerceProducts } from "../prisma/seed-data/commerce-products";
import { TAYQAN_PRODUCT_FAMILY } from "../src/lib/tayqan/tayqan-commerce";

const RUN_ID = `${Date.now()}-${process.pid}-entsales`;

const ENTERPRISE_CORE_PRICE_CODE = "enterprise_core_annual_aed_15000";
const ENTERPRISE_SCALE_PRICE_CODE = "enterprise_scale_annual_aed_25000";
const ENTERPRISE_AUTHORITY_PRICE_CODE = "enterprise_authority_annual_aed_35000";
const ALL_REAL_ENTERPRISE_PRICE_CODES = [
  ENTERPRISE_CORE_PRICE_CODE,
  ENTERPRISE_SCALE_PRICE_CODE,
  ENTERPRISE_AUTHORITY_PRICE_CODE,
];

const requestMetadata: PlatformRequestMetadata = {
  method: "POST",
  path: "/api/admin/commerce/enterprise-checkout",
};

let globalCustomerCounter = 0;
let globalSessionCounter = 0;

type OpenSessionFixture = {
  id: string;
  url: string;
  metadata: Record<string, string>;
};

/**
 * Mocked Stripe. Never a real Stripe account, never a real network call —
 * every assertion in this file about "Stripe" is an assertion about the exact
 * parameters this app hands to the Stripe SDK, not about Stripe's own
 * behavior. Defaults to "this customer has no subscriptions and no open
 * sessions"; individual tests override per case.
 */
function mockStripeClient(options: { openSessions?: OpenSessionFixture[]; subscriptions?: unknown[] } = {}) {
  return {
    customers: {
      create: vi.fn(async () => ({ id: `cus_entsales_${RUN_ID}_${++globalCustomerCounter}` })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: options.subscriptions ?? [], has_more: false })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => {
          const n = ++globalSessionCounter;
          return { id: `cs_entsales_${RUN_ID}_${n}`, url: `https://checkout.stripe.com/test/entsales_${RUN_ID}_${n}` };
        }),
        list: vi.fn(async () => ({ data: options.openSessions ?? [], has_more: false })),
        expire: vi.fn(async (id: string) => ({ id, status: "expired" })),
      },
    },
    // `any` deliberately: this mock is reconfigured post-construction and read
    // back through `.mock.calls`, which a `Stripe`-typed cast would break.
    // (The no-explicit-any rule is not registered for tests/** in this repo.)
  } as any;
}

function platformActor(userId: string, companyId: string, role: "PLATFORM_OWNER" | "PLATFORM_ADMIN" | "PLATFORM_SUPPORT" = "PLATFORM_OWNER"): PlatformActor {
  return { userId, companyId, platformRole: role, fullName: "Enterprise Sales Operator", email: `entsales-op-${RUN_ID}@example.com` };
}

function fakeSubscriptionEvent(input: { id: string; subscriptionId: string; stripeCustomerId: string }) {
  return {
    id: input.id,
    type: "customer.subscription.created",
    livemode: false,
    api_version: STRIPE_API_VERSION,
    data: { object: { id: input.subscriptionId, customer: input.stripeCustomerId } },
  } as unknown as Stripe.Event;
}

function fakeCurrentSubscription(input: {
  subscriptionId: string;
  stripeCustomerId: string;
  providerPriceId: string;
  status?: string;
}) {
  const now = Math.floor(Date.UTC(2026, 0, 1) / 1000);
  return {
    id: input.subscriptionId,
    customer: input.stripeCustomerId,
    status: input.status ?? "active",
    livemode: false,
    canceled_at: null,
    items: {
      data: [
        {
          id: `si_${input.subscriptionId}`,
          price: { id: input.providerPriceId },
          current_period_start: now,
          current_period_end: now + 365 * 24 * 3600,
        },
      ],
    },
  };
}

function webhookClientReturning(subscription: unknown) {
  return { subscriptions: { retrieve: vi.fn(async () => subscription) } } as unknown as Stripe;
}

describe("enterprise sales-led checkout (integration, real local Postgres, mocked Stripe)", () => {
  /** Has NO StripeBillingCustomer at start — proves safe creation + persistence. */
  let freshCompanyId: string;
  /** Has a pre-existing Quantara-owned StripeBillingCustomer — proves reuse. */
  let existingCustomerCompanyId: string;
  const existingStripeCustomerId = `cus_preexisting_${RUN_ID}`;
  /** Already holds a non-final CompanySoftwareSubscription — proves the double-billing guard. */
  let subscribedCompanyId: string;
  /** Used for the self-serve regression checks. */
  let selfServeCompanyId: string;
  /** End-to-end fulfillment target. */
  let fulfillmentCompanyId: string;

  let ownerUserId: string;
  let selfServeUserId: string;
  let testSoftwarePlanId: string;

  let enterpriseCoreProviderPriceId: string;
  let directPriceCode: string;

  const originalMode = process.env.STRIPE_MODE;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalBaseUrl = process.env.APP_BASE_URL;

  beforeAll(async () => {
    // Target-only and idempotent: this suite depends on the three real
    // Enterprise catalogue anchors, so it must create them itself rather
    // than relying on another test or the full catalogue seed having run.
    await seedEnterpriseCommerceProducts(prisma);

    const mk = async (label: string) =>
      prisma.company.create({
        data: { legalName: `${label} ${RUN_ID}`, tradeName: label, email: `entsales-${label.toLowerCase().replace(/\s+/g, "-")}-${RUN_ID}@example.com` },
      });

    freshCompanyId = (await mk("Fresh Enterprise Co")).id;
    existingCustomerCompanyId = (await mk("Existing Customer Co")).id;
    subscribedCompanyId = (await mk("Already Subscribed Co")).id;
    selfServeCompanyId = (await mk("Self Serve Co")).id;
    fulfillmentCompanyId = (await mk("Fulfillment Co")).id;

    const owner = await prisma.user.create({
      data: {
        companyId: freshCompanyId,
        email: `entsales-op-${RUN_ID}@example.com`,
        passwordHash: "hash",
        fullName: "Enterprise Sales Operator",
        role: "COMPANY_OWNER",
        platformRole: "PLATFORM_OWNER",
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    ownerUserId = owner.id;

    const selfServeUser = await prisma.user.create({
      data: {
        companyId: selfServeCompanyId,
        email: `entsales-selfserve-${RUN_ID}@example.com`,
        passwordHash: "hash",
        fullName: "Self Serve Owner",
        role: "COMPANY_OWNER",
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    selfServeUserId = selfServeUser.id;

    // The company that already has a Quantara-owned Stripe customer.
    await createStripeBillingCustomer(existingCustomerCompanyId, existingStripeCustomerId, false);

    // A company that already holds a non-final core software subscription.
    const plan = await prisma.softwarePlan.create({
      data: { key: `test_entsales_plan_${RUN_ID}`, name: "Enterprise Sales Test Plan", planType: "PRO", maxProjects: 3 },
    });
    testSoftwarePlanId = plan.id;
    await prisma.companySoftwareSubscription.create({
      data: {
        companyId: subscribedCompanyId,
        softwarePlanId: testSoftwarePlanId,
        status: "ACTIVE",
        source: "stripe",
        externalSubscriptionId: `sub_existing_${RUN_ID}`,
      },
    });

    /**
     * Approve the REAL enterprise_core and enterprise_scale anchor prices,
     * always setting reviewedByUserId in the same write (an APPROVED price
     * with a null reviewer violates a catalogue invariant asserted elsewhere
     * in this suite). enterprise_authority is deliberately left
     * REQUIRES_REVIEW so the PRICE_NOT_APPROVED path is proven against a real
     * row. afterAll resets all three BEFORE deleting ownerUser, because
     * CommercePrice.reviewedByUserId is onDelete: SetNull and would otherwise
     * silently leave an APPROVED row with a null reviewer behind.
     */
    await prisma.commercePrice.updateMany({
      where: { code: { in: [ENTERPRISE_CORE_PRICE_CODE, ENTERPRISE_SCALE_PRICE_CODE] } },
      data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId, reviewedAt: new Date() },
    });

    // A synchronized TEST-environment Stripe mapping for enterprise_core
    // only. enterprise_scale is approved but deliberately UNMAPPED, so the
    // PROVIDER_MAPPING_MISSING fail-closed path is proven against a real row.
    const corePrice = await prisma.commercePrice.findUniqueOrThrow({ where: { code: ENTERPRISE_CORE_PRICE_CODE } });
    enterpriseCoreProviderPriceId = `price_test_entcore_${RUN_ID}`;
    await createMapping({
      provider: "STRIPE",
      environment: "TEST",
      commerceProductId: corePrice.productId,
      commercePriceId: corePrice.id,
      providerProductId: `prod_test_entcore_${RUN_ID}`,
      providerPriceId: enterpriseCoreProviderPriceId,
      providerObjectType: "PRICE",
    });

    // A normal DIRECT self-serve product, for the "unchanged flows" checks.
    const { product: directProduct } = await upsertCommerceProduct({
      code: `test_entsales_direct_product_${RUN_ID}`,
      type: "SUBSCRIPTION",
      name: "Direct Regression Product",
      purchaseMode: "DIRECT",
      isActive: true,
      isPublic: true,
      industryPackageId: null,
    });
    const { price: dPrice } = await upsertCommercePrice({
      productId: directProduct.id,
      code: `test_entsales_direct_price_${RUN_ID}`,
      amountMinor: 14900,
      billingInterval: "MONTH",
      isActive: true,
    });
    await prisma.commercePrice.update({ where: { id: dPrice.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId, reviewedAt: new Date() } });
    directPriceCode = dPrice.code;
    await createMapping({
      provider: "STRIPE",
      environment: "TEST",
      commerceProductId: directProduct.id,
      commercePriceId: dPrice.id,
      providerProductId: `prod_test_entsales_direct_${RUN_ID}`,
      providerPriceId: `price_test_entsales_direct_${RUN_ID}`,
      providerObjectType: "PRICE",
    });
  });

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_key_not_real";
    delete process.env.STRIPE_MODE; // → getConfiguredStripeMode() === "test" → environment TEST
    process.env.APP_BASE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
    if (originalBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = originalBaseUrl;
  });

  afterAll(async () => {
    const companyIds = [freshCompanyId, existingCustomerCompanyId, subscribedCompanyId, selfServeCompanyId, fulfillmentCompanyId];

    // Mappings attached to the REAL enterprise products must be removed
    // explicitly — they are not cascaded by any RUN_ID-scoped delete below.
    await prisma.commerceProviderMapping.deleteMany({ where: { providerPriceId: { contains: RUN_ID } } });
    await prisma.commerceProviderMapping.deleteMany({ where: { providerProductId: { contains: RUN_ID } } });

    // Restore the shared enterprise anchor prices to their seeded state
    // BEFORE deleting the reviewing user (onDelete: SetNull on the reviewer FK).
    await prisma.commercePrice.updateMany({
      where: { code: { in: ALL_REAL_ENTERPRISE_PRICE_CODES } },
      data: { reviewStatus: "REQUIRES_REVIEW", reviewedByUserId: null, reviewedAt: null },
    });

    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.stripeWebhookEvent.deleteMany({ where: { stripeEventId: { contains: RUN_ID } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.softwarePlan.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, selfServeUserId] } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // 1. Existing Quantara Stripe customer is reused
  // -------------------------------------------------------------------------

  it("(1) reuses the company's EXISTING Quantara-owned Stripe customer and never mints a second one", async () => {
    // Note the operator's OWN company here is freshCompanyId while the target
    // is existingCustomerCompanyId — so this also proves the session is bound
    // to the company named in the request, never to the acting operator's
    // company.
    const stripe = mockStripeClient();
    const result = await createEnterpriseSalesCheckoutSession(
      platformActor(ownerUserId, freshCompanyId),
      { companyId: existingCustomerCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
      requestMetadata,
      stripe,
    );

    expect(result.stripeCustomerId).toBe(existingStripeCustomerId);
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create.mock.calls[0][0].customer).toBe(existingStripeCustomerId);

    // Still exactly one billing-customer row for this company/mode.
    const rows = await prisma.stripeBillingCustomer.findMany({ where: { companyId: existingCustomerCompanyId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].stripeCustomerId).toBe(existingStripeCustomerId);
    expect(rows[0].livemode).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 2. Company with no Stripe customer gets one safely created and persisted
  // -------------------------------------------------------------------------

  it("(2) creates AND persists a Quantara-owned StripeBillingCustomer for a company that has never had one", async () => {
    expect(await prisma.stripeBillingCustomer.findMany({ where: { companyId: fulfillmentCompanyId } })).toHaveLength(0);

    const stripe = mockStripeClient();
    const result = await createEnterpriseSalesCheckoutSession(
      platformActor(ownerUserId, freshCompanyId),
      { companyId: fulfillmentCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
      requestMetadata,
      stripe,
    );

    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    const [createParams, createOptions] = stripe.customers.create.mock.calls[0];
    // The Stripe customer is stamped with the internal company ID and created
    // under a deterministic idempotency key, exactly as self-serve does.
    expect(createParams.metadata).toEqual({ quantara_company_id: fulfillmentCompanyId });
    expect(createOptions.idempotencyKey).toBe(`quantara:test:customer:${fulfillmentCompanyId}`);
    // The platform operator's own address is never attached to the customer's
    // Stripe record — only the company's own email is used.
    expect(createParams.email).toBe(`entsales-fulfillment-co-${RUN_ID}@example.com`);

    const persisted = await prisma.stripeBillingCustomer.findMany({ where: { companyId: fulfillmentCompanyId } });
    expect(persisted).toHaveLength(1);
    expect(persisted[0].stripeCustomerId).toBe(result.stripeCustomerId);
    expect(persisted[0].livemode).toBe(false);

    // This persisted row is the ONLY thing that makes webhook fulfillment
    // possible — asserted end-to-end in test (4) below.
    expect(result.stripeCustomerId).toMatch(/^cus_entsales_/);
  });

  // -------------------------------------------------------------------------
  // 3. Enterprise checkout uses the exact approved, mapped Stripe Price
  // -------------------------------------------------------------------------

  it("(3) creates a mode:subscription Checkout Session bound to the Quantara customer, using EXACTLY the approved mapped Stripe Price — never a caller-supplied amount, currency, or price ID", async () => {
    const stripe = mockStripeClient();
    const result = await createEnterpriseSalesCheckoutSession(
      platformActor(ownerUserId, freshCompanyId),
      { companyId: existingCustomerCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
      requestMetadata,
      stripe,
    );

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.mode).toBe("subscription");
    expect(params.customer).toBe(existingStripeCustomerId);

    // Read the authoritative mapping straight from the database and require
    // the session to have used precisely that Stripe price, once.
    const mapping = await prisma.commerceProviderMapping.findFirstOrThrow({
      where: { provider: "STRIPE", environment: "TEST", providerPriceId: enterpriseCoreProviderPriceId, providerObjectType: "PRICE" },
    });
    expect(params.line_items).toEqual([{ price: mapping.providerPriceId, quantity: 1 }]);
    expect(params.line_items).toHaveLength(1);

    // No amount/currency is ever handed to Stripe by this path — the amount
    // lives on the mapped Stripe Price, not on the session.
    expect(params.line_items[0]).not.toHaveProperty("price_data");
    expect(params).not.toHaveProperty("amount");
    expect(params).not.toHaveProperty("currency");

    // The commercial facts reported back to the operator match the approved
    // catalogue row exactly (AED 15,000.00 / year).
    expect(result.productCode).toBe("enterprise_core");
    expect(result.priceCode).toBe(ENTERPRISE_CORE_PRICE_CODE);
    expect(result.amountMinor).toBe(1500000);
    expect(result.currency).toBe("AED");
    expect(result.billingInterval).toBe("YEAR");
    expect(result.environment).toBe("TEST");
    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    // Tenant identity is carried by `customer`, not by metadata; metadata is
    // traceability only.
    expect(params.metadata.quantara_company_id).toBe(existingCustomerCompanyId);
    expect(params.metadata.quantara_checkout_channel).toBe("sales_led_enterprise");

    // The action is recorded on the operator audit trail.
    const audit = await prisma.platformAuditLog.findFirst({
      where: { actorUserId: ownerUserId, action: "commerce_enterprise_checkout.issue_session", targetId: existingCustomerCompanyId },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 4. Completed webhook grants the correct Enterprise SoftwarePlan
  // -------------------------------------------------------------------------

  it("(4) END-TO-END: issuing a session, then the resulting subscription's webhook, automatically grants the correct company the commerce_enterprise_core plan", async () => {
    // Step 1 — sales issues the session for a company with no Stripe customer.
    const stripe = mockStripeClient();
    const issued = await createEnterpriseSalesCheckoutSession(
      platformActor(ownerUserId, freshCompanyId),
      { companyId: freshCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
      requestMetadata,
      stripe,
    );
    const quantaraOwnedCustomerId = issued.stripeCustomerId;

    // Step 2 — the customer pays. Stripe raises customer.subscription.created
    // for a subscription on THAT customer, carrying the mapped price.
    const subscriptionId = `sub_entcore_${RUN_ID}`;
    const event = fakeSubscriptionEvent({
      id: `evt_entcore_${RUN_ID}`,
      subscriptionId,
      stripeCustomerId: quantaraOwnedCustomerId,
    });
    const current = fakeCurrentSubscription({
      subscriptionId,
      stripeCustomerId: quantaraOwnedCustomerId,
      providerPriceId: enterpriseCoreProviderPriceId,
    });

    const outcome = await processStripeWebhookEvent(event, webhookClientReturning(current));
    expect(outcome).toEqual({ outcome: "processed", eventType: "customer.subscription.created" });

    // Step 3 — the correct company now holds the correct Enterprise plan.
    const subscription = await prisma.companySoftwareSubscription.findUnique({
      where: { externalSubscriptionId: subscriptionId },
      include: { softwarePlan: true },
    });
    expect(subscription).not.toBeNull();
    expect(subscription!.companyId).toBe(freshCompanyId);
    expect(subscription!.softwarePlan.key).toBe("commerce_enterprise_core");
    expect(subscription!.status).toBe("ACTIVE");
    expect(subscription!.source).toBe("stripe");

    // And no other company was touched.
    const strayRows = await prisma.companySoftwareSubscription.findMany({
      where: { externalSubscriptionId: subscriptionId, companyId: { not: freshCompanyId } },
    });
    expect(strayRows).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 5. Unknown Stripe customer grants nothing
  // -------------------------------------------------------------------------

  it("(5) a subscription on an UNKNOWN Stripe customer (the bare Payment Link failure mode) grants nothing to anyone — no metadata or email fallback exists", async () => {
    const before = await prisma.companySoftwareSubscription.count();

    const subscriptionId = `sub_unknown_cust_${RUN_ID}`;
    const unknownCustomerId = `cus_not_quantara_owned_${RUN_ID}`;
    const event = fakeSubscriptionEvent({ id: `evt_unknown_cust_${RUN_ID}`, subscriptionId, stripeCustomerId: unknownCustomerId });
    const current = fakeCurrentSubscription({
      subscriptionId,
      stripeCustomerId: unknownCustomerId,
      providerPriceId: enterpriseCoreProviderPriceId,
    });

    const outcome = await processStripeWebhookEvent(event, webhookClientReturning(current));
    // The event is consumed (ledgered) but applies no state at all.
    expect(outcome).toEqual({ outcome: "processed", eventType: "customer.subscription.created" });

    expect(await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } })).toBeNull();
    expect(await prisma.companySoftwareSubscription.count()).toBe(before);

    const ledger = await prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: `evt_unknown_cust_${RUN_ID}` } });
    expect(ledger).not.toBeNull();
    expect(ledger!.companyId).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. Wrong / non-Enterprise price codes are rejected
  // -------------------------------------------------------------------------

  it("(6a) rejects a non-Enterprise price code at the service boundary, before any Stripe call", async () => {
    const stripe = mockStripeClient();
    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, freshCompanyId),
        { companyId: freshCompanyId, priceCode: directPriceCode },
        requestMetadata,
        stripe,
      ),
    ).rejects.toMatchObject({ reason: "PRICE_CODE_NOT_ENTERPRISE" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  it("(6b) the request schema accepts ONLY the three Enterprise codes and strips no extra field silently", () => {
    for (const code of ALL_REAL_ENTERPRISE_PRICE_CODES) {
      expect(enterpriseCheckoutRequestSchema.safeParse({ companyId: freshCompanyId, priceCode: code }).success).toBe(true);
      expect(isEnterpriseSalesLedPriceCode(code)).toBe(true);
    }
    expect(enterpriseCheckoutRequestSchema.safeParse({ companyId: freshCompanyId, priceCode: "starter_monthly_aed_149" }).success).toBe(false);
    expect(isEnterpriseSalesLedPriceCode("starter_monthly_aed_149")).toBe(false);
    expect(isEnterpriseSalesLedPriceCode("enterprise_installation_from_aed_15000")).toBe(false);

    // Untrusted commercial/Stripe facts are rejected outright, never ignored.
    for (const extra of [
      { amountMinor: 1 },
      { currency: "USD" },
      { providerPriceId: "price_attacker" },
      { stripeCustomerId: "cus_attacker" },
      { metadata: { quantara_company_id: "someone-else" } },
    ]) {
      const parsed = enterpriseCheckoutRequestSchema.safeParse({ companyId: freshCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE, ...extra });
      expect(parsed.success).toBe(false);
    }
  });

  it("(6c) fails closed on a real approved-but-unsynchronized Enterprise price (enterprise_scale) and on a real unapproved one (enterprise_authority)", async () => {
    const stripe = mockStripeClient();
    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, freshCompanyId),
        { companyId: existingCustomerCompanyId, priceCode: ENTERPRISE_SCALE_PRICE_CODE },
        requestMetadata,
        stripe,
      ),
    ).rejects.toMatchObject({ reason: "PROVIDER_MAPPING_MISSING" });

    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, freshCompanyId),
        { companyId: existingCustomerCompanyId, priceCode: ENTERPRISE_AUTHORITY_PRICE_CODE },
        requestMetadata,
        stripe,
      ),
    ).rejects.toMatchObject({ reason: "PRICE_NOT_APPROVED" });

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("(6d) rejects an unknown company and a PLATFORM_SUPPORT actor", async () => {
    const stripe = mockStripeClient();
    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, freshCompanyId),
        { companyId: "00000000-0000-4000-8000-000000000000", priceCode: ENTERPRISE_CORE_PRICE_CODE },
        requestMetadata,
        stripe,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, freshCompanyId, "PLATFORM_SUPPORT"),
        { companyId: existingCustomerCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
        requestMetadata,
        stripe,
      ),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 7. Normal /api/commerce/checkout still cannot buy Enterprise
  // -------------------------------------------------------------------------

  it("(7) self-serve checkout still rejects all three REAL Enterprise price codes with PRODUCT_NOT_DIRECT_PURCHASE, even now that they are approved and mapped", async () => {
    const actor: CurrentActor = {
      userId: selfServeUserId,
      companyId: selfServeCompanyId,
      role: "COMPANY_OWNER",
      fullName: "Self Serve Owner",
      email: `entsales-selfserve-${RUN_ID}@example.com`,
    };

    for (const code of ALL_REAL_ENTERPRISE_PRICE_CODES) {
      const stripe = mockStripeClient();
      await expect(createCommerceCheckoutSession(actor, { priceCode: code }, stripe)).rejects.toMatchObject({
        reason: "PRODUCT_NOT_DIRECT_PURCHASE",
      });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(stripe.customers.create).not.toHaveBeenCalled();
    }
  });

  // -------------------------------------------------------------------------
  // 8. Existing flows unchanged
  // -------------------------------------------------------------------------

  it("(8a) normal DIRECT self-serve checkout is unchanged: it still creates a session and persists exactly one StripeBillingCustomer", async () => {
    const actor: CurrentActor = {
      userId: selfServeUserId,
      companyId: selfServeCompanyId,
      role: "COMPANY_OWNER",
      fullName: "Self Serve Owner",
      email: `entsales-selfserve-${RUN_ID}@example.com`,
    };
    const stripe = mockStripeClient();
    const result = await createCommerceCheckoutSession(actor, { priceCode: directPriceCode }, stripe);

    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(stripe.checkout.sessions.create.mock.calls[0][0].mode).toBe("subscription");

    const rows = await prisma.stripeBillingCustomer.findMany({ where: { companyId: selfServeCompanyId } });
    expect(rows).toHaveLength(1);

    // The refactored customer resolution still stamps the acting user's email
    // as the fallback for self-serve (unchanged behavior).
    const [createParams] = stripe.customers.create.mock.calls[0];
    expect(createParams.metadata).toEqual({ quantara_company_id: selfServeCompanyId });
  });

  it("(8b) Enterprise checkout never expires a TAYQAN-owned open session for the same company", async () => {
    const tayqanSession: OpenSessionFixture = {
      id: `cs_tayqan_${RUN_ID}`,
      url: `https://checkout.stripe.com/test/tayqan_${RUN_ID}`,
      metadata: { quantara_company_id: existingCustomerCompanyId, quantara_product_family: TAYQAN_PRODUCT_FAMILY },
    };
    const stripe = mockStripeClient({ openSessions: [tayqanSession] });

    await createEnterpriseSalesCheckoutSession(
      platformActor(ownerUserId, freshCompanyId),
      { companyId: existingCustomerCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
      requestMetadata,
      stripe,
    );

    expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it("(8c) re-issuing the same Enterprise link reuses the open session instead of minting a second payable one", async () => {
    const openSession: OpenSessionFixture = {
      id: `cs_reuse_${RUN_ID}`,
      url: `https://checkout.stripe.com/test/reuse_${RUN_ID}`,
      metadata: { quantara_company_id: existingCustomerCompanyId, quantara_price_code: ENTERPRISE_CORE_PRICE_CODE },
    };
    const stripe = mockStripeClient({ openSessions: [openSession] });

    const result = await createEnterpriseSalesCheckoutSession(
      platformActor(ownerUserId, freshCompanyId),
      { companyId: existingCustomerCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
      requestMetadata,
      stripe,
    );

    expect(result.reusedExistingSession).toBe(true);
    expect(result.checkoutSessionId).toBe(openSession.id);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("(8c2) fails closed before any Stripe expiry or create when an abnormal number of stale Enterprise checkout sessions exist", async () => {
    const staleSessions: OpenSessionFixture[] = Array.from({ length: 21 }, (_value, index) => ({
      id: `cs_many_stale_${RUN_ID}_${index}`,
      url: `https://checkout.stripe.com/test/many_stale_${RUN_ID}_${index}`,
      metadata: {
        quantara_company_id: existingCustomerCompanyId,
        quantara_price_code: `stale_price_${index}`,
      },
    }));

    const stripe = mockStripeClient({ openSessions: staleSessions });

    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, freshCompanyId),
        { companyId: existingCustomerCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
        requestMetadata,
        stripe,
      ),
    ).rejects.toMatchObject({ code: "STRIPE_STALE_SESSION_LIMIT_EXCEEDED" });

    // Fail closed before partial provider-side mutation. None of the stale
    // sessions is expired and no additional payable session is created.
    expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("(8d) refuses to issue an Enterprise link for a company that already holds a non-final software subscription (no silent double-billing)", async () => {
    const stripe = mockStripeClient();
    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, freshCompanyId),
        { companyId: subscribedCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
        requestMetadata,
        stripe,
      ),
    ).rejects.toMatchObject({ reason: "EXISTING_SUBSCRIPTION" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("(8e) refuses to issue an Enterprise link when Stripe itself already reports a live core subscription whose webhook has not landed yet", async () => {
    const stripe = mockStripeClient({
      subscriptions: [
        {
          id: `sub_stripe_side_${RUN_ID}`,
          status: "active",
          items: { data: [{ price: { id: enterpriseCoreProviderPriceId } }] },
        },
      ],
    });

    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, freshCompanyId),
        { companyId: existingCustomerCompanyId, priceCode: ENTERPRISE_CORE_PRICE_CODE },
        requestMetadata,
        stripe,
      ),
    ).rejects.toMatchObject({ reason: "EXISTING_SUBSCRIPTION" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("(8f) the allowlist binds each price code to its exact product code", () => {
    expect(ENTERPRISE_SALES_LED_PRICE_CODES).toEqual({
      enterprise_core_annual_aed_15000: "enterprise_core",
      enterprise_scale_annual_aed_25000: "enterprise_scale",
      enterprise_authority_annual_aed_35000: "enterprise_authority",
    });
  });
});
