import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { PlatformRole } from "@prisma/client";
import { listAllCommerceProductsWithPrices } from "../src/lib/repositories/commerce-product-repository";
import { listMappingsForEnvironment } from "../src/lib/repositories/commerce-provider-mapping-repository";
import {
  buildPortalSubscriptionUpdateProducts,
  ensureStripeBillingPortalReady,
} from "../src/lib/services/stripe-billing-portal-readiness-service";

vi.mock("../src/lib/repositories/commerce-product-repository", () => ({
  listAllCommerceProductsWithPrices: vi.fn(),
}));

vi.mock("../src/lib/repositories/commerce-provider-mapping-repository", () => ({
  listMappingsForEnvironment: vi.fn(),
}));

vi.mock("../src/lib/db/prisma", () => ({
  prisma: {
    platformAuditLog: { create: vi.fn(async () => ({ id: "audit-log" })) },
  },
}));

function fixture() {
  const specs = [
    ["starter", "starter_monthly_aed_149", "starter_annual_aed_1490"],
    ["professional", "professional_monthly_aed_399", "professional_annual_aed_3990"],
    ["business", "business_monthly_aed_899", "business_annual_aed_8990"],
  ] as const;
  const products: Array<{
    id: string;
    code: string;
    type: string;
    purchaseMode: string;
    isActive: boolean;
    isPublic: boolean;
    prices: Array<{
      id: string;
      code: string;
      billingInterval: string;
      isActive: boolean;
      isFromPrice: boolean;
      reviewStatus: string;
    }>;
  }> = specs.map(([code, monthly, annual], index) => ({
    id: `product-${index}`,
    code,
    type: "SUBSCRIPTION",
    purchaseMode: "DIRECT",
    isActive: true,
    isPublic: true,
    prices: [monthly, annual].map((priceCode, priceIndex) => ({
      id: `price-${index}-${priceIndex}`,
      code: priceCode,
      billingInterval: priceIndex === 0 ? "MONTH" : "YEAR",
      isActive: true,
      isFromPrice: false,
      reviewStatus: "APPROVED",
    })),
  }));
  const mappings = products.flatMap((product, index) => [
    {
      commerceProductId: product.id,
      commercePriceId: null,
      providerProductId: `prod_live_${index}`,
      providerPriceId: null,
      providerObjectType: "PRODUCT" as const,
      providerActive: true,
      synchronizationStatus: "SYNCED",
    },
    ...product.prices.map((price, priceIndex) => ({
      commerceProductId: product.id,
      commercePriceId: price.id,
      providerProductId: `prod_live_${index}`,
      providerPriceId: `price_live_${index}_${priceIndex}`,
      providerObjectType: "PRICE" as const,
      providerActive: true,
      synchronizationStatus: "SYNCED",
    })),
  ]);
  return { products, mappings };
}

describe("Stripe billing portal readiness", () => {
  const originalMode = process.env.STRIPE_MODE;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
  });

  it("builds the exact three-product, six-price controlled update allowlist", () => {
    const { products, mappings } = fixture();
    expect(buildPortalSubscriptionUpdateProducts(products, mappings)).toEqual([
      { product: "prod_live_0", prices: ["price_live_0_0", "price_live_0_1"] },
      { product: "prod_live_1", prices: ["price_live_1_0", "price_live_1_1"] },
      { product: "prod_live_2", prices: ["price_live_2_0", "price_live_2_1"] },
    ]);
  });

  it("fails closed when an approved live price mapping is missing", () => {
    const { products, mappings } = fixture();
    mappings.splice(mappings.findIndex((mapping) => mapping.providerPriceId === "price_live_2_1"), 1);
    expect(() => buildPortalSubscriptionUpdateProducts(products, mappings)).toThrow(/mapping is not ready/i);
  });

  it("fails closed when a catalogue price loses commercial approval", () => {
    const { products, mappings } = fixture();
    products[1].prices[0].reviewStatus = "REQUIRES_REVIEW";
    expect(() => buildPortalSubscriptionUpdateProducts(products, mappings)).toThrow(/price is not ready/i);
  });

  it("does not admit enterprise, TAYQAN or library products", () => {
    const { products, mappings } = fixture();
    products.push({
      id: "unexpected-product",
      code: "enterprise_core",
      type: "SUBSCRIPTION",
      purchaseMode: "DIRECT",
      isActive: true,
      isPublic: true,
      prices: [{
        id: "unexpected-price",
        code: "unexpected-price",
        billingInterval: "YEAR",
        isActive: true,
        isFromPrice: false,
        reviewStatus: "APPROVED",
      }],
    });
    expect(buildPortalSubscriptionUpdateProducts(products, mappings)).toHaveLength(3);
  });

  it("updates only the active default portal with controlled price changes", async () => {
    process.env.STRIPE_MODE = "live";
    const { products, mappings } = fixture();
    vi.mocked(listAllCommerceProductsWithPrices).mockResolvedValue(products as never);
    vi.mocked(listMappingsForEnvironment).mockResolvedValue(mappings as never);

    const update = vi.fn(async (_id: string, params: Stripe.BillingPortal.ConfigurationUpdateParams) => ({
      id: "bpc_live_default",
      active: true,
      is_default: true,
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
        },
      },
      ...params,
    }));
    const stripe = {
      billingPortal: {
        configurations: {
          list: vi.fn(async () => ({
            data: [{ id: "bpc_live_default", active: true, is_default: true }],
            has_more: false,
          })),
          update,
        },
      },
    } as unknown as Stripe;

    const report = await ensureStripeBillingPortalReady({
      userId: "owner-user",
      companyId: "owner-company",
      platformRole: PlatformRole.PLATFORM_OWNER,
      fullName: "Platform Owner",
      email: "owner@example.com",
    }, { method: "POST", path: "/api/admin/commerce/stripe/portal-ready", requestId: "request-1" }, stripe);

    expect(report).toMatchObject({
      ready: true,
      environment: "LIVE",
      configurationId: "bpc_live_default",
      productCount: 3,
      priceCount: 6,
      subscriptionUpdates: "ENABLED",
    });
    expect(update).toHaveBeenCalledWith("bpc_live_default", {
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          products: [
            { product: "prod_live_0", prices: ["price_live_0_0", "price_live_0_1"], adjustable_quantity: { enabled: false } },
            { product: "prod_live_1", prices: ["price_live_1_0", "price_live_1_1"], adjustable_quantity: { enabled: false } },
            { product: "prod_live_2", prices: ["price_live_2_0", "price_live_2_1"], adjustable_quantity: { enabled: false } },
          ],
          billing_cycle_anchor: "unchanged",
          proration_behavior: "create_prorations",
          schedule_at_period_end: {
            conditions: [
              { type: "decreasing_item_amount" },
              { type: "shortening_interval" },
            ],
          },
          trial_update_behavior: "end_trial",
        },
      },
    });
  });
});
