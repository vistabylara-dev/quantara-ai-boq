import { expect, test, type BrowserContext, type Page, type Request } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import ar from "../../src/lib/i18n/dictionaries/ar";

const sessionData = {
  authenticated: true,
  user: {
    fullName: "Browser Test Owner",
    email: "owner@example.com",
    role: "COMPANY_OWNER",
    platformRole: null,
  },
};

function envelope(data: unknown) {
  return JSON.stringify({ ok: true, data });
}

async function mockApplicationApis(page: Page, captureContact?: (request: Request) => Promise<void>) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/contact" && request.method() === "POST") {
      await captureContact?.(request);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: envelope({ requestId: "support-browser-test", deliveryStatus: "stored" }),
      });
      return;
    }

    const dataByPath: Record<string, unknown> = {
      "/api/auth/session": sessionData,
      "/api/admin/simulation": { simulation: null },
      "/api/entitlements": { trialUsage: null },
      "/api/dashboard/metrics": {
        activeProjects: 0,
        totalClients: 0,
        totalBoqs: 0,
        totalUploadedFiles: 0,
        totalGeneratedDocuments: 0,
        catalogueItems: 0,
        pendingApprovals: 0,
        failedOperations: 0,
      },
      "/api/dashboard/subscription-summary": {
        companyName: "Browser Test Company",
        planName: null,
        planType: null,
        status: "NONE",
        trialExpiresAt: null,
        startsAt: null,
        expiresAt: null,
      },
      "/api/dashboard/recent-projects": [],
      "/api/dashboard/recent-boqs": [],
      "/api/dashboard/recent-files": [],
      "/api/dashboard/recent-documents": [],
      "/api/dashboard/recent-clients": [],
      "/api/dashboard/activity": [],
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope(dataByPath[pathname] ?? {}),
    });
  });
}

async function addSessionCookie(context: BrowserContext) {
  await context.addCookies([
    {
      name: "quantara_session",
      value: "browser-test-session-presence-only",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

function bubbleTrigger(page: Page) {
  return page.locator('button[aria-controls="help-feedback-dialog"]');
}

async function expectNoSeriousOrCriticalDialogViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .include("#help-feedback-dialog")
    .analyze();
  const blockingViolations = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);
}

test.describe("global Help & Feedback", () => {
  test("public surface has exactly one keyboard-safe bubble, verified direct contacts and safe submission", async ({ page, context }) => {
    await context.clearCookies();
    let submittedBody: Record<string, unknown> | undefined;
    await mockApplicationApis(page, async (request) => {
      submittedBody = request.postDataJSON() as Record<string, unknown>;
    });

    await page.goto("/");
    const trigger = bubbleTrigger(page);
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAccessibleName("Help & Feedback");

    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Help & Feedback" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close Help & Feedback" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Send request" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close Help & Feedback" })).toBeFocused();
    await expect(dialog.locator('a[href="mailto:solution@vistabylara.com"]')).toBeVisible();
    await expect(dialog.locator('a[href="https://wa.me/971507994292"]')).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
    await expectNoSeriousOrCriticalDialogViolations(page);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole("button", { name: /Need a new feature\?/ }).click();
    await expect(page.getByLabel("Request type")).toHaveValue("FEATURE");
    await page.getByLabel("Title", { exact: true }).fill("Revision comparison");
    await page.getByLabel("Description", { exact: true }).fill("Compare two reviewed BOQ revisions.");
    await page.getByLabel("What are you trying to achieve?").fill("Approve only changed quantities.");
    await page.getByLabel("Email", { exact: true }).fill("reviewer@example.com");
    await page.getByLabel("Company", { exact: false }).fill("Example QS");
    await page.getByLabel(/I agree that Quantara may process/).check();
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page.getByRole("status")).toContainText("Request received");
    expect(submittedBody).toBeDefined();
    expect(Object.keys(submittedBody ?? {}).sort()).toEqual([
      "company",
      "consent",
      "context",
      "description",
      "email",
      "goal",
      "kind",
      "requestType",
      "title",
      "website",
    ]);
    expect(submittedBody).toEqual({
      kind: "SUPPORT",
      requestType: "FEATURE",
      title: "Revision comparison",
      description: "Compare two reviewed BOQ revisions.",
      goal: "Approve only changed quantities.",
      email: "reviewer@example.com",
      company: "Example QS",
      consent: true,
      context: { currentRoute: "/", surface: "PUBLIC", locale: "en" },
      website: "",
    });
    expect(JSON.stringify(submittedBody)).not.toMatch(/userId|companyId|token|cookie|projectId|boqId|fileId|rateId|timestamp|submittedAt/i);
  });

  test("authenticated dashboard has exactly one SaaS bubble and uses the mocked session email", async ({ page, context }) => {
    await context.clearCookies();
    await addSessionCookie(context);
    await mockApplicationApis(page);

    await page.goto("/dashboard");
    expect(new URL(page.url()).pathname).toBe("/dashboard");
    const trigger = bubbleTrigger(page);
    await expect(trigger).toHaveCount(1);
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Help & Feedback" })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(sessionData.user.email);
  });

  test("mobile dialog remains within the viewport without page-level horizontal overflow", async ({ page, context }) => {
    await context.clearCookies();
    await mockApplicationApis(page);
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");
    await bubbleTrigger(page).click();
    const dialog = page.getByRole("dialog", { name: "Help & Feedback" });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(667);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("desktop dialog remains entirely within the viewport", async ({ page, context }) => {
    await context.clearCookies();
    await mockApplicationApis(page);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto("/");
    await bubbleTrigger(page).click();
    const dialog = page.getByRole("dialog", { name: "Help & Feedback" });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1440);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(1000);
    }
  });

  test("Arabic cookie renders the public bubble in RTL with its Arabic label", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies([
      {
        name: "quantara_locale",
        value: "ar",
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);
    await mockApplicationApis(page);

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const trigger = bubbleTrigger(page);
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAccessibleName(ar.support.label);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: ar.support.dialogTitle });
    await expect(dialog).toHaveAttribute("dir", "rtl");
    await expectNoSeriousOrCriticalDialogViolations(page);
  });
});
