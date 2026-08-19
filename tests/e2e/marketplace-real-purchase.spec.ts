import { createDirectPrismaClient } from "../../src/lib/db/direct-prisma-client";
import { test, expect, type Page } from "@playwright/test";
import { type CommercePriceReviewStatus } from "@prisma/client";
import { assertIsolatedLocalTestDatabase } from "../helpers/isolated-database-guard";
import { createMapping, findPriceMapping } from "../../src/lib/repositories/commerce-provider-mapping-repository";

/**
 * MARKETPLACE-FIX-2 — proves the marketplace "Buy" action is wired to the
 * real checkout route, not the removed free-activation endpoint: it POSTs
 * to /api/commerce/checkout with the exact priceCode this package's real,
 * approved, provider-synced CommercePrice resolves to. The request is
 * intercepted and fulfilled with a fake checkoutUrl so this test never talks
 * to real Stripe — the point is the marketplace UI's request, not Stripe's
 * response.
 */

const prisma = createDirectPrismaClient();
const COMPANY_ID = "00000000-0000-4000-8000-000000000001";

let premiumPackageKey: string;
let premiumPackageId: string;
let expectedPriceCode: string;
let priceOriginalStatuses: { id: string; reviewStatus: CommercePriceReviewStatus }[] = [];
let createdMapping = false;

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
}

test.describe.serial("MARKETPLACE-FIX-2 — marketplace Buy action calls real checkout with the correct priceCode", () => {
  test.beforeAll(async () => {
    assertIsolatedLocalTestDatabase("marketplace-real-purchase E2E setup");

    premiumPackageKey = "mechanical-hvac-professional";
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: premiumPackageKey } });
    premiumPackageId = pkg.id;

    // Deterministic starting state — this company must not already own the
    // package, and must not have any non-final Stripe software subscription
    // (createCommerceCheckoutSession blocks ANY new checkout while one
    // exists), or the Buy button wouldn't render / would be disabled for the
    // wrong reason.
    await prisma.companyPackageSubscription.deleteMany({ where: { companyId: COMPANY_ID, packageId: premiumPackageId } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: COMPANY_ID, source: "stripe" } });

    const product = await prisma.commerceProduct.findFirstOrThrow({ where: { industryPackageId: premiumPackageId } });
    const monthlyPrice = await prisma.commercePrice.findFirstOrThrow({ where: { productId: product.id, billingInterval: "MONTH" } });
    expectedPriceCode = monthlyPrice.code;

    // Approve it (reviewStatus defaults to REQUIRES_REVIEW) — restored in afterAll.
    priceOriginalStatuses = [{ id: monthlyPrice.id, reviewStatus: monthlyPrice.reviewStatus }];
    await prisma.commercePrice.update({ where: { id: monthlyPrice.id }, data: { reviewStatus: "APPROVED" } });

    // Ensure a synced STRIPE/TEST provider mapping exists so getCheckoutAvailability
    // (which the marketplace UI's priceCode resolution reuses) reports this
    // price as available rather than PROVIDER_MAPPING_MISSING.
    const existingMapping = await findPriceMapping("STRIPE", "TEST", monthlyPrice.id);
    if (!existingMapping) {
      await createMapping({
        provider: "STRIPE",
        environment: "TEST",
        commerceProductId: product.id,
        commercePriceId: monthlyPrice.id,
        providerProductId: `prod_e2e_marketplace_${Date.now()}`,
        providerPriceId: `price_e2e_marketplace_${Date.now()}`,
        providerObjectType: "PRICE",
      });
      createdMapping = true;
    }
  });

  test.afterAll(async () => {
    for (const { id, reviewStatus } of priceOriginalStatuses) {
      await prisma.commercePrice.update({ where: { id }, data: { reviewStatus } });
    }
    if (createdMapping) {
      await prisma.commerceProviderMapping.deleteMany({ where: { providerProductId: { startsWith: "prod_e2e_marketplace_" } } });
    }
    await prisma.companyPackageSubscription.deleteMany({ where: { companyId: COMPANY_ID, packageId: premiumPackageId } });
    await prisma.$disconnect();
  });

  test("clicking Buy on the package detail page POSTs /api/commerce/checkout with this package's real priceCode", async ({ page }) => {
    test.setTimeout(120_000);

    let capturedPriceCode: string | null = null;
    let requestSeen = false;

    await page.route("**/api/commerce/checkout", async (route) => {
      requestSeen = true;
      const body = route.request().postDataJSON() as { priceCode?: string };
      capturedPriceCode = body.priceCode ?? null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { checkoutUrl: "https://checkout.stripe.com/test-fake-session", checkoutSessionId: "cs_test_fake" } }),
      });
    });

    await login(page);
    await page.goto(`/marketplace/${premiumPackageKey}`);

    const buyButton = page.getByRole("button", { name: /buy access/i });
    await expect(buyButton).toBeVisible({ timeout: 30_000 });
    await buyButton.click();

    await expect.poll(() => requestSeen, { timeout: 15_000 }).toBe(true);
    expect(capturedPriceCode).toBe(expectedPriceCode);
  });
});
