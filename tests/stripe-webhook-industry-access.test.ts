import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "../src/lib/db/prisma";
import { processStripeWebhookEvent } from "../src/lib/services/stripe-webhook-service";
import { STRIPE_API_VERSION } from "../src/lib/payments/stripe-client";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";

/**
 * MARKETPLACE-FIX-2 — this suite is the required regression test for the bug
 * this fix found and closed in stripe-webhook-service.ts's
 * applyCurrentSubscriptionState: industry-access CommerceProducts are seeded
 * with type: "SUBSCRIPTION" AND industryPackageId set (see
 * prisma/seed-data/commerce-products.ts's INDUSTRY_ACCESS_CANDIDATES loop, and
 * commerce-checkout-service.ts's loadEligibleCommercePrice, which requires
 * type === "SUBSCRIPTION" to allow self-checkout at all). Before this fix, the
 * webhook's `product.type === "SUBSCRIPTION" || ... || !product.industryPackageId`
 * branch condition matched every industry-access product too, routing a
 * completed purchase into the software-subscription path — which has no
 * mapping for an industry product code, so nothing was ever created. A real
 * customer could complete Stripe checkout for a package and receive no
 * entitlement at all. This suite proves the fixed branch (industryPackageId
 * checked first) creates a real, tenant-scoped CompanyPackageSubscription
 * instead, and that it carries the same tenant-mismatch protection the
 * software-subscription path already had.
 */

const RUN_ID = `${Date.now()}-${process.pid}-webhook-industry`;

function fakeEvent(input: { id: string; type: string; livemode: boolean; object: Record<string, unknown> }) {
  return {
    id: input.id,
    type: input.type,
    livemode: input.livemode,
    api_version: STRIPE_API_VERSION,
    data: { object: input.object },
  } as unknown as Stripe.Event;
}

function fakeSubscriptionEventEnvelope(input: { id: string; stripeCustomerId: string; subscriptionId: string; type?: string }) {
  return fakeEvent({
    id: input.id,
    type: input.type ?? "customer.subscription.updated",
    livemode: false,
    object: { id: input.subscriptionId, customer: input.stripeCustomerId },
  });
}

function fakeCurrentSubscription(input: { id: string; status: string; stripeCustomerId: string; providerPriceId: string }) {
  return {
    id: input.id,
    customer: input.stripeCustomerId,
    status: input.status,
    livemode: false,
    canceled_at: null,
    items: {
      data: [
        {
          price: { id: input.providerPriceId },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      ],
    },
  };
}

function mockClientReturningSubscription(subscription: unknown) {
  return { subscriptions: { retrieve: async () => subscription } } as unknown as Stripe;
}

describe("processStripeWebhookEvent — INDUSTRY_ACCESS fulfillment (integration, real local Postgres)", () => {
  let companyId: string;
  let otherCompanyId: string;
  let packageId: string;
  let providerPriceId: string;
  const originalMode = process.env.STRIPE_MODE;
  const originalKey = process.env.STRIPE_SECRET_KEY;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { legalName: `Webhook Pkg Co ${RUN_ID}`, tradeName: "Webhook Pkg Co", email: `webhook-pkg-${RUN_ID}@example.com` } });
    companyId = company.id;
    const otherCompany = await prisma.company.create({ data: { legalName: `Webhook Pkg Other Co ${RUN_ID}`, tradeName: "Webhook Pkg Other Co", email: `webhook-pkg-other-${RUN_ID}@example.com` } });
    otherCompanyId = otherCompany.id;

    await createStripeBillingCustomer(companyId, `cus_pkg_${RUN_ID}`, false);

    const discipline = await prisma.masterDiscipline.create({
      data: { key: `webhook-pkg-${RUN_ID}`, name: `Webhook Package Discipline ${RUN_ID}`, sortOrder: 999 },
    });
    const pkg = await prisma.industryDataPackage.create({
      data: {
        key: `webhook-pkg-${RUN_ID}`,
        name: `Webhook Test Package ${RUN_ID}`,
        description: "Fixture package for webhook fulfillment test",
        disciplineId: discipline.id,
        packageType: "PROFESSIONAL",
        monthlyPrice: 149,
        annualPrice: 1490,
        currency: "AED",
        status: "ACTIVE",
      },
    });
    packageId = pkg.id;

    // Mirrors prisma/seed-data/commerce-products.ts's INDUSTRY_ACCESS_CANDIDATES
    // seeding exactly: type "SUBSCRIPTION" (not "INDUSTRY_ACCESS") WITH
    // industryPackageId set — this is the real shape that reaches the webhook.
    const product = await prisma.commerceProduct.create({
      data: {
        code: `industry_webhook_pkg_${RUN_ID}`,
        type: "SUBSCRIPTION",
        name: `Webhook Test Package Access ${RUN_ID}`,
        purchaseMode: "DIRECT",
        isActive: true,
        isPublic: true,
        industryPackageId: packageId,
      },
    });
    const price = await prisma.commercePrice.create({
      data: {
        productId: product.id,
        code: `industry_webhook_pkg_${RUN_ID}_monthly`,
        amountMinor: 14900,
        currency: "AED",
        billingInterval: "MONTH",
        reviewStatus: "APPROVED",
      },
    });
    providerPriceId = `price_test_webhook_pkg_${RUN_ID}`;
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_webhook_pkg_${RUN_ID}`, providerPriceId, providerObjectType: "PRICE" });
  });

  beforeAll(() => {
    delete process.env.STRIPE_MODE; // resolves to TEST — required before any test touching Stripe-adjacent code
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_key_not_real";
  });

  afterAll(async () => {
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;

    await prisma.companyPackageSubscription.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.stripeWebhookEvent.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.commercePrice.deleteMany({ where: { code: { contains: RUN_ID } } }); // cascades to its CommerceProviderMapping
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.industryDataPackage.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.masterDiscipline.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    await prisma.$disconnect();
  });

  it("a completed checkout for an INDUSTRY_ACCESS product creates a real, ACTIVE, source:stripe CompanyPackageSubscription for the correct company and package", async () => {
    const subscriptionId = `sub_pkg_${RUN_ID}`;
    const current = fakeCurrentSubscription({ id: subscriptionId, status: "active", stripeCustomerId: `cus_pkg_${RUN_ID}`, providerPriceId });
    const client = mockClientReturningSubscription(current);
    const event = fakeSubscriptionEventEnvelope({ id: `evt_pkg_${RUN_ID}`, stripeCustomerId: `cus_pkg_${RUN_ID}`, subscriptionId });

    const result = await processStripeWebhookEvent(event, client);
    expect(result.outcome).toBe("processed");

    const sub = await prisma.companyPackageSubscription.findFirst({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub).not.toBeNull();
    expect(sub?.companyId).toBe(companyId);
    expect(sub?.packageId).toBe(packageId);
    expect(sub?.status).toBe("ACTIVE");
    expect(sub?.source).toBe("stripe");

    // The bug this fix closed: before it, this same event created nothing at
    // all (no CompanySoftwareSubscription either) — assert that dead-end
    // path is gone too, not just that the right row happens to also exist.
    const softwareSub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(softwareSub).toBeNull();
  });

  it("never lets an INDUSTRY_ACCESS event for company A's Stripe customer create or mutate company B's package subscription", async () => {
    const subscriptionId = `sub_pkg_tenant_${RUN_ID}`;
    // A pre-existing row for the OTHER company, same subscription id — as if
    // otherCompanyId's customer id had (incorrectly) resolved to this event.
    await prisma.companyPackageSubscription.create({
      data: { companyId: otherCompanyId, packageId, status: "ACTIVE", externalSubscriptionId: subscriptionId, source: "stripe" },
    });

    const current = fakeCurrentSubscription({ id: subscriptionId, status: "canceled", stripeCustomerId: `cus_pkg_${RUN_ID}`, providerPriceId });
    const client = mockClientReturningSubscription(current);
    const event = fakeSubscriptionEventEnvelope({ id: `evt_pkg_tenant_${RUN_ID}`, stripeCustomerId: `cus_pkg_${RUN_ID}`, subscriptionId, type: "customer.subscription.deleted" });

    await processStripeWebhookEvent(event, client);

    const otherSub = await prisma.companyPackageSubscription.findFirst({ where: { companyId: otherCompanyId, externalSubscriptionId: subscriptionId } });
    expect(otherSub?.status).toBe("ACTIVE"); // untouched — never cancelled by company A's event

    // No new row was created for companyId under this subscription id either
    // (the existing row belongs to otherCompanyId, so the tenant-mismatch
    // guard must skip it entirely rather than creating a second row).
    const ownSub = await prisma.companyPackageSubscription.findFirst({ where: { companyId, externalSubscriptionId: subscriptionId } });
    expect(ownSub).toBeNull();
  });
});
