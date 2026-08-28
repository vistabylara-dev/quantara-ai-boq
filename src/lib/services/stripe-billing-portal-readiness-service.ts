import { PlatformRole, Prisma } from "@prisma/client";
import type Stripe from "stripe";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { prisma } from "@/lib/db/prisma";
import { AppError, PermissionDeniedError } from "@/lib/errors/app-error";
import {
  getConfiguredStripeMode,
  getStripeCommercialClient,
  StripeInvalidKeyError,
  StripeNotConfiguredError,
} from "@/lib/payments/stripe-client";
import { listAllCommerceProductsWithPrices } from "@/lib/repositories/commerce-product-repository";
import { listMappingsForEnvironment } from "@/lib/repositories/commerce-provider-mapping-repository";
import type { PlatformRequestMetadata } from "@/lib/repositories/platform-admin-repository";

const PORTAL_PRODUCT_SPECS = [
  { productCode: "starter", priceCodes: ["starter_monthly_aed_149", "starter_annual_aed_1490"] },
  { productCode: "professional", priceCodes: ["professional_monthly_aed_399", "professional_annual_aed_3990"] },
  { productCode: "business", priceCodes: ["business_monthly_aed_899", "business_annual_aed_8990"] },
] as const;

type PortalMapping = {
  commerceProductId: string;
  commercePriceId: string | null;
  providerProductId: string;
  providerPriceId: string | null;
  providerObjectType: "PRODUCT" | "PRICE";
  providerActive: boolean;
  synchronizationStatus: string;
};

type PortalProduct = {
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
};

export type PortalSubscriptionUpdateProduct = {
  product: string;
  prices: string[];
};

export function buildPortalSubscriptionUpdateProducts(
  products: PortalProduct[],
  mappings: PortalMapping[],
): PortalSubscriptionUpdateProduct[] {
  return PORTAL_PRODUCT_SPECS.map((spec) => {
    const product = products.find((candidate) => candidate.code === spec.productCode);
    if (
      !product
      || product.type !== "SUBSCRIPTION"
      || product.purchaseMode !== "DIRECT"
      || !product.isActive
      || !product.isPublic
    ) {
      throw new AppError(
        "STRIPE_PORTAL_CATALOGUE_NOT_READY",
        `The ${spec.productCode} subscription product is not ready for controlled portal updates.`,
        409,
      );
    }

    const productMapping = mappings.find((mapping) => (
      mapping.providerObjectType === "PRODUCT"
      && mapping.commerceProductId === product.id
    ));
    if (
      !productMapping
      || !productMapping.providerActive
      || productMapping.synchronizationStatus !== "SYNCED"
      || !productMapping.providerProductId
    ) {
      throw new AppError(
        "STRIPE_PORTAL_MAPPING_NOT_READY",
        `The ${spec.productCode} live Stripe product mapping is not ready.`,
        409,
      );
    }

    const providerPriceIds = spec.priceCodes.map((priceCode) => {
      const price = product.prices.find((candidate) => candidate.code === priceCode);
      if (
        !price
        || !price.isActive
        || price.isFromPrice
        || price.reviewStatus !== "APPROVED"
        || (price.billingInterval !== "MONTH" && price.billingInterval !== "YEAR")
      ) {
        throw new AppError(
          "STRIPE_PORTAL_CATALOGUE_NOT_READY",
          `The ${priceCode} price is not ready for controlled portal updates.`,
          409,
        );
      }

      const priceMapping = mappings.find((mapping) => (
        mapping.providerObjectType === "PRICE"
        && mapping.commercePriceId === price.id
        && mapping.commerceProductId === product.id
      ));
      if (
        !priceMapping
        || !priceMapping.providerActive
        || priceMapping.synchronizationStatus !== "SYNCED"
        || !priceMapping.providerPriceId
        || priceMapping.providerProductId !== productMapping.providerProductId
      ) {
        throw new AppError(
          "STRIPE_PORTAL_MAPPING_NOT_READY",
          `The ${priceCode} live Stripe price mapping is not ready.`,
          409,
        );
      }
      return priceMapping.providerPriceId;
    });

    return { product: productMapping.providerProductId, prices: providerPriceIds };
  });
}

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== PlatformRole.PLATFORM_OWNER) {
    throw new PermissionDeniedError("Only the platform owner may configure the live Stripe billing portal.");
  }
}

function requireLiveStripeClient(overrideClient?: Stripe): Stripe {
  if (getConfiguredStripeMode() !== "live") {
    throw new AppError("STRIPE_LIVE_MODE_REQUIRED", "Billing portal readiness requires Stripe live mode.", 409);
  }
  try {
    return getStripeCommercialClient(overrideClient);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      throw new AppError("STRIPE_NOT_CONFIGURED", error.message, 409);
    }
    if (error instanceof StripeInvalidKeyError) {
      throw new AppError("STRIPE_INVALID_KEY", error.message, 409);
    }
    throw error;
  }
}

function stripeProviderError(error: unknown): AppError {
  const providerError = error as { type?: unknown; code?: unknown } | undefined;
  const type = typeof providerError?.type === "string" ? providerError.type : "unknown";
  const code = typeof providerError?.code === "string" ? providerError.code : "unknown";
  console.error("[stripe-billing-portal-readiness] Stripe operation failed", { type, code });
  if (type === "StripeAuthenticationError") {
    return new AppError("STRIPE_INVALID_KEY", "Stripe rejected the configured live API key.", 409);
  }
  if (type === "StripeRateLimitError") {
    return new AppError("STRIPE_RATE_LIMITED", "Stripe rate-limited the portal readiness request.", 503);
  }
  if (type === "StripeConnectionError") {
    return new AppError("STRIPE_ACCOUNT_UNREACHABLE", "Could not reach Stripe.", 503);
  }
  return new AppError("STRIPE_PROVIDER_ERROR", "Stripe could not configure the billing portal.", 502);
}

async function callStripe<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    throw stripeProviderError(error);
  }
}

export type StripeBillingPortalReadinessReport = {
  ready: true;
  environment: "LIVE";
  configurationId: string;
  productCount: number;
  priceCount: number;
  subscriptionUpdates: "ENABLED";
  upgradeBehavior: "PRORATED_IMMEDIATELY";
  downgradeBehavior: "SCHEDULED_AT_PERIOD_END";
};

export async function ensureStripeBillingPortalReady(
  actor: PlatformActor,
  requestMetadata: PlatformRequestMetadata,
  overrideClient?: Stripe,
): Promise<StripeBillingPortalReadinessReport> {
  requireOwner(actor);
  const stripe = requireLiveStripeClient(overrideClient);
  const [products, mappings] = await Promise.all([
    listAllCommerceProductsWithPrices(),
    listMappingsForEnvironment("STRIPE", "LIVE"),
  ]);
  const portalProducts = buildPortalSubscriptionUpdateProducts(products, mappings);

  const configurations = await callStripe(() => stripe.billingPortal.configurations.list({
    active: true,
    is_default: true,
    limit: 100,
  }));
  if (configurations.has_more || configurations.data.length !== 1) {
    throw new AppError(
      "STRIPE_DEFAULT_PORTAL_CONFIGURATION_AMBIGUOUS",
      "Stripe must expose exactly one active default billing portal configuration.",
      409,
    );
  }

  const configuration = await callStripe(() => stripe.billingPortal.configurations.update(
    configurations.data[0].id,
    {
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          products: portalProducts.map((product) => ({
            ...product,
            adjustable_quantity: { enabled: false },
          })),
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
    },
  ));

  if (
    !configuration.active
    || !configuration.is_default
    || !configuration.features.subscription_update.enabled
    || !configuration.features.subscription_update.default_allowed_updates.includes("price")
  ) {
    throw new AppError(
      "STRIPE_PORTAL_CONFIGURATION_NOT_APPLIED",
      "Stripe did not return the required active default subscription-update configuration.",
      502,
    );
  }

  const report: StripeBillingPortalReadinessReport = {
    ready: true,
    environment: "LIVE",
    configurationId: configuration.id,
    productCount: portalProducts.length,
    priceCount: portalProducts.reduce((total, product) => total + product.prices.length, 0),
    subscriptionUpdates: "ENABLED",
    upgradeBehavior: "PRORATED_IMMEDIATELY",
    downgradeBehavior: "SCHEDULED_AT_PERIOD_END",
  };

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorPlatformRole: actor.platformRole,
      action: "commerce_stripe_live.portal_ready",
      targetType: "StripeBillingPortalConfiguration",
      targetId: configuration.id,
      requestMetadataJson: {
        method: requestMetadata.method,
        path: requestMetadata.path,
        ...(requestMetadata.requestId ? { requestId: requestMetadata.requestId } : {}),
      },
      afterJson: report as unknown as Prisma.InputJsonObject,
    },
  });

  return report;
}
