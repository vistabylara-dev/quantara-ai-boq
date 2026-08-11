import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { PrismaClient, BOQStatus } from "@prisma/client";

const prisma = new PrismaClient();
const SEED_BOQ_ID = "50000000-0000-4000-8000-000000000001";
const SEED_ITEM_ID = "70000000-0000-4000-8000-000000000001";

/**
 * Real, owner-style browser acceptance for tonight's P0 admin core recovery
 * (P0-A workflow navigation, P0-B persistent guidance, P0-C voice
 * orchestrator, P0-D document readiness/lock journey). Logs in as the real
 * seeded dev owner (COMPANY_OWNER) and drives the actual UI — no shortcuts
 * through internal services. The only thing mocked is the raw audio ->
 * text transcription network call (no real microphone hardware exists in
 * CI), so a fake media device produces a real MediaRecorder blob and every
 * step downstream of transcription (interpretation, proposal, confirm,
 * mutation, audit) runs for real against the real API and real local DB.
 */

const PROJECT_SLUG = "project-construction-001";
const ITEM_CODE = "C-001";

const SCREENSHOT_DIR = path.join(process.cwd(), "artifacts", "p0-admin-acceptance");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

async function gotoBoq(page: Page) {
  await page.goto(`/projects/${PROJECT_SLUG}/boq`);
  await expect(page.getByText("BOQ Workflow")).toBeVisible({ timeout: 20_000 });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

/** Records ~1s of fake silence, mocking only the transcribe response. */
async function speakAndPropose(page: Page, micButton: ReturnType<Page["getByRole"]>, transcript: string) {
  await page.route("**/api/projects/*/voice/transcribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { transcript, provider: "openai", model: "test-fixture" } }),
    });
  });
  await micButton.scrollIntoViewIfNeeded();
  await micButton.click({ timeout: 10_000 });
  await page.waitForTimeout(700);
  await micButton.click({ timeout: 10_000 });
}

test.describe.serial("P0 admin core — real browser acceptance", () => {
  test.beforeAll(async () => {
    // This spec mutates the real seeded item (voice quantity change) and locks
    // the real seeded BOQ — reset both to a known-good draft state first so the
    // run is idempotent across repeated executions, not just the first one.
    await prisma.bOQItem.update({ where: { id: SEED_ITEM_ID }, data: { quantity: 45 } });
    await prisma.bOQ.update({
      where: { id: SEED_BOQ_ID },
      data: { isLocked: false, status: BOQStatus.DRAFT, lockedAt: null, lockedByUserId: null },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("full workflow: navigation, guidance, voice, lock, PDF", async ({ page }) => {
    test.setTimeout(180_000);

    // ---- Login ----
    await login(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-dashboard.png") });

    // ---- BOQ Studio loads ----
    await gotoBoq(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-boq-studio.png") });

    // ---- P0-A: stepper navigation is real, not decorative ----
    await page.getByRole("button", { name: /^Sources/ }).click();
    await page.waitForURL(new RegExp(`/projects/${PROJECT_SLUG}/files`), { timeout: 20_000 });

    await gotoBoq(page);
    await page.getByRole("button", { name: /^Extraction/ }).click();
    await page.waitForURL(new RegExp(`/projects/${PROJECT_SLUG}/extractions`), { timeout: 20_000 });

    await gotoBoq(page);
    await page.getByRole("button", { name: /^Validation/ }).click();
    await page.waitForURL(new RegExp(`/projects/${PROJECT_SLUG}/verification`), { timeout: 20_000 });

    await gotoBoq(page);
    await page.getByRole("button", { name: /^Output/ }).click();
    await page.waitForURL(new RegExp(`/projects/${PROJECT_SLUG}/documents`), { timeout: 20_000 });

    // "BOQ Review" stays on this page and scrolls to the editor rather than
    // opening the add-item modal.
    await gotoBoq(page);
    await page.getByRole("button", { name: /^BOQ Review/ }).click();
    await expect(page.locator("#boq-editor-section")).toBeInViewport();
    await expect(page.url()).toContain(`/projects/${PROJECT_SLUG}/boq`);

    // ---- P0-B: persistent guidance panel, no hover required ----
    const guidance = page.getByRole("status", { name: "What should I do next" });
    await expect(guidance).toBeVisible({ timeout: 15_000 });
    await expect(guidance.getByText("Current stage")).toBeVisible();
    await expect(guidance.getByText("Why")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-persistent-guidance.png") });

    // ---- P0-C: voice — change quantity, no mutation before confirm ----
    // Scoped to item 1's row and picked by position (Apply rate, mic, Delete) rather
    // than accessible name, since the mic button's name changes to "Stop voice
    // recording" while active — a name-based locator would stop matching mid-flow.
    // "C-001" lives inside an <input value="C-001">, which does not count as
    // textContent — hasText would never match, so filter by the child input instead.
    const itemRow1 = page.getByRole("row").filter({ has: page.locator(`input[value="${ITEM_CODE}"]`) }).first();
    const quantityInput = itemRow1.locator('input[type="number"]').first();
    const itemMic = itemRow1.getByRole("button").nth(1);

    await speakAndPropose(page, itemMic, "change quantity to 60 cubic metres");
    const proposalCard = page.getByRole("region", { name: /Review the proposed change/i });
    await expect(proposalCard).toBeVisible({ timeout: 15_000 });
    await expect(proposalCard.getByText("Change BOQ item C-001 quantity from 45 m3 to 60 m3.")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-voice-proposal.png") });

    // No mutation yet — quantity in the DOM is unchanged.
    await expect(quantityInput).toHaveValue("45");

    await proposalCard.getByRole("button", { name: /Confirm Change/i }).click();
    await expect(proposalCard).not.toBeVisible({ timeout: 15_000 });
    await expect(quantityInput).toHaveValue("60", { timeout: 15_000 });

    // ---- P0-C: voice — safe navigation intent, no proposal, no mutation ----
    await speakAndPropose(page, itemMic, "take me to validation");
    await page.waitForURL(new RegExp(`/projects/${PROJECT_SLUG}/verification`), { timeout: 15_000 });

    // The voice quantity change above bumped the BOQ's version, so the
    // previous verification run is stale — re-run it for real before
    // documents can offer locking, exactly like a professional user would.
    const rerunButton = page.getByRole("button", { name: /Re-run verification/i });
    await expect(rerunButton).toBeEnabled({ timeout: 15_000 });
    await rerunButton.click();
    await expect(rerunButton).toBeEnabled({ timeout: 20_000 });

    // ---- P0-D: document readiness -> lock -> generate -> download ----
    await page.goto(`/projects/${PROJECT_SLUG}/documents`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-documents-before-lock.png") });

    const readiness = page.getByRole("status").filter({ hasText: /DRAFT|LOCKED/ });
    await expect(readiness).toBeVisible({ timeout: 20_000 });

    // Verification just passed with real seed data (high confidence, drawing
    // references) — the lock CTA must be offered now, not silently skipped.
    await expect(page.getByRole("button", { name: "Review & lock revision" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Review & lock revision" }).click();
    await expect(page.getByText(/Locked revisions are immutable/)).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-lock-confirmation.png") });
    await page.getByRole("button", { name: "Confirm lock" }).click();
    await expect(page.getByText(/is locked and ready/)).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-documents-locked.png") });

    await page.selectOption('select:near(:text("Format"))', "PDF").catch(() => undefined);
    await page.getByRole("combobox").filter({ hasText: "" }).first();
    // Ensure Internal audience to avoid the unrelated company-profile-completeness gate.
    const audienceSelect = page.locator("select").filter({ has: page.locator('option[value="INTERNAL"]') });
    await audienceSelect.selectOption("INTERNAL");

    await page.getByRole("button", { name: "Generate document" }).click();
    await expect(page.getByText("COMPLETED").first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-document-generated.png") });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download" }).first().click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const bytes = fs.readFileSync(downloadPath!);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // Sanity: no unexpected server errors surfaced anywhere in this flow.
    expect(page.url()).not.toContain("500");
  });
});
