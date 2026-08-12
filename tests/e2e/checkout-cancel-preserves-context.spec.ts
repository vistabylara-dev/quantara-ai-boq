import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — a focused test for the checkout CANCEL
 * return path specifically. The full first-time-user-canva-boq-journey
 * E2E only exercises the SUCCESS branch (mocked checkout → activating →
 * access-ready); this proves the other real branch Antigravity's hardcoded
 * cancel_url can land on (?checkout=cancelled): the user's project context
 * is restored from the pending-unlock-intent (see pending-unlock-intent.ts),
 * nothing is silently granted, and "Continue My BOQ" returns to the EXACT
 * project/BOQ the unlock was requested from — never a generic settings page.
 */

const prisma = new PrismaClient();
const COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_ID = "00000000-0000-4000-8000-000000000201";

let projectSlug: string;
let boqId: string;

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
}

test.describe.serial("CANVA-HUMAN-JOURNEY-FINAL — checkout cancel return state preserves project context", () => {
  test.beforeAll(async () => {
    await prisma.client.upsert({
      where: { id: CLIENT_ID },
      update: {},
      create: { id: CLIENT_ID, companyId: COMPANY_ID, name: "Canva Cancel Test Client", email: "canva-cancel-client@example.test" },
    });
    projectSlug = `canva-cancel-${Date.now()}`;
    const project = await prisma.project.create({
      data: {
        companyId: COMPANY_ID,
        clientId: CLIENT_ID,
        slug: projectSlug,
        reference: projectSlug,
        name: "Canva Cancel Return Test",
        industryEngineId: (await prisma.industryEngine.findFirstOrThrow({ where: { key: "construction" } })).id,
        currency: "AED",
        taxRate: 5,
      },
    });
    // The cancelled branch never calls GET /commercial-requirements (see
    // checkout-return-status.tsx — polling only starts on checkout=success),
    // so a real BOQ record isn't needed here; only a syntactically valid id
    // to round-trip through sessionStorage.
    boqId = project.id;
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

  test("cancelled checkout shows a truthful message and returns to the exact project — no entitlement granted", async ({ page }) => {
    test.setTimeout(60_000);

    await login(page);

    const returnTo = `/projects/${projectSlug}/documents/preview`;
    // Same mechanism CommercialUnlockPanel uses right before redirecting to
    // real checkout (see pending-unlock-intent.ts) — simulated here directly
    // since this test targets the RETURN side, not the outbound redirect
    // (already covered by first-time-user-canva-boq-journey.spec.ts).
    await page.goto(returnTo).catch(() => undefined);
    await page.evaluate(
      ([id, target]) => {
        sessionStorage.setItem("quantara:pending-boq-unlock", JSON.stringify({ boqId: id, returnTo: target }));
      },
      [boqId, returnTo],
    );

    const subscriptionsBefore = await prisma.companyPackageSubscription.count({ where: { companyId: COMPANY_ID } });

    await page.goto("/settings/subscription?checkout=cancelled");
    await expect(page.getByText("Checkout cancelled")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Your work is safe and nothing was changed.")).toBeVisible();

    // The cancel query param alone must never grant anything.
    const subscriptionsAfter = await prisma.companyPackageSubscription.count({ where: { companyId: COMPANY_ID } });
    expect(subscriptionsAfter).toBe(subscriptionsBefore);

    await page.getByRole("button", { name: "Continue My BOQ" }).click();
    await page.waitForURL(new RegExp(`/projects/${projectSlug}/documents/preview`), { timeout: 20_000 });

    // The pending intent must be consumed, not left to leak into a later, unrelated visit.
    const remainingIntent = await page.evaluate(() => sessionStorage.getItem("quantara:pending-boq-unlock"));
    expect(remainingIntent).toBeNull();
  });
});
