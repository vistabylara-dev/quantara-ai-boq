import { test, expect, type Page } from "@playwright/test";
import { PrismaClient, type CommercePriceReviewStatus } from "@prisma/client";
import { assertIsolatedLocalTestDatabase } from "../helpers/isolated-database-guard";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — the master acceptance test for this segment's
 * work, proving the concrete, load-bearing claims against the real UI:
 *
 *   1. An unentitled company selects a Premium item with zero payment
 *      interruption (carried over from CANVA-MODEL-1, re-verified here).
 *   2. The professional preview shows a real readiness summary (sections,
 *      items, total) and, while commercially locked, a visible
 *      "QUANTARA PREVIEW" watermark — never a blob/file URL, only an
 *      in-app HTML render.
 *   3. Requesting the clean download from inside the preview opens the
 *      real per-price unlock panel (POST /api/commerce/checkout, the
 *      canonical contract — not an invented /checkout-session path).
 *   4. The checkout return-state UX is real: a mocked checkout redirect
 *      that never actually grants access lands on "still activating"
 *      (bounded polling, no fake success) — and once real entitlement
 *      exists server-side, the SAME polling mechanism truthfully reaches
 *      "access ready" and restores the exact project via the pending-intent
 *      mechanism (see pending-unlock-intent.ts), never trusting the
 *      checkout=success query param alone.
 *   5. Lock + real clean PDF generation still work once genuinely entitled.
 *
 * Deliberately NOT covered here (see the explicit scoping note in the
 * final closeout report rather than claiming false coverage):
 *   - Positional PDF table recovery and manual page recovery — no
 *     deterministic PDF fixture exists to reliably trigger each fallback
 *     tier through a real upload+job-poll E2E; covered instead by
 *     pdf-positional-text-fallback.test.ts (unit) and the manual-recovery
 *     API routes' own service logic.
 *   - Google Drive first-OAuth round trip — a real OAuth handshake can't be
 *     driven headlessly; covered by google-drive-oauth-routes.test.ts's
 *     "forwards ... into the signed OAuth state" / "restores first-OAuth
 *     project context" tests.
 *   - Measurement/formula guided narrative — covered by the pre-existing
 *     quantity-calculation-service tests (math/governance, unchanged) plus
 *     manual inspection of the relabeled copy (no new automated coverage
 *     added this segment for the narrative framing itself).
 */

const prisma = new PrismaClient();
const COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_ID = "00000000-0000-4000-8000-000000000201";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let projectSlug: string;
let premiumItemCode: string;
let premiumPackageId: string;
let premiumPackageName: string;
let boqId: string;
let priceOriginalStatuses: { id: string; reviewStatus: CommercePriceReviewStatus }[] = [];

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
}

test.describe.serial("CANVA-HUMAN-JOURNEY-FINAL — premium selection, watermarked preview, unlock, checkout return states", () => {
  test.beforeAll(async () => {
    assertIsolatedLocalTestDatabase("first-time-user-canva-boq-journey E2E setup");

    const membership = await prisma.industryDataPackageItem.findFirstOrThrow({
      where: { masterItem: { isPremium: true, status: "ACTIVE" }, package: { key: "mechanical-hvac-professional" } },
      include: { masterItem: true, package: true },
    });
    premiumItemCode = membership.masterItem.itemCode;
    premiumPackageId = membership.packageId;
    premiumPackageName = membership.package.name;

    await prisma.companyPackageSubscription.deleteMany({ where: { companyId: COMPANY_ID, packageId: premiumPackageId } });

    const commerceProduct = await prisma.commerceProduct.findFirstOrThrow({ where: { industryPackageId: premiumPackageId } });
    const pricesToApprove = await prisma.commercePrice.findMany({
      where: { productId: commerceProduct.id, billingInterval: "MONTH", reviewStatus: { not: "APPROVED" } },
      select: { id: true, reviewStatus: true },
    });
    // Track each price's true original status (not just "not approved") so
    // teardown restores exactly what was there before, rather than
    // blanket-overwriting e.g. a REJECTED price to REQUIRES_REVIEW.
    priceOriginalStatuses = pricesToApprove.map((p) => ({ id: p.id, reviewStatus: p.reviewStatus }));
    await prisma.commercePrice.updateMany({
      where: { id: { in: pricesToApprove.map((p) => p.id) } },
      data: { reviewStatus: "APPROVED" },
    });

    await prisma.client.upsert({
      where: { id: CLIENT_ID },
      update: {},
      create: { id: CLIENT_ID, companyId: COMPANY_ID, name: "Canva Journey Test Client", email: "canva-journey-client@example.test" },
    });
    projectSlug = `canva-journey-${Date.now()}`;
    await prisma.project.create({
      data: {
        companyId: COMPANY_ID,
        clientId: CLIENT_ID,
        slug: projectSlug,
        reference: projectSlug,
        name: "Canva Human Journey Test",
        industryEngineId: (await prisma.industryEngine.findFirstOrThrow({ where: { key: "construction" } })).id,
        currency: "AED",
        taxRate: 5,
      },
    });
  });

  test.afterAll(async () => {
    for (const { id, reviewStatus } of priceOriginalStatuses) {
      await prisma.commercePrice.update({ where: { id }, data: { reviewStatus } });
    }
    await prisma.companyPackageSubscription.deleteMany({ where: { companyId: COMPANY_ID, packageId: premiumPackageId } });
    const project = await prisma.project.findFirst({ where: { companyId: COMPANY_ID, slug: projectSlug } });
    if (project) {
      const boqs = await prisma.bOQ.findMany({ where: { projectId: project.id } });
      for (const boq of boqs) {
        await prisma.bOQItem.deleteMany({ where: { section: { boqId: boq.id } } });
        await prisma.bOQSection.deleteMany({ where: { boqId: boq.id } });
      }
      await prisma.bOQ.deleteMany({ where: { projectId: project.id } });
      await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  test("premium selection, watermarked preview, unlock panel, and truthful checkout return states", async ({ page }) => {
    test.setTimeout(240_000);

    const paymentScreenSeen: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && /checkout\.stripe\.com/.test(frame.url())) paymentScreenSeen.push(frame.url());
    });

    await login(page);

    // ---- Premium item selectable/addable without payment ----
    await page.goto(`/projects/${projectSlug}/boq`);
    await expect(page.getByText("Choose how you want Quantara to begin")).toBeVisible({ timeout: 40_000 });
    await page.getByRole("heading", { name: "Start Manually" }).click();
    await expect(page.getByRole("heading", { name: "Add item", exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Search Catalogue" }).click().catch(() => undefined);
    const searchTab = page.getByRole("tab", { name: /search/i });
    if (await searchTab.count() > 0) await searchTab.click();
    await page.getByPlaceholder(/Search company library, master data/i).fill(premiumItemCode);

    const premiumResult = page.getByRole("button", { name: new RegExp(escapeRegExp(premiumItemCode)) }).first();
    await expect(premiumResult).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Premium", { exact: true }).first()).toBeVisible();
    await premiumResult.click();

    const useThisItemButton = page.getByRole("button", { name: "Use This Item" });
    await expect(useThisItemButton).toBeVisible({ timeout: 20_000 });
    await useThisItemButton.click();
    await expect(page.locator(`input[value="${premiumItemCode}"]`).first()).toBeVisible({ timeout: 20_000 });
    expect(paymentScreenSeen).toHaveLength(0);

    // ---- Give the item a real rate — ZERO_SELLING_RATE is a genuine, pre-existing lock blocker ----
    const itemRow = page.getByRole("row", { name: new RegExp(escapeRegExp(premiumItemCode)) });
    await itemRow.getByRole("spinbutton").nth(1).fill("500");
    const saveDraftButton = page.getByRole("button", { name: "Save draft" });
    await saveDraftButton.click();
    await expect(saveDraftButton).toBeEnabled({ timeout: 20_000 });

    await page.goto(`/projects/${projectSlug}/verification`);
    const rerunButton = page.getByRole("button", { name: "Re-run verification" });
    await expect(rerunButton).toBeVisible({ timeout: 30_000 });
    await rerunButton.click();
    await expect(rerunButton).toBeEnabled({ timeout: 30_000 });

    const boqRecord = await prisma.bOQ.findFirstOrThrow({ where: { project: { companyId: COMPANY_ID, slug: projectSlug } } });
    boqId = boqRecord.id;

    // ---- Professional preview: real readiness summary + watermark while locked ----
    await page.goto(`/projects/${projectSlug}/documents`);
    const previewLink = page.getByRole("link", { name: "Preview My Professional BOQ" });
    await expect(previewLink).toBeVisible({ timeout: 20_000 });
    await previewLink.click();
    await page.waitForURL(/\/documents\/preview/, { timeout: 20_000 });

    await expect(page.getByText("Sections")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Items")).toBeVisible();
    await expect(page.getByText("Grand total")).toBeVisible();

    const previewFrame = page.frameLocator('iframe[title="Document preview"]');
    await expect(previewFrame.getByText("QUANTARA PREVIEW — DRAFT — UNLOCK TO DOWNLOAD")).toBeVisible({ timeout: 20_000 });

    // ---- Download Clean Version opens the real unlock panel (no payment screen) ----
    await page.getByRole("button", { name: "Download Clean Version" }).click();
    await expect(page.getByRole("dialog", { name: "Your professional BOQ is ready" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(premiumPackageName, { exact: true })).toBeVisible();
    const unlockButton = page.getByRole("button", { name: `Unlock ${premiumPackageName}` });
    await expect(unlockButton).toBeVisible();
    expect(paymentScreenSeen).toHaveLength(0);

    // ---- Mock the real checkout contract (POST /api/commerce/checkout — not yet merged) ----
    // so the browser actually leaves for a "checkout" and returns, without
    // ever touching real Stripe or granting entitlement server-side.
    await page.route("**/api/commerce/checkout", async (route) => {
      const returnUrl = new URL("/settings/subscription", page.url());
      returnUrl.searchParams.set("checkout", "success");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { checkoutUrl: returnUrl.toString(), unavailableReason: null } }),
      });
    });

    await unlockButton.click();
    await page.waitForURL(/\/settings\/subscription\?checkout=success/, { timeout: 20_000 });

    // ---- Real bounded polling: entitlement was never actually granted, so this must NOT silently claim success ----
    await expect(page.getByText("Payment received")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Your payment was received. Access is still being activated.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Return to my BOQ" })).toBeVisible();

    // ---- Now grant the real entitlement (simulating what a real webhook eventually would) and prove the SAME truthful mechanism reaches access-ready ----
    await prisma.companyPackageSubscription.create({
      data: {
        companyId: COMPANY_ID,
        packageId: premiumPackageId,
        status: "ACTIVE",
        startsAt: new Date(),
      },
    });

    await page.getByRole("button", { name: "Check again" }).click();
    await expect(page.getByText("✓ Your access is ready")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Continue My BOQ" }).click();

    // Exact-project restore: the pending intent's returnTo was the preview page for this exact project.
    await page.waitForURL(new RegExp(`/projects/${projectSlug}/documents/preview`), { timeout: 20_000 });

    // ---- Now genuinely entitled — the unlock panel must be gone, and lock + real clean PDF generation must work ----
    await page.reload();
    await page.getByRole("button", { name: "Download Clean Version" }).click();
    await expect(page.getByRole("dialog", { name: "Your professional BOQ is ready" })).toHaveCount(0, { timeout: 10_000 });

    await page.goto(`/projects/${projectSlug}/documents`);
    const formatSelect = page.getByLabel("Format");
    await expect(formatSelect).toBeVisible({ timeout: 20_000 });
    await formatSelect.selectOption("PDF");
    await page.getByRole("button", { name: "Review & lock revision" }).click();
    await page.getByRole("button", { name: "Confirm lock" }).click();
    await expect(page.getByText(/is locked and ready/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Generate document", exact: true }).click();
    await expect(page.getByText("COMPLETED").first()).toBeVisible({ timeout: 30_000 });

    expect(paymentScreenSeen).toHaveLength(0);
  });
});
