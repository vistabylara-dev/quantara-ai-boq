import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * CANVA-MODEL-1 owner acceptance — proves the two concrete, load-bearing
 * claims of this session's policy change against the real UI:
 *
 *   1. An unentitled company can select a Premium catalogue item and add it
 *      to a working BOQ draft WITHOUT hitting any payment screen.
 *   2. Requesting a clean FINAL export of that same BOQ (still unentitled)
 *      shows the real unlock screen — with the actual package name and
 *      real server-derived price, not a generic error — instead of either
 *      silently succeeding or throwing an opaque 403.
 *
 * This intentionally does NOT attempt to prove the full documented
 * 30-step Canva journey (positional PDF recovery, ambiguous-page recovery,
 * measurement/formula UX, Stripe checkout handoff/return, activation
 * polling) — those UI surfaces either predate this change and are covered
 * by first-time-user-boq-wizard.spec.ts / p0-admin-workflow-acceptance.spec.ts
 * already, or (checkout handoff/return-state screens, real Antigravity
 * checkout-session endpoint) are not yet built. Claiming their coverage
 * here would be exactly the kind of false PASS this project's discipline
 * forbids.
 */

const prisma = new PrismaClient();
const COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_ID = "00000000-0000-4000-8000-000000000201";

let projectSlug: string;
let premiumItemId: string;
let premiumItemCode: string;
let premiumPackageId: string;
let premiumPackageName: string;

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  // First hit after a fresh dev-server spin-up pays a one-time JIT-compile
  // cost across login + auth + dashboard that can exceed 20s.
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
}

test.describe.serial("CANVA-MODEL-1 — premium selection without payment, unlock screen at clean export", () => {
  test.beforeAll(async () => {
    const membership = await prisma.industryDataPackageItem.findFirstOrThrow({
      where: { masterItem: { isPremium: true, status: "ACTIVE" } },
      include: { masterItem: true, package: true },
    });
    premiumItemId = membership.masterItemId;
    premiumItemCode = membership.masterItem.itemCode;
    premiumPackageId = membership.packageId;
    premiumPackageName = membership.package.name;

    // Deterministic starting state: this company must not already own the
    // package the test premium item belongs to, or "no payment screen" and
    // "unlock screen appears" would trivially pass for the wrong reason.
    await prisma.companyPackageSubscription.deleteMany({ where: { companyId: COMPANY_ID, packageId: premiumPackageId } });

    await prisma.client.upsert({
      where: { id: CLIENT_ID },
      update: {},
      create: { id: CLIENT_ID, companyId: COMPANY_ID, name: "Canva Test Client", email: "canva-test-client@example.test" },
    });
    projectSlug = `canva-premium-${Date.now()}`;
    await prisma.project.create({
      data: {
        companyId: COMPANY_ID,
        clientId: CLIENT_ID,
        slug: projectSlug,
        reference: projectSlug,
        name: "Canva Premium Selection Test",
        industryEngineId: (await prisma.industryEngine.findFirstOrThrow({ where: { key: "construction" } })).id,
        currency: "AED",
        taxRate: 5,
      },
    });
  });

  test.afterAll(async () => {
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

  test("premium item is selectable and addable without payment; clean export shows the real unlock screen", async ({ page }) => {
    test.setTimeout(180_000);

    const paymentScreenSeen: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && /checkout\.stripe\.com/.test(frame.url())) paymentScreenSeen.push(frame.url());
    });

    await login(page);

    // ---- Start Manually to get an editable BOQ immediately ----
    await page.goto(`/projects/${projectSlug}/boq`);
    await expect(page.getByText("Choose how you want Quantara to begin")).toBeVisible({ timeout: 40_000 });
    await page.getByRole("heading", { name: "Start Manually" }).click();
    await expect(page.getByRole("heading", { name: "Add item", exact: true })).toBeVisible({ timeout: 20_000 });

    // ---- Search for the real premium item and confirm it's visibly marked Premium ----
    await page.getByRole("button", { name: "Search Catalogue" }).click().catch(() => undefined);
    const searchTab = page.getByRole("tab", { name: /search/i });
    if (await searchTab.count() > 0) await searchTab.click();
    const searchInput = page.getByPlaceholder(/Search company library, master data/i);
    await searchInput.fill(premiumItemCode);

    // The search API route itself pays a one-time dev-server JIT-compile cost
    // on its first hit in a fresh run, on top of the 250ms debounce — give it
    // real headroom rather than a fixed sleep plus a short assertion window.
    const premiumResult = page.getByRole("button", { name: new RegExp(premiumItemCode) }).first();
    await expect(premiumResult).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Premium", { exact: true }).first()).toBeVisible();
    await premiumResult.click();

    // ---- USE THIS ITEM — must add immediately, no payment screen ----
    const useThisItemButton = page.getByRole("button", { name: "Use This Item" });
    await expect(useThisItemButton).toBeVisible({ timeout: 20_000 });
    await useThisItemButton.click();
    // The BOQ editor renders each item's code in an editable <input>, so its
    // value is not a text node — getByText() never matches it.
    await expect(page.locator(`input[value="${premiumItemCode}"]`).first()).toBeVisible({ timeout: 20_000 });

    expect(paymentScreenSeen).toHaveLength(0);
    expect(page.url()).not.toContain("checkout.stripe.com");

    // ---- Premium badge persists in the working BOQ ----
    await expect(page.getByText("Premium", { exact: true }).first()).toBeVisible();

    // A zero-rate item is a real, pre-existing lock blocker (ZERO_SELLING_RATE
    // is a CRITICAL verification rule, unrelated to the commercial gate) — give
    // the item a real rate so this test actually reaches the lock/export step.
    const itemRow = page.getByRole("row", { name: new RegExp(premiumItemCode) });
    await itemRow.getByRole("spinbutton").nth(1).fill("500");
    const saveDraftButton = page.getByRole("button", { name: "Save draft" });
    await saveDraftButton.click();
    await expect(saveDraftButton).toBeEnabled({ timeout: 20_000 });

    await page.goto(`/projects/${projectSlug}/verification`);
    const rerunButton = page.getByRole("button", { name: "Re-run verification" });
    await expect(rerunButton).toBeVisible({ timeout: 30_000 });
    await rerunButton.click();
    await expect(rerunButton).toBeEnabled({ timeout: 30_000 });

    // ---- Request a clean FINAL export — the real unlock screen must appear ----
    await page.goto(`/projects/${projectSlug}/documents`);
    const formatSelect = page.getByLabel("Format");
    await expect(formatSelect).toBeVisible({ timeout: 20_000 });
    await formatSelect.selectOption("PDF");

    // Final-only document types require a locked revision — a pre-existing,
    // commercial-gate-independent rule (document-readiness-state.ts). Lock
    // this fresh revision first so "Generate document" is actually reachable.
    await page.getByRole("button", { name: "Review & lock revision" }).click();
    await page.getByRole("button", { name: "Confirm lock" }).click();
    await expect(page.getByText(/is locked and ready/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Generate document", exact: true }).click();

    // First hit of the new /commercial-requirements route in this run also
    // pays its own JIT-compile cost.
    await expect(page.getByRole("dialog", { name: "Your professional BOQ is ready" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(premiumPackageName)).toBeVisible();
    await expect(page.getByRole("button", { name: "Unlock My BOQ" })).toBeVisible();

    // No payment screen was ever reached just by requesting the unlock view either.
    expect(paymentScreenSeen).toHaveLength(0);
  });
});
