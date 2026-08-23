import fs from "node:fs";
import path from "node:path";
import {
  PlatformRole,
  UserRole,
  type CommercePrice,
  type CommerceProduct,
  type CommerceProviderMapping,
} from "@prisma/client";
import type Stripe from "stripe";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError } from "../src/lib/errors/app-error";
import {
  listCommerceProducts,
  toPublicCommerceProductDTO,
} from "../src/lib/repositories/commerce-product-repository";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import { ensureTayqanCommerceReady } from "../src/lib/services/tayqan-commerce-readiness-service";
import { TAYQAN_HIRE_PLANS } from "../src/lib/tayqan/tayqan-commerce";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

const REPO = process.cwd();
const RUN_ID = `${Date.now()}-${process.pid}-tayqan-ready`;
const SYSTEM_APPROVAL_NOTE = "System-approved fixed TAYQAN hire catalogue price";
const PRODUCT_CODES = TAYQAN_HIRE_PLANS.map((plan) => plan.productCode);
const PRICE_CODES = TAYQAN_HIRE_PLANS.map((plan) => plan.priceCode);
const REQUEST_METADATA = {
  method: "POST",
  path: "/api/admin/commerce/tayqan-ready",
  requestId: RUN_ID,
};

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(REPO, ...parts), "utf8");
}

let fakeSequence = 0;

/**
 * Stateful fake of the exact LIVE Stripe surface used by TAYQAN readiness.
 * Three unrelated objects are present from the outset and pages are capped
 * at two records, so every readiness call proves the service follows
 * starting_after pagination rather than trusting the first page.
 */
function fakeLiveStripe() {
  const fakeId = `${RUN_ID}-${++fakeSequence}`;
  const products: Stripe.Product[] = [];
  const prices: Stripe.Price[] = [];
  const productCreateCalls: Array<{
    params: Stripe.ProductCreateParams;
    options?: Stripe.RequestOptions;
  }> = [];
  const priceCreateCalls: Array<{
    params: Stripe.PriceCreateParams;
    options?: Stripe.RequestOptions;
  }> = [];

  function addProduct(input: {
    id?: string;
    code: string;
    name: string;
    description?: string | null;
    active?: boolean;
    livemode?: boolean;
    environment?: string;
  }): Stripe.Product {
    const product = {
      id: input.id ?? `prod_${fakeId}_${products.length + 1}`,
      object: "product",
      active: input.active ?? true,
      attributes: [],
      created: 1_787_443_200,
      default_price: null,
      description: input.description ?? null,
      images: [],
      livemode: input.livemode ?? true,
      marketing_features: [],
      metadata: {
        quantara_product_code: input.code,
        quantara_environment: input.environment ?? "live",
        quantara_created_by: "tayqan_readiness_service",
      },
      name: input.name,
      package_dimensions: null,
      shippable: null,
      statement_descriptor: null,
      tax_code: null,
      type: "service",
      unit_label: null,
      updated: 1_787_443_200,
      url: null,
    } as unknown as Stripe.Product;
    products.push(product);
    return product;
  }

  function addPrice(input: {
    id?: string;
    code: string;
    productId: string;
    amountMinor: number;
    currency?: string;
    interval?: "ONE_TIME" | "MONTH" | "YEAR";
    active?: boolean;
    livemode?: boolean;
    environment?: string;
  }): Stripe.Price {
    const recurring = input.interval === "MONTH"
      ? { interval: "month", interval_count: 1 }
      : input.interval === "YEAR"
        ? { interval: "year", interval_count: 1 }
        : null;
    const price = {
      id: input.id ?? `price_${fakeId}_${prices.length + 1}`,
      object: "price",
      active: input.active ?? true,
      billing_scheme: "per_unit",
      created: 1_787_443_200,
      currency: (input.currency ?? "aed").toLowerCase(),
      custom_unit_amount: null,
      livemode: input.livemode ?? true,
      lookup_key: null,
      metadata: {
        quantara_price_code: input.code,
        quantara_environment: input.environment ?? "live",
        quantara_created_by: "tayqan_readiness_service",
      },
      nickname: null,
      product: input.productId,
      recurring,
      tax_behavior: "unspecified",
      tiers_mode: null,
      transform_quantity: null,
      type: recurring ? "recurring" : "one_time",
      unit_amount: input.amountMinor,
      unit_amount_decimal: String(input.amountMinor),
    } as unknown as Stripe.Price;
    prices.push(price);
    return price;
  }

  for (let index = 0; index < 3; index += 1) {
    const product = addProduct({
      code: `unrelated_${fakeId}_${index}`,
      name: `Unrelated ${index}`,
    });
    addPrice({
      code: `unrelated_price_${fakeId}_${index}`,
      productId: product.id,
      amountMinor: 100 + index,
      interval: "ONE_TIME",
    });
  }

  function page<T extends { id: string }>(items: T[], startingAfter?: string) {
    const foundIndex = startingAfter
      ? items.findIndex((item) => item.id === startingAfter)
      : -1;
    const start = startingAfter ? foundIndex + 1 : 0;
    const data = items.slice(start, start + 2);
    return {
      object: "list" as const,
      data,
      has_more: start + data.length < items.length,
      url: "/v1/test-fixture",
    };
  }

  const client = {
    products: {
      list: async (params: Stripe.ProductListParams) => page(products, params.starting_after),
      retrieve: async (id: string) => {
        const product = products.find((item) => item.id === id);
        if (!product) throw new Error("FAKE_STRIPE_PRODUCT_NOT_FOUND");
        return product;
      },
      create: async (
        params: Stripe.ProductCreateParams,
        options?: Stripe.RequestOptions,
      ) => {
        productCreateCalls.push({ params, options });
        return addProduct({
          code: String(params.metadata?.quantara_product_code),
          name: params.name,
          description: params.description ?? null,
          active: params.active,
        });
      },
    },
    prices: {
      list: async (params: Stripe.PriceListParams) => page(prices, params.starting_after),
      retrieve: async (id: string) => {
        const price = prices.find((item) => item.id === id);
        if (!price) throw new Error("FAKE_STRIPE_PRICE_NOT_FOUND");
        return price;
      },
      create: async (
        params: Stripe.PriceCreateParams,
        options?: Stripe.RequestOptions,
      ) => {
        priceCreateCalls.push({ params, options });
        return addPrice({
          code: String(params.metadata?.quantara_price_code),
          productId: String(params.product),
          amountMinor: params.unit_amount ?? 0,
          currency: params.currency,
          interval: params.recurring?.interval === "month" ? "MONTH" : "ONE_TIME",
        });
      },
    },
  } as unknown as Stripe;

  return {
    client,
    products,
    prices,
    productCreateCalls,
    priceCreateCalls,
    addProduct,
    addPrice,
    productFor(code: string) {
      return products.find((product) => product.metadata.quantara_product_code === code);
    },
    priceFor(code: string) {
      return prices.find((price) => price.metadata.quantara_price_code === code);
    },
    replaceProduct(code: string, patch: Partial<Stripe.Product>) {
      const index = products.findIndex((product) => product.metadata.quantara_product_code === code);
      if (index < 0) throw new Error(`Missing fake Product ${code}`);
      products[index] = { ...products[index], ...patch };
    },
    replacePrice(code: string, patch: Partial<Stripe.Price>) {
      const index = prices.findIndex((price) => price.metadata.quantara_price_code === code);
      if (index < 0) throw new Error(`Missing fake Price ${code}`);
      prices[index] = { ...prices[index], ...patch };
    },
  };
}

type FakeLiveStripe = ReturnType<typeof fakeLiveStripe>;

describe("TAYQAN customer self-checkout and owner-readiness route contracts", () => {
  it("keeps POST /api/tayqan/checkout as customer self-checkout with no PLATFORM_OWNER gate", () => {
    const source = read("src", "app", "api", "tayqan", "checkout", "route.ts");
    const actorIndex = source.indexOf("await getCurrentActor()");
    const capabilityIndex = source.indexOf('requireCapability(actor, "entitlements:manage")');
    const checkoutIndex = source.indexOf("createTayqanCheckoutSession(actor, input)");

    expect(actorIndex).toBeGreaterThan(-1);
    expect(capabilityIndex).toBeGreaterThan(actorIndex);
    expect(checkoutIndex).toBeGreaterThan(capabilityIndex);
    expect(source).not.toContain("PLATFORM_OWNER");
    expect(source).not.toContain("requirePlatformActor");
    expect(source).not.toContain("tayqan-ready");
  });

  it("keeps all three Marketplace CTAs customer-facing on the existing project-selection path", () => {
    const marketplace = read("src", "app", "marketplace", "page.tsx");
    const content = read("src", "config", "marketplace-content.ts");

    expect(marketplace).toContain('href="/projects?tayqan=assign"');
    expect(content).toContain('cta: "Hire TAYQAN for a Day"');
    expect(content).toContain('cta: "Hire TAYQAN for a Week"');
    expect(content).toContain('cta: "Add Monthly Digital QS Capacity"');
  });

  it("makes only the one-time readiness route owner-only and requires strict confirm true", () => {
    const source = read(
      "src",
      "app",
      "api",
      "admin",
      "commerce",
      "tayqan-ready",
      "route.ts",
    );

    expect(source).toContain('export const runtime = "nodejs"');
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("requirePlatformActor(PLATFORM_OWNER_ROLES)");
    expect(source).toContain("confirm: z.literal(true)");
    expect(source).toContain("}).strict()");
    expect(source).toContain("parseJsonBody(request, tayqanReadyRequestSchema)");
  });
});

describe("TAYQAN commerce readiness (integration, real isolated local Postgres, fake LIVE Stripe)", () => {
  let ownerCompanyId: string;
  let ownerUserId: string;
  let originalProducts: CommerceProduct[];
  let originalPrices: CommercePrice[];
  let originalTargetMappings: CommerceProviderMapping[];
  const originalStripeMode = process.env.STRIPE_MODE;

  function ownerActor(): PlatformActor {
    return {
      userId: ownerUserId,
      companyId: ownerCompanyId,
      platformRole: PlatformRole.PLATFORM_OWNER,
      fullName: "TAYQAN Readiness Owner",
      email: `tayqan-ready-owner-${RUN_ID}@example.com`,
    };
  }

  function adminActor(): PlatformActor {
    return { ...ownerActor(), platformRole: PlatformRole.PLATFORM_ADMIN };
  }

  function productIds(): string[] {
    return originalProducts.map((product) => product.id);
  }

  function priceIds(): string[] {
    return originalPrices.map((price) => price.id);
  }

  function productByCode(code: string): CommerceProduct {
    const product = originalProducts.find((row) => row.code === code);
    if (!product) throw new Error(`Missing product fixture ${code}`);
    return product;
  }

  function priceByCode(code: string): CommercePrice {
    const price = originalPrices.find((row) => row.code === code);
    if (!price) throw new Error(`Missing price fixture ${code}`);
    return price;
  }

  async function deleteTargetLiveMappings(): Promise<void> {
    await prisma.commerceProviderMapping.deleteMany({
      where: {
        provider: "STRIPE",
        environment: "LIVE",
        OR: [
          { commerceProductId: { in: productIds() } },
          { commercePriceId: { in: priceIds() } },
        ],
      },
    });
  }

  async function restoreTargetRows(forTest = false): Promise<void> {
    for (const product of originalProducts) {
      await prisma.commerceProduct.update({
        where: { id: product.id },
        data: {
          code: product.code,
          type: product.type,
          name: product.name,
          shortDescription: product.shortDescription,
          description: product.description,
          purchaseMode: product.purchaseMode,
          isActive: product.isActive,
          isPublic: product.isPublic,
          sortOrder: product.sortOrder,
          industryPackageId: product.industryPackageId,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
      });
    }

    for (const price of originalPrices) {
      await prisma.commercePrice.update({
        where: { id: price.id },
        data: {
          productId: price.productId,
          code: price.code,
          amountMinor: price.amountMinor,
          currency: price.currency,
          billingInterval: price.billingInterval,
          isFromPrice: price.isFromPrice,
          isActive: price.isActive,
          validFrom: price.validFrom,
          validUntil: price.validUntil,
          reviewStatus: forTest ? "REQUIRES_REVIEW" : price.reviewStatus,
          reviewedByUserId: forTest ? null : price.reviewedByUserId,
          reviewedAt: forTest ? null : price.reviewedAt,
          reviewNote: forTest ? null : price.reviewNote,
          createdAt: price.createdAt,
          updatedAt: price.updatedAt,
        },
      });
    }
  }

  function addCanonicalStripeObjects(fake: FakeLiveStripe): void {
    const providerProductIds = new Map<string, string>();
    for (const plan of TAYQAN_HIRE_PLANS) {
      const product = productByCode(plan.productCode);
      const stripeProduct = fake.addProduct({
        code: plan.productCode,
        name: product.name,
        description: product.description,
      });
      providerProductIds.set(plan.productCode, stripeProduct.id);
    }
    for (const plan of TAYQAN_HIRE_PLANS) {
      fake.addPrice({
        code: plan.priceCode,
        productId: providerProductIds.get(plan.productCode) as string,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
        interval: plan.billingInterval,
      });
    }
  }

  async function runReadiness(fake: FakeLiveStripe) {
    return ensureTayqanCommerceReady(ownerActor(), REQUEST_METADATA, fake.client);
  }

  async function targetGovernance() {
    return prisma.commercePrice.findMany({
      where: { id: { in: priceIds() } },
      select: {
        id: true,
        reviewStatus: true,
        reviewedByUserId: true,
        reviewedAt: true,
        reviewNote: true,
        updatedAt: true,
      },
      orderBy: { code: "asc" },
    });
  }

  async function expectFailsClosed(fake: FakeLiveStripe, code: string): Promise<void> {
    await expect(runReadiness(fake)).rejects.toMatchObject({ code });
    expect(fake.productCreateCalls).toHaveLength(0);
    expect(fake.priceCreateCalls).toHaveLength(0);
    expect(await targetGovernance()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewStatus: "REQUIRES_REVIEW",
          reviewedByUserId: null,
          reviewedAt: null,
          reviewNote: null,
        }),
      ]),
    );
    expect(await prisma.commerceProviderMapping.count({
      where: {
        provider: "STRIPE",
        environment: "LIVE",
        OR: [
          { commerceProductId: { in: productIds() } },
          { commercePriceId: { in: priceIds() } },
        ],
      },
    })).toBe(0);
  }

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    originalProducts = await prisma.commerceProduct.findMany({
      where: { code: { in: PRODUCT_CODES } },
      orderBy: { code: "asc" },
    });
    originalPrices = await prisma.commercePrice.findMany({
      where: { code: { in: PRICE_CODES } },
      orderBy: { code: "asc" },
    });
    if (originalProducts.length !== 3 || originalPrices.length !== 3) {
      throw new Error("Canonical seeded TAYQAN catalogue is required for this integration suite.");
    }

    originalTargetMappings = await prisma.commerceProviderMapping.findMany({
      where: {
        provider: "STRIPE",
        environment: "LIVE",
        OR: [
          { commerceProductId: { in: productIds() } },
          { commercePriceId: { in: priceIds() } },
        ],
      },
    });

    const company = await prisma.company.create({
      data: {
        legalName: `TAYQAN Readiness ${RUN_ID}`,
        tradeName: "TAYQAN Readiness",
        email: `tayqan-ready-${RUN_ID}@example.com`,
      },
    });
    ownerCompanyId = company.id;
    const owner = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `tayqan-ready-owner-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: "TAYQAN Readiness Owner",
        role: UserRole.COMPANY_OWNER,
        platformRole: PlatformRole.PLATFORM_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    ownerUserId = owner.id;
  });

  beforeEach(async () => {
    process.env.STRIPE_MODE = "live";
    await deleteTargetLiveMappings();
    await restoreTargetRows(true);
    await prisma.platformAuditLog.deleteMany({
      where: { actorUserId: ownerUserId, action: "commerce_tayqan.ready" },
    });
  });

  afterEach(async () => {
    await deleteTargetLiveMappings();
    await restoreTargetRows(false);
    await prisma.platformAuditLog.deleteMany({
      where: { actorUserId: ownerUserId, action: "commerce_tayqan.ready" },
    });
    if (originalStripeMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalStripeMode;
  });

  afterAll(async () => {
    await deleteTargetLiveMappings();
    await restoreTargetRows(false);
    if (originalTargetMappings.length > 0) {
      await prisma.commerceProviderMapping.createMany({ data: originalTargetMappings });
    }
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => undefined);
    await prisma.company.delete({ where: { id: ownerCompanyId } }).catch(() => undefined);
    if (originalStripeMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalStripeMode;
    await prisma.$disconnect();
  });

  it("1. accepts exactly the three canonical TAYQAN products", async () => {
    const fake = fakeLiveStripe();
    addCanonicalStripeObjects(fake);

    const report = await runReadiness(fake);

    expect(report.items.map((item) => item.productCode)).toEqual(PRODUCT_CODES);
    expect(report.items).toHaveLength(3);
    for (const plan of TAYQAN_HIRE_PLANS) {
      const product = await prisma.commerceProduct.findUniqueOrThrow({
        where: { code: plan.productCode },
      });
      expect(product).toMatchObject({
        type: plan.billingInterval === "ONE_TIME" ? "ONE_TIME" : "SUBSCRIPTION",
        purchaseMode: "DIRECT",
        isActive: true,
        isPublic: true,
        industryPackageId: null,
      });
    }
  });

  it("2. accepts exactly the three canonical TAYQAN prices", async () => {
    const fake = fakeLiveStripe();
    addCanonicalStripeObjects(fake);

    const report = await runReadiness(fake);

    expect(report.items.map((item) => item.priceCode)).toEqual(PRICE_CODES);
    for (const plan of TAYQAN_HIRE_PLANS) {
      const price = await prisma.commercePrice.findUniqueOrThrow({
        where: { code: plan.priceCode },
      });
      expect(price).toMatchObject({
        productId: productByCode(plan.productCode).id,
        amountMinor: plan.amountMinor,
        currency: "AED",
        billingInterval: plan.billingInterval,
        isFromPrice: false,
        isActive: true,
      });
    }
  });

  it("3. approves REQUIRES_REVIEW prices only for the exact TAYQAN allowlist", async () => {
    const unrelatedBefore = await prisma.commercePrice.findMany({
      where: { id: { notIn: priceIds() } },
      select: {
        id: true,
        reviewStatus: true,
        reviewedByUserId: true,
        reviewedAt: true,
        reviewNote: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    });
    const fake = fakeLiveStripe();

    const report = await runReadiness(fake);

    expect(report.items.every((item) => item.priceApproval === "APPROVED")).toBe(true);
    const approved = await targetGovernance();
    expect(approved).toHaveLength(3);
    for (const price of approved) {
      expect(price).toMatchObject({
        reviewStatus: "APPROVED",
        reviewedByUserId: null,
        reviewNote: SYSTEM_APPROVAL_NOTE,
      });
      expect(price.reviewedAt).toBeInstanceOf(Date);
    }
    expect(await prisma.commercePrice.findMany({
      where: { id: { notIn: priceIds() } },
      select: {
        id: true,
        reviewStatus: true,
        reviewedByUserId: true,
        reviewedAt: true,
        reviewNote: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    })).toEqual(unrelatedBefore);
  });

  it("4. leaves already-approved price governance byte-for-byte unchanged", async () => {
    const approvedAt = new Date("2026-08-23T04:00:00.000Z");
    await prisma.commercePrice.updateMany({
      where: { id: { in: priceIds() } },
      data: {
        reviewStatus: "APPROVED",
        reviewedByUserId: ownerUserId,
        reviewedAt: approvedAt,
        reviewNote: `pre-approved-${RUN_ID}`,
      },
    });
    const before = await targetGovernance();
    const fake = fakeLiveStripe();

    const report = await runReadiness(fake);

    expect(report.items.every((item) => item.priceApproval === "ALREADY_APPROVED")).toBe(true);
    expect(await targetGovernance()).toEqual(before);
  });

  it("5. fails closed when a stored amount is wrong", async () => {
    await prisma.commercePrice.update({
      where: { id: priceByCode("tayqan_week_999").id },
      data: { amountMinor: 99_800 },
    });
    await expectFailsClosed(fakeLiveStripe(), "TAYQAN_CATALOGUE_DRIFT");
  });

  it("6. fails closed when an existing Stripe Price currency is wrong", async () => {
    const fake = fakeLiveStripe();
    addCanonicalStripeObjects(fake);
    fake.replacePrice("tayqan_day_299", { currency: "usd" });
    await expectFailsClosed(fake, "TAYQAN_STRIPE_PRICE_DRIFT");
  });

  it("7. fails closed when a stored billing interval is wrong", async () => {
    await prisma.commercePrice.update({
      where: { id: priceByCode("tayqan_monthly_2499").id },
      data: { billingInterval: "YEAR" },
    });
    await expectFailsClosed(fakeLiveStripe(), "TAYQAN_CATALOGUE_DRIFT");
  });

  it("8. fails closed when a stored product type is wrong", async () => {
    await prisma.commerceProduct.update({
      where: { id: productByCode("tayqan_day").id },
      data: { type: "ADD_ON" },
    });
    await expectFailsClosed(fakeLiveStripe(), "TAYQAN_CATALOGUE_DRIFT");
  });

  it("9. fails closed on multiple Stripe metadata candidates", async () => {
    const productDuplicate = fakeLiveStripe();
    addCanonicalStripeObjects(productDuplicate);
    const day = productByCode("tayqan_day");
    productDuplicate.addProduct({
      code: "tayqan_day",
      name: day.name,
      description: day.description,
    });
    await expectFailsClosed(productDuplicate, "TAYQAN_STRIPE_PRODUCT_AMBIGUOUS");

    const priceDuplicate = fakeLiveStripe();
    addCanonicalStripeObjects(priceDuplicate);
    priceDuplicate.addPrice({
      code: "tayqan_day_299",
      productId: priceDuplicate.productFor("tayqan_day")?.id as string,
      amountMinor: 29_900,
      interval: "ONE_TIME",
    });
    await expectFailsClosed(priceDuplicate, "TAYQAN_STRIPE_PRICE_AMBIGUOUS");
  });

  it("10. adopts one exact existing Stripe Product and Price per TAYQAN plan", async () => {
    const fake = fakeLiveStripe();
    addCanonicalStripeObjects(fake);

    const report = await runReadiness(fake);

    expect(fake.productCreateCalls).toHaveLength(0);
    expect(fake.priceCreateCalls).toHaveLength(0);
    expect(report.items.every((item) => item.stripeProduct === "ADOPTED")).toBe(true);
    expect(report.items.every((item) => item.stripePrice === "ADOPTED")).toBe(true);
    for (const plan of TAYQAN_HIRE_PLANS) {
      const mapping = await prisma.commerceProviderMapping.findFirstOrThrow({
        where: {
          provider: "STRIPE",
          environment: "LIVE",
          providerObjectType: "PRICE",
          commercePriceId: priceByCode(plan.priceCode).id,
        },
      });
      expect(mapping.providerProductId).toBe(fake.productFor(plan.productCode)?.id);
      expect(mapping.providerPriceId).toBe(fake.priceFor(plan.priceCode)?.id);
    }
  });

  it("11. creates missing Stripe Products, Prices, and deterministic mappings", async () => {
    const fake = fakeLiveStripe();

    const report = await runReadiness(fake);

    expect(fake.productCreateCalls).toHaveLength(3);
    expect(fake.priceCreateCalls).toHaveLength(3);
    expect(report.items.every((item) => item.stripeProduct === "CREATED")).toBe(true);
    expect(report.items.every((item) => item.stripePrice === "CREATED")).toBe(true);
    expect(report.items.every((item) => item.productMapping === "CREATED")).toBe(true);
    expect(report.items.every((item) => item.priceMapping === "CREATED")).toBe(true);
    const idempotencyKeys = [
      ...fake.productCreateCalls.map((call) => call.options?.idempotencyKey),
      ...fake.priceCreateCalls.map((call) => call.options?.idempotencyKey),
    ];
    expect(new Set(idempotencyKeys).size).toBe(6);
    expect(idempotencyKeys.every((key) => key?.startsWith("quantara:live:tayqan_readiness:"))).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/sk_(?:test|live)_/);
  });

  it("12. creates Day and Week as one-time Stripe Prices", async () => {
    const fake = fakeLiveStripe();
    await runReadiness(fake);

    for (const code of ["tayqan_day_299", "tayqan_week_999"]) {
      const call = fake.priceCreateCalls.find(
        (item) => item.params.metadata?.quantara_price_code === code,
      );
      expect(call?.params.recurring).toBeUndefined();
      expect(fake.priceFor(code)).toMatchObject({ type: "one_time", recurring: null });
    }
  });

  it("13. creates Monthly as a recurring month Stripe Price", async () => {
    const fake = fakeLiveStripe();
    await runReadiness(fake);

    const call = fake.priceCreateCalls.find(
      (item) => item.params.metadata?.quantara_price_code === "tayqan_monthly_2499",
    );
    expect(call?.params.recurring).toEqual({ interval: "month" });
    expect(fake.priceFor("tayqan_monthly_2499")).toMatchObject({
      type: "recurring",
      recurring: { interval: "month", interval_count: 1 },
    });
  });

  it("14. creates or updates mappings only for the three TAYQAN products and prices", async () => {
    const fake = fakeLiveStripe();
    await runReadiness(fake);

    const targetMappings = await prisma.commerceProviderMapping.findMany({
      where: {
        provider: "STRIPE",
        environment: "LIVE",
        OR: [
          { commerceProductId: { in: productIds() } },
          { commercePriceId: { in: priceIds() } },
        ],
      },
    });
    expect(targetMappings).toHaveLength(6);
    expect(targetMappings.filter((mapping) => mapping.providerObjectType === "PRODUCT")).toHaveLength(3);
    expect(targetMappings.filter((mapping) => mapping.providerObjectType === "PRICE")).toHaveLength(3);
    for (const mapping of targetMappings) {
      expect(mapping).toMatchObject({
        provider: "STRIPE",
        environment: "LIVE",
        providerActive: true,
        synchronizationStatus: "SYNCED",
        lastErrorCode: null,
      });
      expect(productIds()).toContain(mapping.commerceProductId);
      if (mapping.providerObjectType === "PRICE") {
        expect(priceIds()).toContain(mapping.commercePriceId);
      }
    }
  });

  it("15. leaves every unrelated Starter, Professional, Business, Enterprise, and library mapping unchanged", async () => {
    const createdSentinelIds: string[] = [];
    const namedProducts = await Promise.all(
      ["starter", "professional", "business", "enterprise_core"].map((code) => (
        prisma.commerceProduct.findUniqueOrThrow({
          where: { code },
          include: { prices: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1 } },
        })
      )),
    );
    const libraryProduct = await prisma.commerceProduct.findFirstOrThrow({
      where: { industryPackageId: { not: null }, isActive: true },
      include: { prices: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1 } },
      orderBy: { code: "asc" },
    });

    for (const product of [...namedProducts, libraryProduct]) {
      expect(product.prices).toHaveLength(1);
      let productMapping = await prisma.commerceProviderMapping.findFirst({
        where: {
          provider: "STRIPE",
          environment: "LIVE",
          providerObjectType: "PRODUCT",
          commerceProductId: product.id,
        },
      });
      if (!productMapping) {
        productMapping = await createMapping({
          provider: "STRIPE",
          environment: "LIVE",
          commerceProductId: product.id,
          providerProductId: `prod_live_unrelated_${product.code}_${RUN_ID}`,
          providerObjectType: "PRODUCT",
        });
        createdSentinelIds.push(productMapping.id);
      }

      const price = product.prices[0];
      const existingPriceMapping = await prisma.commerceProviderMapping.findFirst({
        where: {
          provider: "STRIPE",
          environment: "LIVE",
          providerObjectType: "PRICE",
          commercePriceId: price.id,
        },
      });
      if (!existingPriceMapping) {
        const priceMapping = await createMapping({
          provider: "STRIPE",
          environment: "LIVE",
          commerceProductId: product.id,
          commercePriceId: price.id,
          providerProductId: productMapping.providerProductId,
          providerPriceId: `price_live_unrelated_${price.code}_${RUN_ID}`,
          providerObjectType: "PRICE",
        });
        createdSentinelIds.push(priceMapping.id);
      }
    }

    try {
      const before = await prisma.commerceProviderMapping.findMany({
        where: {
          provider: "STRIPE",
          environment: "LIVE",
          commerceProductId: { notIn: productIds() },
        },
        orderBy: { id: "asc" },
      });
      expect(before.length).toBeGreaterThan(0);

      await runReadiness(fakeLiveStripe());

      expect(await prisma.commerceProviderMapping.findMany({
        where: {
          provider: "STRIPE",
          environment: "LIVE",
          commerceProductId: { notIn: productIds() },
        },
        orderBy: { id: "asc" },
      })).toEqual(before);
    } finally {
      if (createdSentinelIds.length > 0) {
        await prisma.commerceProviderMapping.deleteMany({
          where: { id: { in: createdSentinelIds } },
        });
      }
    }
  });

  it("16. publishes all three approved TAYQAN prices through the public CommerceProduct projection", async () => {
    await runReadiness(fakeLiveStripe());

    const publicProducts = (await listCommerceProducts({
      activeOnly: true,
      publicOnly: true,
    }))
      .filter((product) => PRODUCT_CODES.includes(product.code as (typeof PRODUCT_CODES)[number]))
      .map(toPublicCommerceProductDTO);

    expect(publicProducts).toHaveLength(3);
    for (const plan of TAYQAN_HIRE_PLANS) {
      expect(publicProducts.find((product) => product.code === plan.productCode)).toMatchObject({
        code: plan.productCode,
        prices: [{
          code: plan.priceCode,
          amountMinor: plan.amountMinor,
          currency: "AED",
          billingInterval: plan.billingInterval,
          isFromPrice: false,
        }],
      });
    }
  });

  it("fails safely instead of seeding when a canonical TAYQAN row is missing", async () => {
    await prisma.commerceProduct.update({
      where: { id: productByCode("tayqan_day").id },
      data: { code: `missing_tayqan_day_${RUN_ID}` },
    });
    await expectFailsClosed(fakeLiveStripe(), "TAYQAN_CATALOGUE_INCOMPLETE");
  });

  it("fails closed when a price is attached to the wrong TAYQAN product", async () => {
    await prisma.commercePrice.update({
      where: { id: priceByCode("tayqan_day_299").id },
      data: { productId: productByCode("tayqan_week").id },
    });
    await expectFailsClosed(fakeLiveStripe(), "TAYQAN_CATALOGUE_DRIFT");
  });

  it("fails closed on an inactive matching Stripe Product", async () => {
    const fake = fakeLiveStripe();
    addCanonicalStripeObjects(fake);
    fake.replaceProduct("tayqan_day", { active: false });
    await expectFailsClosed(fake, "TAYQAN_STRIPE_PRODUCT_DRIFT");
  });

  it("fails closed when a Stripe Price belongs to the wrong Product", async () => {
    const fake = fakeLiveStripe();
    addCanonicalStripeObjects(fake);
    fake.replacePrice("tayqan_day_299", {
      product: fake.productFor("tayqan_week")?.id as string,
    });
    await expectFailsClosed(fake, "TAYQAN_STRIPE_PRICE_DRIFT");
  });

  it("reuses a ready mapping on an idempotent rerun without changing approval data", async () => {
    const fake = fakeLiveStripe();
    await runReadiness(fake);
    const governanceBefore = await targetGovernance();

    const rerun = await runReadiness(fake);

    expect(rerun.items.every((item) => item.alreadyReady)).toBe(true);
    expect(rerun.items.every((item) => item.stripeProduct === "REUSED")).toBe(true);
    expect(rerun.items.every((item) => item.stripePrice === "REUSED")).toBe(true);
    expect(rerun.items.every((item) => item.productMapping === "REUSED")).toBe(true);
    expect(rerun.items.every((item) => item.priceMapping === "REUSED")).toBe(true);
    expect(fake.productCreateCalls).toHaveLength(3);
    expect(fake.priceCreateCalls).toHaveLength(3);
    expect(await targetGovernance()).toEqual(governanceBefore);
  });

  it("repairs only stale TAYQAN mapping health after validating the mapped Stripe objects", async () => {
    const fake = fakeLiveStripe();
    await runReadiness(fake);
    await prisma.commerceProviderMapping.updateMany({
      where: {
        provider: "STRIPE",
        environment: "LIVE",
        OR: [
          { commerceProductId: { in: productIds() } },
          { commercePriceId: { in: priceIds() } },
        ],
      },
      data: {
        providerActive: false,
        synchronizationStatus: "ERROR",
        lastErrorCode: "TEST_STALE_STATE",
      },
    });

    const report = await runReadiness(fake);

    expect(report.items.every((item) => !item.alreadyReady)).toBe(true);
    const mappings = await prisma.commerceProviderMapping.findMany({
      where: {
        provider: "STRIPE",
        environment: "LIVE",
        OR: [
          { commerceProductId: { in: productIds() } },
          { commercePriceId: { in: priceIds() } },
        ],
      },
    });
    expect(mappings).toHaveLength(6);
    expect(mappings.every((mapping) => mapping.providerActive)).toBe(true);
    expect(mappings.every((mapping) => mapping.synchronizationStatus === "SYNCED")).toBe(true);
    expect(mappings.every((mapping) => mapping.lastErrorCode === null)).toBe(true);
  });

  it("rejects a non-owner actor before any Stripe or catalogue mutation", async () => {
    const fake = fakeLiveStripe();
    await expect(
      ensureTayqanCommerceReady(adminActor(), REQUEST_METADATA, fake.client),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(fake.productCreateCalls).toHaveLength(0);
    expect(fake.priceCreateCalls).toHaveLength(0);
    expect((await targetGovernance()).every((price) => price.reviewStatus === "REQUIRES_REVIEW")).toBe(true);
  });

  it("retains explicit fail-closed currency validation despite the AED-only Prisma enum", () => {
    const source = read(
      "src",
      "lib",
      "services",
      "tayqan-commerce-readiness-service.ts",
    );
    expect(source).toContain("price.currency !== plan.currency");
    expect(source).toContain("price.currency.toLowerCase() !== entry.price.currency.toLowerCase()");
  });
});
