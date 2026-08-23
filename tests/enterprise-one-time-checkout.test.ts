import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { STRIPE_API_VERSION } from "../src/lib/payments/stripe-client";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";
import { getCheckoutAvailability } from "../src/lib/services/commerce-checkout-availability-service";
import { createCommerceCheckoutSession } from "../src/lib/services/commerce-checkout-service";
import { ensureEnterpriseSelfCheckoutPriceReady } from "../src/lib/services/enterprise-self-checkout-readiness-service";
import { processStripeWebhookEvent } from "../src/lib/services/stripe-webhook-service";
import { seedEnterpriseCommerceProducts } from "../prisma/seed-data/commerce-products";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

const RUN_ID = `${Date.now()}-${process.pid}-enterprise-one-time`;
const ENTERPRISE = [
  {
    productCode: "enterprise_core",
    priceCode: "enterprise_core_one_time_aed_15000",
    amountMinor: 1_500_000,
  },
  {
    productCode: "enterprise_scale",
    priceCode: "enterprise_scale_one_time_aed_25000",
    amountMinor: 2_500_000,
  },
  {
    productCode: "enterprise_authority",
    priceCode: "enterprise_authority_one_time_aed_35000",
    amountMinor: 3_500_000,
  },
] as const;

const RECURRING = [
  { productCode: "starter", monthlyCode: "starter_monthly_aed_149", annualCode: "starter_annual_aed_1490" },
  { productCode: "professional", monthlyCode: "professional_monthly_aed_399", annualCode: "professional_annual_aed_3990" },
  { productCode: "business", monthlyCode: "business_monthly_aed_899", annualCode: "business_annual_aed_8990" },
] as const;
const LEGACY_CORE_ANNUAL_PRICE_CODE = "enterprise_core_annual_aed_15000";

let customerCounter = 0;
let sessionCounter = 0;
let providerObjectCounter = 0;

function checkoutStripeClient(options: { completedSessions?: Stripe.Checkout.Session[] } = {}) {
  const providerProducts: Stripe.Product[] = [];
  const providerPrices: Stripe.Price[] = [];
  return {
    products: {
      list: vi.fn(async () => ({ data: providerProducts, has_more: false })),
      create: vi.fn(async (params: { name: string; description?: string; active: boolean; metadata: Record<string, string> }) => {
        const product = {
          id: `prod_test_enterprise_${params.metadata.quantara_product_code}_${RUN_ID}_${++providerObjectCounter}`,
          object: "product",
          ...params,
        } as unknown as Stripe.Product;
        providerProducts.push(product);
        return product;
      }),
    },
    prices: {
      list: vi.fn(async () => ({ data: providerPrices, has_more: false })),
      create: vi.fn(async (params: { metadata: Record<string, string>; product: string; unit_amount: number; currency: string }) => {
        const price = {
          id: `price_test_enterprise_${params.metadata.quantara_price_code}_${RUN_ID}_${++providerObjectCounter}`,
          object: "price",
          active: true,
          type: "one_time",
          ...params,
        } as unknown as Stripe.Price;
        providerPrices.push(price);
        return price;
      }),
    },
    customers: {
      create: vi.fn(async () => ({ id: `cus_enterprise_checkout_${RUN_ID}_${++customerCounter}` })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: [], has_more: false })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => {
          const id = `cs_enterprise_checkout_${RUN_ID}_${++sessionCounter}`;
          return { id, url: `https://checkout.stripe.com/test/${id}` };
        }),
        list: vi.fn(async (params: { status?: string }) => ({
          data: params.status === "open" ? [] : (options.completedSessions ?? []),
          has_more: false,
        })),
        expire: vi.fn(async (id: string) => ({ id, status: "expired" })),
      },
    },
  } as any;
}

function webhookStripeClient(providerPriceId: string) {
  return {
    checkout: {
      sessions: {
        listLineItems: vi.fn(async () => ({
          data: [{ price: { id: providerPriceId }, quantity: 1 }],
          has_more: false,
        })),
      },
    },
  } as any;
}

function checkoutEvent(input: {
  eventId: string;
  sessionId: string;
  eventType: "checkout.session.completed" | "checkout.session.async_payment_succeeded" | "checkout.session.async_payment_failed";
  stripeCustomerId: string;
  amountMinor: number;
  paymentStatus: "paid" | "unpaid";
  metadataCompanyId?: string;
}): Stripe.Event {
  return {
    id: input.eventId,
    type: input.eventType,
    livemode: false,
    api_version: STRIPE_API_VERSION,
    data: {
      object: {
        id: input.sessionId,
        object: "checkout.session",
        livemode: false,
        mode: "payment",
        payment_status: input.paymentStatus,
        customer: input.stripeCustomerId,
        amount_total: input.amountMinor,
        currency: "aed",
        created: Math.floor(Date.now() / 1000),
        metadata: {
          quantara_checkout_mode: "ENTERPRISE_ONE_TIME",
          quantara_company_id: input.metadataCompanyId ?? "untrusted-metadata-company",
        },
      },
    },
  } as unknown as Stripe.Event;
}

describe("Enterprise one-time Stripe checkout", () => {
  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];
  const providerPriceIds = new Map<string, string>();
  const originalMode = process.env.STRIPE_MODE;
  const originalBaseUrl = process.env.APP_BASE_URL;
  const originalPlatformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL;

  async function resetEnterpriseCatalogue(): Promise<void> {
    await prisma.commercePrice.deleteMany({
      where: { code: { in: ENTERPRISE.map((item) => item.priceCode) } },
    });
    await prisma.commerceProduct.deleteMany({
      where: { code: { in: ENTERPRISE.map((item) => item.productCode) } },
    });
  }

  async function enterpriseCatalogueState() {
    const [productCount, priceCount, mappings] = await Promise.all([
      prisma.commerceProduct.count({ where: { code: { in: ENTERPRISE.map((item) => item.productCode) } } }),
      prisma.commercePrice.count({ where: { code: { in: ENTERPRISE.map((item) => item.priceCode) } } }),
      prisma.commerceProviderMapping.findMany({
        select: {
          commerceProduct: { select: { code: true } },
          commercePrice: { select: { code: true } },
        },
      }),
    ]);
    const mappingCount = mappings.filter(
      (mapping) =>
        ENTERPRISE.some((item) => item.productCode === mapping.commerceProduct.code) ||
        ENTERPRISE.some((item) => item.priceCode === mapping.commercePrice?.code),
    ).length;
    return { productCount, priceCount, mappingCount };
  }

  async function refreshProviderPriceIds(): Promise<void> {
    providerPriceIds.clear();
    for (const item of ENTERPRISE) {
      const price = await prisma.commercePrice.findUniqueOrThrow({ where: { code: item.priceCode } });
      const mapping = await prisma.commerceProviderMapping.findFirstOrThrow({
        where: {
          provider: "STRIPE",
          environment: "TEST",
          commercePriceId: price.id,
          providerObjectType: "PRICE",
        },
      });
      providerPriceIds.set(item.priceCode, mapping.providerPriceId!);
    }
  }

  async function prepareAllEnterpriseMappingsWithoutManualApproval(): Promise<void> {
    const stripe = checkoutStripeClient();
    for (const item of ENTERPRISE) {
      await ensureEnterpriseSelfCheckoutPriceReady(item.priceCode, stripe);
    }
    await refreshProviderPriceIds();
  }

  async function createActor(label: string): Promise<CurrentActor> {
    const company = await prisma.company.create({
      data: {
        legalName: `Enterprise ${label} ${RUN_ID}`,
        tradeName: `Enterprise ${label}`,
        email: `enterprise-${label}-${RUN_ID}@example.com`,
      },
    });
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `enterprise-user-${label}-${RUN_ID}@example.com`,
        passwordHash: "hash",
        fullName: `Enterprise ${label}`,
        role: "COMPANY_OWNER",
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    createdCompanyIds.push(company.id);
    createdUserIds.push(user.id);
    return {
      userId: user.id,
      companyId: company.id,
      role: "COMPANY_OWNER",
      fullName: user.fullName,
      email: user.email,
    };
  }

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    process.env.STRIPE_MODE = "test";
    process.env.APP_BASE_URL = "http://localhost:3000";
    delete process.env.PLATFORM_OWNER_EMAIL;
    await resetEnterpriseCatalogue();
  });

  afterAll(async () => {
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
    await prisma.stripeWebhookEvent.deleteMany({ where: { stripeEventId: { contains: RUN_ID } } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    await prisma.commerceProviderMapping.deleteMany({
      where: {
        OR: [
          { providerProductId: { contains: RUN_ID } },
          { providerPriceId: { contains: RUN_ID } },
        ],
      },
    });
    await resetEnterpriseCatalogue();
    await seedEnterpriseCommerceProducts(prisma);
    await prisma.commercePrice.updateMany({
      where: { code: { in: [...ENTERPRISE.map((item) => item.priceCode), ...RECURRING.flatMap((item) => [item.monthlyCode, item.annualCode])] } },
      data: { reviewStatus: "REQUIRES_REVIEW", reviewNote: null, reviewedByUserId: null, reviewedAt: null },
    });
    await prisma.commercePrice.deleteMany({ where: { code: LEGACY_CORE_ANNUAL_PRICE_CODE } });

    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
    if (originalBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = originalBaseUrl;
    if (originalPlatformOwnerEmail === undefined) delete process.env.PLATFORM_OWNER_EMAIL;
    else process.env.PLATFORM_OWNER_EMAIL = originalPlatformOwnerEmail;
    await prisma.$disconnect();
  });

  it.each(ENTERPRISE)("allows an ordinary customer to checkout $productCode from zero Enterprise catalogue state", async (item) => {
    await resetEnterpriseCatalogue();
    expect(await enterpriseCatalogueState()).toEqual({ productCount: 0, priceCount: 0, mappingCount: 0 });

    const actor = await createActor(`cold-start-${item.productCode}`);
    const storedActor = await prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { role: true, platformRole: true },
    });
    expect(storedActor).toEqual({ role: "COMPANY_OWNER", platformRole: null });
    expect(process.env.PLATFORM_OWNER_EMAIL).toBeUndefined();

    const availability = await getCheckoutAvailability(actor);
    const enterpriseOffers = availability.products.filter((product) =>
      ENTERPRISE.some((candidate) => candidate.productCode === product.productCode),
    );
    expect(enterpriseOffers).toHaveLength(3);
    expect(enterpriseOffers.map((product) => product.productCode)).toEqual(
      ENTERPRISE.map((candidate) => candidate.productCode),
    );
    for (const offer of enterpriseOffers) {
      const expected = ENTERPRISE.find((candidate) => candidate.productCode === offer.productCode)!;
      expect(offer.prices).toEqual([{
        priceCode: expected.priceCode,
        billingInterval: "ONE_TIME",
        amountMinor: expected.amountMinor,
        currency: "AED",
        available: true,
        unavailableReason: null,
      }]);
    }
    expect(await enterpriseCatalogueState()).toEqual({ productCount: 0, priceCount: 0, mappingCount: 0 });

    const stripe = checkoutStripeClient();
    const result = await createCommerceCheckoutSession(actor, { priceCode: item.priceCode }, stripe);
    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\/test\//);

    const storedPrice = await prisma.commercePrice.findUniqueOrThrow({
      where: { code: item.priceCode },
      include: { product: true },
    });
    expect(storedPrice).toMatchObject({
      amountMinor: item.amountMinor,
      currency: "AED",
      billingInterval: "ONE_TIME",
      isFromPrice: false,
      isActive: true,
      reviewStatus: "APPROVED",
      reviewedByUserId: null,
      reviewNote: "System-approved fixed Enterprise one-time catalogue price",
      product: {
        code: item.productCode,
        type: "ONE_TIME",
        purchaseMode: "DIRECT",
        isActive: true,
        isPublic: true,
        industryPackageId: null,
      },
    });
    expect(storedPrice.reviewedAt).toBeInstanceOf(Date);
    expect(await enterpriseCatalogueState()).toMatchObject({ productCount: 3, priceCount: 3, mappingCount: 2 });

    const untouchedPrices = await prisma.commercePrice.findMany({
      where: { code: { in: ENTERPRISE.filter((candidate) => candidate.priceCode !== item.priceCode).map((candidate) => candidate.priceCode) } },
    });
    expect(untouchedPrices).toHaveLength(2);
    expect(untouchedPrices.every((price) => price.reviewStatus === "REQUIRES_REVIEW")).toBe(true);

    const priceMapping = await prisma.commerceProviderMapping.findFirstOrThrow({
      where: {
        provider: "STRIPE",
        environment: "TEST",
        commercePriceId: storedPrice.id,
        providerObjectType: "PRICE",
      },
    });
    expect(priceMapping).toMatchObject({
      providerActive: true,
      synchronizationStatus: "SYNCED",
    });
    expect(priceMapping.providerPriceId).toContain(item.priceCode);

    expect(stripe.products.create).toHaveBeenCalledTimes(1);
    expect(stripe.prices.create).toHaveBeenCalledTimes(1);
    const priceCreateParams = stripe.prices.create.mock.calls[0][0];
    expect(priceCreateParams).toMatchObject({
      product: expect.stringContaining(item.productCode),
      unit_amount: item.amountMinor,
      currency: "aed",
    });
    expect(priceCreateParams).not.toHaveProperty("recurring");

    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const checkoutParams = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(checkoutParams).toMatchObject({
      mode: "payment",
      customer: expect.stringContaining("cus_enterprise_checkout"),
      line_items: [{ price: priceMapping.providerPriceId, quantity: 1 }],
      payment_intent_data: {
        metadata: {
          quantara_company_id: actor.companyId,
          quantara_price_code: item.priceCode,
          quantara_checkout_mode: "ENTERPRISE_ONE_TIME",
        },
      },
    });
    expect(checkoutParams).not.toHaveProperty("subscription_data");
    expect(checkoutParams).not.toHaveProperty("payment_method_types");

    if (item.productCode === "enterprise_authority") {
      await prepareAllEnterpriseMappingsWithoutManualApproval();
    }
  });

  it("keeps the three exact AED packages one-time with synced non-recurring Stripe Price mappings", async () => {
    for (const item of ENTERPRISE) {
      const product = await prisma.commerceProduct.findUniqueOrThrow({
        where: { code: item.productCode },
        include: { prices: true },
      });
      const price = product.prices.find((candidate) => candidate.code === item.priceCode);
      expect(product.type).toBe("ONE_TIME");
      expect(product.purchaseMode).toBe("DIRECT");
      expect(price).toMatchObject({ amountMinor: item.amountMinor, currency: "AED", billingInterval: "ONE_TIME", isActive: true });
      expect(providerPriceIds.get(item.priceCode)).toContain(item.priceCode);
    }
  });

  it("archives the superseded Enterprise annual price during the targeted seed", async () => {
    const core = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: ENTERPRISE[0].productCode } });
    await prisma.commercePrice.create({
      data: {
        productId: core.id,
        code: LEGACY_CORE_ANNUAL_PRICE_CODE,
        amountMinor: ENTERPRISE[0].amountMinor,
        currency: "AED",
        billingInterval: "YEAR",
        isActive: true,
      },
    });

    const report = await seedEnterpriseCommerceProducts(prisma);
    const legacyPrice = await prisma.commercePrice.findUniqueOrThrow({ where: { code: LEGACY_CORE_ANNUAL_PRICE_CODE } });
    expect(report.pricesArchived).toBe(1);
    expect(legacyPrice.isActive).toBe(false);
    expect(legacyPrice.validUntil).toBeInstanceOf(Date);
  });

  it("fails closed on Enterprise amount drift without approval, Stripe Price creation, or Checkout", async () => {
    const item = ENTERPRISE[0];
    const driftedPrice = await prisma.commercePrice.update({
      where: { code: item.priceCode },
      data: {
        amountMinor: 1_499_999,
        reviewStatus: "REQUIRES_REVIEW",
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
      },
    });
    await prisma.commerceProviderMapping.deleteMany({ where: { commercePriceId: driftedPrice.id } });
    const actor = await createActor("amount-drift");
    const stripe = checkoutStripeClient();

    try {
      const availability = await getCheckoutAvailability(actor);
      expect(availability.products.find((product) => product.productCode === item.productCode)?.prices[0]).toMatchObject({
        amountMinor: item.amountMinor,
        available: false,
        unavailableReason: "PRICE_NOT_APPROVED",
      });
      await expect(createCommerceCheckoutSession(actor, { priceCode: item.priceCode }, stripe)).rejects.toThrow(
        /Financial or product parameters are not valid/,
      );
      expect(await prisma.commercePrice.findUniqueOrThrow({ where: { code: item.priceCode } })).toMatchObject({
        amountMinor: 1_499_999,
        reviewStatus: "REQUIRES_REVIEW",
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNote: null,
      });
      expect(stripe.products.create).not.toHaveBeenCalled();
      expect(stripe.prices.create).not.toHaveBeenCalled();
      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(await prisma.commerceProviderMapping.count({ where: { commercePriceId: driftedPrice.id } })).toBe(0);
    } finally {
      await prisma.commercePrice.update({
        where: { code: item.priceCode },
        data: { amountMinor: item.amountMinor, reviewStatus: "REQUIRES_REVIEW" },
      });
      await ensureEnterpriseSelfCheckoutPriceReady(item.priceCode, checkoutStripeClient());
      await refreshProviderPriceIds();
    }
  });

  it("fails closed on Enterprise billing-interval drift without approval, Stripe Price creation, or Checkout", async () => {
    const item = ENTERPRISE[1];
    const driftedPrice = await prisma.commercePrice.update({
      where: { code: item.priceCode },
      data: {
        billingInterval: "YEAR",
        reviewStatus: "REQUIRES_REVIEW",
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
      },
    });
    await prisma.commerceProviderMapping.deleteMany({ where: { commercePriceId: driftedPrice.id } });
    const actor = await createActor("interval-drift");
    const stripe = checkoutStripeClient();

    try {
      const availability = await getCheckoutAvailability(actor);
      expect(availability.products.find((product) => product.productCode === item.productCode)?.prices[0]).toMatchObject({
        billingInterval: "ONE_TIME",
        available: false,
        unavailableReason: "PRICE_NOT_APPROVED",
      });
      await expect(createCommerceCheckoutSession(actor, { priceCode: item.priceCode }, stripe)).rejects.toThrow(
        /Financial or product parameters are not valid/,
      );
      expect(await prisma.commercePrice.findUniqueOrThrow({ where: { code: item.priceCode } })).toMatchObject({
        billingInterval: "YEAR",
        reviewStatus: "REQUIRES_REVIEW",
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNote: null,
      });
      expect(stripe.products.create).not.toHaveBeenCalled();
      expect(stripe.prices.create).not.toHaveBeenCalled();
      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(await prisma.commerceProviderMapping.count({ where: { commercePriceId: driftedPrice.id } })).toBe(0);
    } finally {
      await prisma.commercePrice.update({
        where: { code: item.priceCode },
        data: { billingInterval: "ONE_TIME", reviewStatus: "REQUIRES_REVIEW" },
      });
      await ensureEnterpriseSelfCheckoutPriceReady(item.priceCode, checkoutStripeClient());
      await refreshProviderPriceIds();
    }
  });

  it("uses payment mode, server-resolved prices, PaymentIntent metadata, and returns checkoutUrl for all tiers", async () => {
    for (const item of ENTERPRISE) {
      const actor = await createActor(`checkout-${item.productCode}`);
      const stripe = checkoutStripeClient();
      const result = await createCommerceCheckoutSession(actor, { priceCode: item.priceCode }, stripe);
      const params = stripe.checkout.sessions.create.mock.calls[0][0];

      expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\/test\//);
      expect(params.mode).toBe("payment");
      expect(params.line_items).toEqual([{ price: providerPriceIds.get(item.priceCode), quantity: 1 }]);
      expect(params.payment_intent_data.metadata).toMatchObject({
        quantara_company_id: actor.companyId,
        quantara_price_code: item.priceCode,
        quantara_checkout_mode: "ENTERPRISE_ONE_TIME",
      });
      expect(params).not.toHaveProperty("subscription_data");
      expect(params).not.toHaveProperty("payment_method_types");
      expect(await prisma.companySoftwareSubscription.count({ where: { companyId: actor.companyId } })).toBe(0);
    }
  });

  it("activates a permanent tenant-bound entitlement once, then blocks another core purchase", async () => {
    const owner = await createActor("paid-owner");
    const spoofed = await createActor("paid-spoofed");
    const stripeCustomerId = `cus_paid_${RUN_ID}`;
    const sessionId = `cs_paid_${RUN_ID}`;
    await createStripeBillingCustomer(owner.companyId, stripeCustomerId, false);
    const stripe = webhookStripeClient(providerPriceIds.get(ENTERPRISE[0].priceCode)!);
    const event = checkoutEvent({
      eventId: `evt_paid_${RUN_ID}`,
      sessionId,
      eventType: "checkout.session.completed",
      stripeCustomerId,
      amountMinor: ENTERPRISE[0].amountMinor,
      paymentStatus: "paid",
      metadataCompanyId: spoofed.companyId,
    });

    expect((await processStripeWebhookEvent(event, stripe)).outcome).toBe("processed");
    expect((await processStripeWebhookEvent(event, stripe)).outcome).toBe("duplicate");

    const entitlements = await prisma.companySoftwareSubscription.findMany({ where: { externalSubscriptionId: sessionId } });
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0]).toMatchObject({
      companyId: owner.companyId,
      status: "ACTIVE",
      expiresAt: null,
      source: "stripe_enterprise_one_time",
    });
    const paidPlan = await prisma.softwarePlan.findUniqueOrThrow({ where: { id: entitlements[0].softwarePlanId } });
    expect(paidPlan.key).toBe("commerce_enterprise_core");
    expect(await prisma.companySoftwareSubscription.count({ where: { companyId: spoofed.companyId } })).toBe(0);
    expect(await prisma.stripeWebhookEvent.count({ where: { stripeEventId: event.id } })).toBe(1);

    const availability = await getCheckoutAvailability(owner);
    for (const item of ENTERPRISE) {
      const option = availability.products.find((product) => product.productCode === item.productCode);
      expect(option?.prices[0]).toMatchObject({ available: false, unavailableReason: "EXISTING_SUBSCRIPTION" });
    }

    const duplicateStripe = checkoutStripeClient();
    await expect(createCommerceCheckoutSession(owner, { priceCode: ENTERPRISE[0].priceCode }, duplicateStripe)).rejects.toMatchObject({
      code: "CHECKOUT_EXISTING_SUBSCRIPTION",
    });
    expect(duplicateStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("blocks another core-software checkout after Enterprise payment but before the entitlement webhook arrives", async () => {
    const owner = await createActor("paid-webhook-gap");
    const stripeCustomerId = `cus_paid_webhook_gap_${RUN_ID}`;
    await createStripeBillingCustomer(owner.companyId, stripeCustomerId, false);
    const starter = await prisma.commerceProduct.findUniqueOrThrow({
      where: { code: RECURRING[0].productCode },
      include: { prices: true },
    });
    const starterMonthly = starter.prices.find((price) => price.code === RECURRING[0].monthlyCode)!;
    await prisma.commercePrice.update({ where: { id: starterMonthly.id }, data: { reviewStatus: "APPROVED" } });
    await createMapping({
      provider: "STRIPE",
      environment: "TEST",
      commerceProductId: starter.id,
      commercePriceId: starterMonthly.id,
      providerProductId: `prod_test_recurring_${RECURRING[0].productCode}_${RUN_ID}`,
      providerPriceId: `price_test_recurring_${RECURRING[0].productCode}_${starterMonthly.billingInterval}_${RUN_ID}`,
      providerObjectType: "PRICE",
    });
    const completedSession = {
      id: `cs_paid_webhook_gap_${RUN_ID}`,
      object: "checkout.session",
      customer: stripeCustomerId,
      livemode: false,
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      metadata: {
        quantara_checkout_mode: "ENTERPRISE_ONE_TIME",
        quantara_company_id: owner.companyId,
        quantara_price_code: ENTERPRISE[0].priceCode,
      },
    } as unknown as Stripe.Checkout.Session;
    const stripe = checkoutStripeClient({ completedSessions: [completedSession] });

    await expect(createCommerceCheckoutSession(owner, { priceCode: starterMonthly.code }, stripe)).rejects.toMatchObject({
      code: "CHECKOUT_EXISTING_SUBSCRIPTION",
    });
    expect(await prisma.companySoftwareSubscription.count({ where: { companyId: owner.companyId } })).toBe(0);
    expect(stripe.checkout.sessions.list).toHaveBeenCalledTimes(1);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("does not activate completed-unpaid or async-failed sessions", async () => {
    const unpaidOwner = await createActor("unpaid");
    const failedOwner = await createActor("async-failed");
    const unpaidCustomer = `cus_unpaid_${RUN_ID}`;
    const failedCustomer = `cus_async_failed_${RUN_ID}`;
    await createStripeBillingCustomer(unpaidOwner.companyId, unpaidCustomer, false);
    await createStripeBillingCustomer(failedOwner.companyId, failedCustomer, false);
    const stripe = webhookStripeClient(providerPriceIds.get(ENTERPRISE[0].priceCode)!);

    await processStripeWebhookEvent(checkoutEvent({
      eventId: `evt_unpaid_${RUN_ID}`,
      sessionId: `cs_unpaid_${RUN_ID}`,
      eventType: "checkout.session.completed",
      stripeCustomerId: unpaidCustomer,
      amountMinor: ENTERPRISE[0].amountMinor,
      paymentStatus: "unpaid",
    }), stripe);
    await processStripeWebhookEvent(checkoutEvent({
      eventId: `evt_async_failed_${RUN_ID}`,
      sessionId: `cs_async_failed_${RUN_ID}`,
      eventType: "checkout.session.async_payment_failed",
      stripeCustomerId: failedCustomer,
      amountMinor: ENTERPRISE[0].amountMinor,
      paymentStatus: "unpaid",
    }), stripe);

    expect(await prisma.companySoftwareSubscription.count({ where: { companyId: { in: [unpaidOwner.companyId, failedOwner.companyId] } } })).toBe(0);
    expect(stripe.checkout.sessions.listLineItems).not.toHaveBeenCalled();
  });

  it("activates the correct permanent tier after async payment success", async () => {
    for (const item of ENTERPRISE.slice(1)) {
      const owner = await createActor(`async-success-${item.productCode}`);
      const stripeCustomerId = `cus_async_success_${item.productCode}_${RUN_ID}`;
      const sessionId = `cs_async_success_${item.productCode}_${RUN_ID}`;
      await createStripeBillingCustomer(owner.companyId, stripeCustomerId, false);
      const stripe = webhookStripeClient(providerPriceIds.get(item.priceCode)!);

      // Sellability is a checkout-time concern. A paid delayed-method
      // session must still fulfill if its historical mapping is archived
      // before Stripe sends async_payment_succeeded.
      if (item.productCode === "enterprise_scale") {
        await prisma.commerceProviderMapping.updateMany({
          where: { providerPriceId: providerPriceIds.get(item.priceCode)! },
          data: { providerActive: false, synchronizationStatus: "ARCHIVED" },
        });
      }

      await processStripeWebhookEvent(checkoutEvent({
        eventId: `evt_async_success_${item.productCode}_${RUN_ID}`,
        sessionId,
        eventType: "checkout.session.async_payment_succeeded",
        stripeCustomerId,
        amountMinor: item.amountMinor,
        paymentStatus: "paid",
      }), stripe);

      const entitlement = await prisma.companySoftwareSubscription.findUniqueOrThrow({
        where: { externalSubscriptionId: sessionId },
      });
      expect(entitlement).toMatchObject({
        companyId: owner.companyId,
        status: "ACTIVE",
        expiresAt: null,
        source: "stripe_enterprise_one_time",
      });
      const plan = await prisma.softwarePlan.findUniqueOrThrow({ where: { id: entitlement.softwarePlanId } });
      expect(plan.key).toBe(`commerce_${item.productCode}`);
    }
  });

  it("fails closed for an unknown Stripe customer with no entitlement or committed ledger row", async () => {
    const event = checkoutEvent({
      eventId: `evt_unknown_${RUN_ID}`,
      sessionId: `cs_unknown_${RUN_ID}`,
      eventType: "checkout.session.completed",
      stripeCustomerId: `cus_unknown_${RUN_ID}`,
      amountMinor: ENTERPRISE[2].amountMinor,
      paymentStatus: "paid",
    });
    const stripe = webhookStripeClient(providerPriceIds.get(ENTERPRISE[2].priceCode)!);

    await expect(processStripeWebhookEvent(event, stripe)).rejects.toThrow(/Unknown or mode-mismatched Stripe customer/);
    expect(await prisma.companySoftwareSubscription.count({ where: { externalSubscriptionId: `cs_unknown_${RUN_ID}` } })).toBe(0);
    expect(await prisma.stripeWebhookEvent.count({ where: { stripeEventId: event.id } })).toBe(0);
  });

  it("keeps Starter, Professional, and Business recurring and in Stripe subscription mode", async () => {
    for (const item of RECURRING) {
      const product = await prisma.commerceProduct.findUniqueOrThrow({
        where: { code: item.productCode },
        include: { prices: true },
      });
      const monthly = product.prices.find((price) => price.code === item.monthlyCode)!;
      const annual = product.prices.find((price) => price.code === item.annualCode)!;
      expect(product.type).toBe("SUBSCRIPTION");
      expect(monthly.billingInterval).toBe("MONTH");
      expect(annual.billingInterval).toBe("YEAR");

      for (const price of [monthly, annual]) {
        await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
        const providerPriceId = `price_test_recurring_${item.productCode}_${price.billingInterval}_${RUN_ID}`;
        await createMapping({
          provider: "STRIPE",
          environment: "TEST",
          commerceProductId: product.id,
          commercePriceId: price.id,
          providerProductId: `prod_test_recurring_${item.productCode}_${RUN_ID}`,
          providerPriceId,
          providerObjectType: "PRICE",
        });

        const actor = await createActor(`recurring-${item.productCode}-${price.billingInterval}`);
        const stripe = checkoutStripeClient();
        await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);
        const params = stripe.checkout.sessions.create.mock.calls[0][0];
        expect(params.mode).toBe("subscription");
        expect(params.line_items).toEqual([{ price: providerPriceId, quantity: 1 }]);
        expect(params.subscription_data.metadata.quantara_company_id).toBe(actor.companyId);
        expect(params).not.toHaveProperty("payment_intent_data");
      }
    }
  });
});
