import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Owner acceptance scenario: a first-time professional logs in, opens a
 * project, and presses CREATE BOQ. The interface — not external
 * instructions — must tell them what to do next. This drives the real UI
 * exactly as a human would: no direct router calls, no internal-route
 * shortcuts.
 *
 * Uses a freshly created, genuinely BOQ-less project so the wizard's
 * cold-start behavior (Phase 15: CREATE BOQ must show the real choice
 * screen, never silently create an empty revision first) is actually
 * exercised — every seeded demo project already has a BOQ.
 */

const prisma = new PrismaClient();
const COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_ID = "00000000-0000-4000-8000-000000000201";

let projectSlug: string;

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe.serial("First-time professional — CREATE BOQ wizard", () => {
  test.beforeAll(async () => {
    await prisma.client.upsert({
      where: { id: CLIENT_ID },
      update: {},
      create: {
        id: CLIENT_ID,
        companyId: COMPANY_ID,
        name: "First-Time-User Test Client",
        email: "first-time-user-test@example.test",
      },
    });
    projectSlug = `first-time-user-wizard-${Date.now()}`;
    await prisma.project.create({
      data: {
        companyId: COMPANY_ID,
        clientId: CLIENT_ID,
        slug: projectSlug,
        reference: projectSlug,
        name: "First-Time User Wizard Test",
        industryEngineId: (await prisma.industryEngine.findFirstOrThrow({ where: { key: "construction" } })).id,
        currency: "AED",
        taxRate: 5,
      },
    });
  });

  test.afterAll(async () => {
    const project = await prisma.project.findFirst({ where: { companyId: COMPANY_ID, slug: projectSlug } });
    if (project) {
      await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined);
    }
    await prisma.client.delete({ where: { id: CLIENT_ID } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("CREATE BOQ shows the real wizard, never a silently-created empty revision", async ({ page }) => {
    test.setTimeout(180_000);

    await login(page);

    // ---- Open the fresh, genuinely BOQ-less project ----
    await page.goto(`/projects/${projectSlug}/boq`);
    await expect(page.getByText("Choose how you want Quantara to begin")).toBeVisible({ timeout: 40_000 });

    // ---- All three real paths are visible, with honest, non-fabricated copy ----
    await expect(page.getByRole("heading", { name: "Use a Document" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connect an Application" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start Manually" })).toBeVisible();

    // The old false claims ("process sheets automatically", "stream intelligent
    // models") must not be on the page.
    await expect(page.getByText(/we will process sheets and generate measurement candidates automatically/i)).toHaveCount(0);
    await expect(page.getByText(/stream intelligent models/i)).toHaveCount(0);

    // Unavailable paths explain themselves and offer a real alternative instead
    // of being a dead "Coming soon" card.
    await expect(page.getByText("Not available yet").first()).toBeVisible();
    await expect(page.getByText("Use a document instead").first()).toBeVisible();

    // ---- Lightbulb help is visible and independently operable (not the only explanation) ----
    const useDocumentHelp = page.getByRole("button", { name: /Help: How integrations work/i });
    await expect(page.getByRole("button", { name: /Help: What files can I use/i })).toBeVisible();
    await expect(useDocumentHelp).toBeVisible();
    await useDocumentHelp.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: /How integrations work/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /How integrations work/i })).not.toBeVisible();

    // ---- Nothing was silently created while the wizard was showing ----
    const stillNoBoq = await prisma.bOQ.count({ where: { project: { slug: projectSlug } } });
    expect(stillNoBoq).toBe(0);

    // ---- Start Manually creates a real, editable BOQ immediately (Phase 15's one exception) ----
    await page.getByRole("heading", { name: "Start Manually" }).click();
    await expect(page.getByRole("heading", { name: "Add item", exact: true })).toBeVisible({ timeout: 20_000 });

    const nowHasBoq = await prisma.bOQ.count({ where: { project: { slug: projectSlug } } });
    expect(nowHasBoq).toBe(1);

    // ---- Add one real item through the manual entry tab ----
    // The modal overlays the page rather than replacing it, so the underlying
    // "Enter Item Manually" trigger is still in the DOM too — the modal's own
    // tab button is the one that renders last.
    await page.getByRole("button", { name: "Enter Item Manually" }).last().click();
    await page.getByPlaceholder("Item code").fill("FTU-001");
    await page.getByPlaceholder("Category").fill("Testing");
    await page.getByPlaceholder("Description").fill("First-time user wizard test item");
    await page.getByPlaceholder("Unit", { exact: true }).fill("m2");
    await page.getByPlaceholder("Quantity").fill("10");
    await page.getByPlaceholder("Unit cost").fill("100");
    await page.getByRole("button", { name: "Add to BOQ" }).click();
    await expect(page.locator('input[value="FTU-001"]')).toBeVisible({ timeout: 15_000 });

    // ---- Persistent guidance is visible without any hover ----
    const guidance = page.getByRole("status", { name: "What should I do next" });
    await expect(guidance).toBeVisible({ timeout: 15_000 });
    await expect(guidance.getByText("Current stage")).toBeVisible();
  });
});
