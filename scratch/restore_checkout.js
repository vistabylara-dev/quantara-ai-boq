const fs = require('fs');

const file = 'src/lib/services/commerce-checkout-service.ts';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
  'import { findPriceMapping } from "@/lib/repositories/commerce-provider-mapping-repository";',
  'import { findPriceMapping } from "@/lib/repositories/commerce-provider-mapping-repository";\nimport { generateBoqCommercialManifest } from "@/lib/services/commercial-entitlement-service";'
);

// Update Type
content = content.replace(
  'export type CreateCheckoutSessionInput = { priceCode: string };',
  `export type CreateCheckoutSessionInput = {
  checkoutMode?: "SUBSCRIPTION" | "BOQ_UNLOCK";
  priceCode?: string;
  boqId?: string;
  revisionNumber?: number;
  billingInterval?: "MONTH" | "YEAR";
};`
);

// Update createCommerceCheckoutSession branching
const targetFunctionStart = `export async function createCommerceCheckoutSession(
  actor: CurrentActor,
  input: CreateCheckoutSessionInput,
  overrideClient?: Stripe,
): Promise<CreateCheckoutSessionResult> {
  const environment = resolveCheckoutEnvironment();
  const liveMode = environment === "LIVE";
  const stripe = resolveCommercialStripeClient(overrideClient);
  const baseUrl = validateAppBaseUrl(liveMode);`;

const newFunctionStart = `${targetFunctionStart}

  if (input.checkoutMode === "BOQ_UNLOCK") {
    return handleBoqUnlockCheckoutSession(actor, input, stripe, environment, liveMode, baseUrl);
  }

  if (!input.priceCode) {
    throw new AppError("INVALID_INPUT", "priceCode is required for subscription checkouts.", 400);
  }`;

content = content.replace(targetFunctionStart, newFunctionStart);

// Append handleBoqUnlockCheckoutSession
const appendCode = `

async function handleBoqUnlockCheckoutSession(
  actor: CurrentActor,
  input: CreateCheckoutSessionInput,
  stripe: Stripe,
  environment: CommerceProviderEnvironment,
  liveMode: boolean,
  baseUrl: string,
): Promise<CreateCheckoutSessionResult> {
  const { boqId, revisionNumber, billingInterval = "YEAR" } = input;
  if (!boqId || revisionNumber === undefined) {
    throw new AppError("INVALID_INPUT", "boqId and revisionNumber are required for BOQ unlocks.", 400);
  }

  const boq = await prisma.bOQ.findUnique({ where: { id: boqId } });
  if (!boq) throw new AppError("NOT_FOUND", "BOQ not found.", 404);

  const manifest = await generateBoqCommercialManifest(
    actor.companyId,
    boq.projectId,
    boq.id,
    revisionNumber,
    "BOQ",
    "PDF"
  );

  const unsatisfiedPackages = manifest.packageRequirements.filter((r) => !r.isSatisfied);
  if (unsatisfiedPackages.length === 0) {
    throw new AppError("BOQ_ALREADY_UNLOCKED", "This BOQ requires no additional commercial unlocks.", 400);
  }

  const packageIds = unsatisfiedPackages.map((p) => p.packageId);

  const products = await prisma.commerceProduct.findMany({
    where: { industryPackageId: { in: packageIds }, isActive: true, isPublic: true },
    include: { prices: { where: { isActive: true } } }
  });

  if (products.length !== packageIds.length) {
    throw new CheckoutNotEligibleError("PRODUCT_NOT_PUBLIC", "One or more required packages are not available for purchase.");
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const metadataMap: Record<string, string> = {
    quantara_checkout_mode: "BOQ_UNLOCK",
    quantara_boq_id: boqId,
    quantara_revision_number: revisionNumber.toString()
  };

  for (const product of products) {
    const price = product.prices.find((p) => p.billingInterval === billingInterval) || product.prices[0];
    if (!price) {
      throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "PRICE SETUP PENDING: A required package is missing an approved price.");
    }
    const mapping = await prisma.commerceProviderMapping.findFirst({
      where: { environment, commercePriceId: price.id, providerObjectType: "PRICE" }
    });
    if (!mapping || mapping.synchronizationStatus !== "SYNCED") {
       throw new CheckoutNotEligibleError("PROVIDER_MAPPING_MISSING", "PRICE SETUP PENDING: Price not synced with Stripe.");
    }
    lineItems.push({ price: mapping.providerPriceId, quantity: 1 });
  }

  return prisma.$transaction(async (tx) => {
    await acquireCompanyCheckoutLock(tx, actor.companyId);

    const stripeCustomerId = await getOrCreateStripeCustomerForCompany(stripe, actor, liveMode, tx);

    const appOwnedOpenSessions = await findAppOwnedOpenCheckoutSessions(stripe, stripeCustomerId, actor.companyId);
    for (const session of appOwnedOpenSessions) {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch (e) {
        console.error("[commerce-checkout] Failed to expire stale open Checkout Session", session.id, e);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: lineItems,
      success_url: \`\${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: \`\${baseUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}\`,
      metadata: {
        quantara_company_id: actor.companyId,
        ...metadataMap
      }
    });

    return { checkoutSessionId: session.id, checkoutUrl: session.url };
  });
}
`;

fs.writeFileSync(file, content + appendCode);
