import { PlanType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { requirePlatformCapability } from "@/lib/auth/platform-authorization";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { managedCommerceSoftwarePlanKey } from "@/lib/entitlements/commerce-plan-mapping";
import {
  findPriceMapping,
  findProductMapping,
} from "@/lib/repositories/commerce-provider-mapping-repository";
import type { PlatformRequestMetadata } from "@/lib/repositories/platform-admin-repository";
import { setCommercePriceReview } from "@/lib/services/commerce-price-approval-service";
import {
  buildLiveSyncPlan,
  synchronizeLiveCommerceCatalogue,
  verifyLiveStripeMapping,
  type LiveSyncPlan,
} from "@/lib/services/stripe-live-sync-service";

const SOURCE = "ADMIN_PRODUCT_MANAGER";

type ManagedMetadata = {
  source: typeof SOURCE;
  publicationState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  marketplace: { enabled: boolean };
  category: string;
  slug: string;
  seo: { metaTitle: string; metaDescription: string };
  merchant: Record<string, unknown>;
  fulfillment:
    | { adapter: "NONE" }
    | {
        adapter: "SOFTWARE_PLAN";
        softwarePlanKey: string;
        planType: "PRO" | "BUSINESS" | "ENTERPRISE";
        maxUsers: number | null;
        maxProjects: number | null;
        maxActiveBoqs: number | null;
        maxDocumentsPerMonth: number | null;
      };
  checkout?: {
    state: "DISABLED" | "SYNCING" | "READY" | "ERROR";
    lastErrorCode?: string | null;
    activatedAt?: string | null;
  };
};

function requestMetadataJson(metadata: PlatformRequestMetadata) {
  return {
    method: metadata.method,
    path: metadata.path,
    ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
  };
}

function readMetadata(value: unknown): ManagedMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.source !== SOURCE) return null;
  return candidate as unknown as ManagedMetadata;
}

async function getTarget(productId: string) {
  const product = await prisma.commerceProduct.findUnique({
    where: { id: productId },
    include: {
      prices: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!product) throw new NotFoundError("Product Manager product not found.");

  const metadata = readMetadata(product.metadataJson);
  if (!metadata) {
    throw new ConflictError(
      "PRODUCT_MANAGER_OWNERSHIP_REQUIRED",
      "This product is not managed by Product Manager.",
    );
  }

  if (metadata.publicationState !== "PUBLISHED" || !metadata.marketplace.enabled) {
    throw new ConflictError(
      "MARKETPLACE_PUBLICATION_REQUIRED",
      "Publish the product to Marketplace before activating checkout.",
    );
  }

  if (metadata.fulfillment.adapter !== "SOFTWARE_PLAN") {
    throw new ConflictError(
      "FULFILLMENT_ADAPTER_REQUIRED",
      "Direct Stripe checkout is available only for products with a verified Software Subscription fulfilment adapter.",
    );
  }

  if (product.type !== "SUBSCRIPTION" || product.purchaseMode !== "DIRECT") {
    throw new ConflictError(
      "CHECKOUT_PRODUCT_TYPE_UNSUPPORTED",
      "Only direct monthly/yearly subscription products can be activated by Product Manager.",
    );
  }

  if (product.prices.length !== 1) {
    throw new ConflictError(
      "CHECKOUT_PRICE_CONFIGURATION_INVALID",
      "Product Manager checkout requires exactly one active price.",
    );
  }

  const [price] = product.prices;
  if (price.billingInterval !== "MONTH" && price.billingInterval !== "YEAR") {
    throw new ConflictError(
      "CHECKOUT_INTERVAL_UNSUPPORTED",
      "Product Manager checkout supports monthly or yearly subscription prices only.",
    );
  }

  return { product, price, metadata };
}

function planActionMap<T extends { action: string }>(
  rows: T[],
  key: (row: T) => string,
) {
  return new Map(rows.map((row) => [key(row), row.action]));
}

function unrelatedUnsafeActions(
  plan: LiveSyncPlan,
  productId: string,
  priceId: string,
): string[] {
  const blockers: string[] = [];

  for (const row of plan.products) {
    if (row.productId === productId) continue;
    if (row.action === "CREATE" || row.action === "ARCHIVE") {
      blockers.push(`Unrelated product ${row.code} requires ${row.action}.`);
    }
  }

  for (const row of plan.prices) {
    if (row.priceId === priceId) continue;
    if (
      row.action === "CREATE" ||
      row.action === "REACTIVATE" ||
      row.action === "ARCHIVE"
    ) {
      blockers.push(`Unrelated price ${row.code} requires ${row.action}.`);
    }
  }

  return blockers;
}

function unrelatedPlanChanges(
  baseline: LiveSyncPlan,
  staged: LiveSyncPlan,
  productId: string,
  priceId: string,
): string[] {
  const blockers: string[] = [];

  const baselineProducts = planActionMap(
    baseline.products,
    (row) => row.productId,
  );
  for (const row of staged.products) {
    if (row.productId === productId) continue;
    const before = baselineProducts.get(row.productId);
    if (before !== row.action) {
      blockers.push(
        `Unrelated product ${row.code} changed plan action from ${before ?? "missing"} to ${row.action}.`,
      );
    }
  }

  const baselinePrices = planActionMap(
    baseline.prices,
    (row) => row.priceId,
  );
  for (const row of staged.prices) {
    if (row.priceId === priceId) continue;
    const before = baselinePrices.get(row.priceId);
    if (before !== row.action) {
      blockers.push(
        `Unrelated price ${row.code} changed plan action from ${before ?? "missing"} to ${row.action}.`,
      );
    }
  }

  return blockers;
}

async function buildHypotheticalStagedPlan(
  productId: string,
  priceId: string,
): Promise<LiveSyncPlan> {
  let stagedPlan: LiveSyncPlan | null = null;
  const rollback = new Error("PRODUCT_MANAGER_PREFLIGHT_ROLLBACK");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.commerceProduct.update({
        where: { id: productId },
        data: { isActive: true, isPublic: true },
      });

      await tx.commercePrice.update({
        where: { id: priceId },
        data: { reviewStatus: "APPROVED" },
      });

      stagedPlan = await buildLiveSyncPlan(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }

  if (!stagedPlan) {
    throw new AppError(
      "CHECKOUT_PREFLIGHT_FAILED",
      "Could not build the staged Stripe synchronization plan.",
      500,
    );
  }

  return stagedPlan;
}

export type ManagedCheckoutPreflight = {
  safe: boolean;
  blockers: string[];
  productAction: string | null;
  priceAction: string | null;
  baseline: {
    productsToCreate: number;
    productsToArchive: number;
    pricesToCreate: number;
    pricesToReactivate: number;
    pricesToArchive: number;
  };
};

export async function previewManagedProductCheckoutActivation(
  actor: PlatformActor,
  productId: string,
): Promise<ManagedCheckoutPreflight> {
  requirePlatformCapability(actor, "platform:operate");

  const { product, price } = await getTarget(productId);
  const baseline = await buildLiveSyncPlan();
  const staged = await buildHypotheticalStagedPlan(product.id, price.id);

  const blockers = [
    ...unrelatedUnsafeActions(baseline, product.id, price.id),
    ...unrelatedPlanChanges(baseline, staged, product.id, price.id),
  ];

  const targetProduct = staged.products.find(
    (row) => row.productId === product.id,
  );
  const targetPrice = staged.prices.find((row) => row.priceId === price.id);

  if (
    !targetProduct ||
    (targetProduct.action !== "CREATE" && targetProduct.action !== "UPDATE")
  ) {
    blockers.push(
      `Target product is not Stripe-ready: ${targetProduct?.action ?? "missing"}.`,
    );
  }

  if (
    !targetPrice ||
    !["CREATE", "REACTIVATE", "UNCHANGED"].includes(targetPrice.action)
  ) {
    blockers.push(
      `Target price is not Stripe-ready: ${targetPrice?.action ?? "missing"}${targetPrice?.blockedReason ? ` (${targetPrice.blockedReason})` : ""}.`,
    );
  }

  return {
    safe: blockers.length === 0,
    blockers,
    productAction: targetProduct?.action ?? null,
    priceAction: targetPrice?.action ?? null,
    baseline: {
      productsToCreate: baseline.productsToCreate,
      productsToArchive: baseline.productsToArchive,
      pricesToCreate: baseline.pricesToCreate,
      pricesToReactivate: baseline.pricesToReactivate,
      pricesToArchive: baseline.pricesToArchive,
    },
  };
}

function planType(value: "PRO" | "BUSINESS" | "ENTERPRISE"): PlanType {
  if (value === "BUSINESS") return PlanType.BUSINESS;
  if (value === "ENTERPRISE") return PlanType.ENTERPRISE;
  return PlanType.PRO;
}

async function ensureManagedSoftwarePlan(
  product: Awaited<ReturnType<typeof getTarget>>["product"],
  price: Awaited<ReturnType<typeof getTarget>>["price"],
  metadata: ManagedMetadata,
) {
  if (metadata.fulfillment.adapter !== "SOFTWARE_PLAN") {
    throw new ConflictError(
      "FULFILLMENT_ADAPTER_REQUIRED",
      "SoftwarePlan fulfilment is required.",
    );
  }

  const key = managedCommerceSoftwarePlanKey(product.code);
  const monthlyPrice =
    price.billingInterval === "MONTH" ? price.amountMinor / 100 : 0;
  const annualPrice =
    price.billingInterval === "YEAR" ? price.amountMinor / 100 : 0;

  return prisma.softwarePlan.upsert({
    where: { key },
    update: {
      name: product.name,
      description: product.description,
      planType: planType(metadata.fulfillment.planType),
      monthlyPrice,
      annualPrice,
      currency: "AED",
      maxUsers: metadata.fulfillment.maxUsers,
      maxProjects: metadata.fulfillment.maxProjects,
      maxActiveBoqs: metadata.fulfillment.maxActiveBoqs,
      maxDocumentsPerMonth:
        metadata.fulfillment.maxDocumentsPerMonth,
      featuresJson: {
        source: SOURCE,
        commerceProductCode: product.code,
      },
      isActive: true,
    },
    create: {
      key,
      name: product.name,
      description: product.description,
      planType: planType(metadata.fulfillment.planType),
      monthlyPrice,
      annualPrice,
      currency: "AED",
      maxUsers: metadata.fulfillment.maxUsers,
      maxProjects: metadata.fulfillment.maxProjects,
      maxActiveBoqs: metadata.fulfillment.maxActiveBoqs,
      maxDocumentsPerMonth:
        metadata.fulfillment.maxDocumentsPerMonth,
      featuresJson: {
        source: SOURCE,
        commerceProductCode: product.code,
      },
      isActive: true,
    },
  });
}

async function updateCheckoutMetadata(
  productId: string,
  metadata: ManagedMetadata,
  checkout: NonNullable<ManagedMetadata["checkout"]>,
  flags?: { isActive?: boolean; isPublic?: boolean },
) {
  const next: ManagedMetadata = {
    ...metadata,
    checkout,
  };

  await prisma.commerceProduct.update({
    where: { id: productId },
    data: {
      ...(flags?.isActive !== undefined
        ? { isActive: flags.isActive }
        : {}),
      ...(flags?.isPublic !== undefined
        ? { isPublic: flags.isPublic }
        : {}),
      metadataJson: next as unknown as Prisma.InputJsonValue,
    },
  });

  return next;
}

export async function activateManagedProductCheckout(
  actor: PlatformActor,
  productId: string,
  requestMetadata: PlatformRequestMetadata,
) {
  requirePlatformCapability(actor, "platform:operate");

  const target = await getTarget(productId);
  const preflight = await previewManagedProductCheckoutActivation(
    actor,
    productId,
  );

  if (!preflight.safe) {
    throw new ConflictError(
      "STRIPE_PREFLIGHT_BLOCKED",
      `Stripe activation was blocked: ${preflight.blockers.join(" ")}`,
    );
  }

  if (target.metadata.checkout?.state === "READY") {
    const existingProductMapping = await findProductMapping(
      "STRIPE",
      "LIVE",
      target.product.id,
    );
    const existingPriceMapping = await findPriceMapping(
      "STRIPE",
      "LIVE",
      target.price.id,
    );

    if (
      existingProductMapping?.providerActive &&
      existingProductMapping.synchronizationStatus === "SYNCED" &&
      existingPriceMapping?.providerActive &&
      existingPriceMapping.synchronizationStatus === "SYNCED"
    ) {
      return {
        checkoutState: "READY" as const,
        preflight,
        alreadyReady: true,
      };
    }
  }

  const previousReviewStatus = target.price.reviewStatus;

  await ensureManagedSoftwarePlan(
    target.product,
    target.price,
    target.metadata,
  );

  await setCommercePriceReview(
    actor,
    target.price.id,
    {
      reviewStatus: "APPROVED",
      reviewNote:
        "Approved by Product Manager guarded Stripe activation.",
    },
    requestMetadata,
  );

  let stagedMetadata = await updateCheckoutMetadata(
    target.product.id,
    target.metadata,
    {
      state: "SYNCING",
      lastErrorCode: null,
      activatedAt: null,
    },
    { isActive: true, isPublic: true },
  );

  try {
    const currentPlan = await buildLiveSyncPlan();
    const unsafe = unrelatedUnsafeActions(
      currentPlan,
      target.product.id,
      target.price.id,
    );

    const targetProductAction = currentPlan.products.find(
      (row) => row.productId === target.product.id,
    );
    const targetPriceAction = currentPlan.prices.find(
      (row) => row.priceId === target.price.id,
    );

    if (
      unsafe.length > 0 ||
      !targetProductAction ||
      !["CREATE", "UPDATE"].includes(targetProductAction.action) ||
      !targetPriceAction ||
      !["CREATE", "REACTIVATE", "UNCHANGED"].includes(
        targetPriceAction.action,
      )
    ) {
      throw new ConflictError(
        "STRIPE_PLAN_CHANGED",
        "Stripe synchronization plan changed after preflight. Checkout was not activated.",
      );
    }

    const sync = await synchronizeLiveCommerceCatalogue(
      actor,
      {
        catalogueFingerprint: currentPlan.catalogueFingerprint,
        confirm: true,
      },
      requestMetadata,
    );

    if (sync.errors.length > 0) {
      throw new AppError(
        "STRIPE_SYNC_WARNINGS",
        "Stripe synchronization completed with provider warnings. Checkout remains disabled.",
        502,
      );
    }

    const verification = await verifyLiveStripeMapping(
      actor,
      requestMetadata,
    );

    if (
      verification.errored > 0 ||
      verification.skipped > 0 ||
      verification.drift.length > 0
    ) {
      throw new AppError(
        "STRIPE_VERIFY_FAILED",
        "Stripe verification reported drift or unreachable mappings. Checkout remains disabled.",
        502,
      );
    }

    const productMapping = await findProductMapping(
      "STRIPE",
      "LIVE",
      target.product.id,
    );
    const priceMapping = await findPriceMapping(
      "STRIPE",
      "LIVE",
      target.price.id,
    );

    if (
      !productMapping?.providerActive ||
      productMapping.synchronizationStatus !== "SYNCED" ||
      !priceMapping?.providerActive ||
      priceMapping.synchronizationStatus !== "SYNCED"
    ) {
      throw new AppError(
        "STRIPE_TARGET_MAPPING_NOT_READY",
        "The target Product/Price mapping did not verify as active and synchronized.",
        502,
      );
    }

    stagedMetadata = await updateCheckoutMetadata(
      target.product.id,
      stagedMetadata,
      {
        state: "READY",
        lastErrorCode: null,
        activatedAt: new Date().toISOString(),
      },
      { isActive: true, isPublic: true },
    );

    await prisma.platformAuditLog.create({
      data: {
        actorUserId: actor.userId,
        actorPlatformRole: actor.platformRole,
        action: "commerce_product_manager.checkout_ready",
        targetType: "CommerceProduct",
        targetId: target.product.id,
        requestMetadataJson: requestMetadataJson(requestMetadata),
        afterJson: {
          productCode: target.product.code,
          priceCode: target.price.code,
          checkoutState: "READY",
          provider: "STRIPE",
          environment: "LIVE",
        },
      },
    });

    return {
      checkoutState: "READY" as const,
      preflight,
      alreadyReady: false,
      syncRun: sync.run,
      verificationRun: verification.run,
    };
  } catch (error) {
    const errorCode =
      error instanceof AppError || error instanceof ConflictError
        ? error.code
        : "CHECKOUT_ACTIVATION_FAILED";

    await updateCheckoutMetadata(
      target.product.id,
      stagedMetadata,
      {
        state: "ERROR",
        lastErrorCode: errorCode,
        activatedAt: null,
      },
      { isActive: false, isPublic: false },
    );

    if (previousReviewStatus !== "APPROVED") {
      try {
        await setCommercePriceReview(
          actor,
          target.price.id,
          {
            reviewStatus: previousReviewStatus,
            reviewNote:
              "Restored after failed Product Manager Stripe activation.",
          },
          requestMetadata,
        );
      } catch {
        // Product flags are already false, so checkout remains fail-closed
        // even if restoring the review status itself cannot be recorded.
      }
    }

    throw error;
  }
}
