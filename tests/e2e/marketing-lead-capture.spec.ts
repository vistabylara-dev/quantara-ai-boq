import { expect, test, type Page, type Request } from "@playwright/test";

const LEAD_CAPTURE_SUBMITTED_KEY = "quantara:marketing-lead-submitted:v1";
const LEAD_CAPTURE_DISMISSAL_KEY = "quantara:marketing-lead-dismissed:v1";
const DASHBOARD_LEAD_SESSION_KEY = "quantara:marketing-lead-dashboard-session:v1";
const LEAD_CAPTURE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_OPEN_DELAY_MS = 15_000;

const anonymousSession = { authenticated: false } as const;
const authenticatedSession = {
  authenticated: true,
  user: {
    id: "user_lead_capture_e2e",
    companyId: "company_lead_capture_e2e",
    role: "COMPANY_OWNER",
    fullName: "Aisha Al Mansoori",
    email: "aisha@example.com",
    platformRole: null,
    customerPreviewActive: false,
  },
} as const;

function envelope(data: unknown) {
  return JSON.stringify({ ok: true, data });
}

function errorEnvelope(message: string) {
  return JSON.stringify({
    ok: false,
    error: { code: "E2E_API_NOT_REQUIRED", message },
  });
}

function dashboardApiFixture(pathname: string): unknown | undefined {
  if (pathname === "/api/dashboard/metrics") {
    return {
      activeProjects: 0,
      totalClients: 0,
      totalBoqs: 0,
      totalUploadedFiles: 0,
      totalGeneratedDocuments: 0,
      catalogueItems: 0,
      pendingApprovals: 0,
      failedOperations: 0,
    };
  }
  if (pathname === "/api/dashboard/subscription-summary") {
    return {
      companyName: "Example Contracting",
      planName: null,
      planType: null,
      status: "NONE",
      trialExpiresAt: null,
      startsAt: null,
      expiresAt: null,
    };
  }
  if (
    pathname === "/api/dashboard/recent-projects"
    || pathname === "/api/dashboard/recent-boqs"
    || pathname === "/api/dashboard/recent-files"
    || pathname === "/api/dashboard/recent-documents"
    || pathname === "/api/dashboard/recent-clients"
    || pathname === "/api/dashboard/activity"
    || pathname === "/api/projects"
    || pathname === "/api/data-packages"
    || pathname === "/api/commerce/products"
  ) {
    return [];
  }
  if (pathname === "/api/commerce/checkout-options") return { products: [] };
  if (pathname === "/api/admin/simulation") return { simulation: null };
  return undefined;
}

async function mockLeadApis(
  page: Page,
  session: unknown,
  capture?: (request: Request) => Promise<void>,
) {
  let sessionRequestCount = 0;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/marketing/leads" && request.method() === "POST") {
      await capture?.(request);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: envelope({ received: true }),
      });
      return;
    }

    if (pathname === "/api/auth/session") {
      sessionRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope(session),
      });
      return;
    }

    const fixture = dashboardApiFixture(pathname);
    if (fixture !== undefined) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope(fixture),
      });
      return;
    }

    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: errorEnvelope(`No fixture is required for ${pathname}.`),
    });
  });

  return {
    sessionRequestCount: () => sessionRequestCount,
  };
}

function leadDialog(page: Page) {
  return page.getByRole("dialog", { name: "Find the Right Quantara Package" });
}

async function scrollToRatio(page: Page, ratio: number) {
  return page.evaluate((targetRatio) => {
    const scrollableDistance = Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      0,
    );
    const target = targetRatio < 0.35
      ? Math.floor(scrollableDistance * targetRatio)
      : Math.ceil(scrollableDistance * targetRatio);
    window.scrollTo(0, target);
    window.dispatchEvent(new Event("scroll"));
    return scrollableDistance;
  }, ratio);
}

async function triggerByMeaningfulScroll(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(250);
  const scrollableDistance = await scrollToRatio(page, 1);
  expect(scrollableDistance).toBeGreaterThan(0);
  await expect(leadDialog(page)).toBeVisible();
}

async function expectPopupSuppressedAfterReload(page: Page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await page.waitForTimeout(250);
  await scrollToRatio(page, 1);
  await page.waitForTimeout(250);
  await expect(leadDialog(page)).toHaveCount(0);
}

async function addAuthenticatedCookie(page: Page) {
  await page.context().addCookies([
    {
      name: "quantara_session",
      value: "e2e-session-presence-only",
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function markOnboardingWelcomeSeen(page: Page) {
  await page.addInitScript((userId) => {
    window.localStorage.setItem(
      `quantara:onboarding:v1:${userId}`,
      JSON.stringify({
        version: 1,
        welcomeSeen: true,
        tourActive: false,
        tourReplay: false,
        completedActions: {
          PROJECT_CREATED: false,
          SOURCE_ADDED: false,
          SOURCE_PROCESSED: false,
          EXTRACTION_REVIEWED: false,
          BOQ_PREPARED: false,
          VALIDATION_COMPLETED: false,
          OUTPUT_GENERATED: false,
        },
        lastProjectId: null,
        updatedAt: "2026-08-23T00:00:00.000Z",
      }),
    );
  }, authenticatedSession.user.id);
}

test.describe("marketing lead capture", () => {
  test.setTimeout(60_000);

  test("homepage popup is not immediate and opens at 15 seconds", async ({ page }) => {
    await page.clock.install();
    await mockLeadApis(page, anonymousSession);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible();
    await page.waitForLoadState("load");
    await page.waitForTimeout(250);
    await expect(leadDialog(page)).toHaveCount(0);

    await page.clock.fastForward(AUTO_OPEN_DELAY_MS - 5_000);
    await expect(leadDialog(page)).toHaveCount(0);

    await page.clock.fastForward(5_000);
    await expect(leadDialog(page)).toBeVisible();
  });

  test("homepage popup opens only at or above the meaningful 35 percent scroll threshold", async ({ page }) => {
    await mockLeadApis(page, anonymousSession);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible();
    await page.waitForLoadState("load");
    await page.waitForTimeout(250);

    const scrollableDistance = await scrollToRatio(page, 0.349);
    expect(scrollableDistance).toBeGreaterThan(0);
    await page.waitForTimeout(150);
    await expect(leadDialog(page)).toHaveCount(0);

    await scrollToRatio(page, 0.351);
    await expect(leadDialog(page)).toBeVisible();
  });

  test("public submission captures package and UTM context and permanently suppresses the popup", async ({ page }) => {
    let submittedBody: Record<string, unknown> | undefined;
    await mockLeadApis(
      page,
      authenticatedSession,
      async (request) => {
        submittedBody = request.postDataJSON() as Record<string, unknown>;
      },
    );

    await page.goto("/pricing?utm_source=google&utm_medium=cpc&utm_campaign=dubai-boq");
    const professionalCard = page.locator(
      '[data-lead-package-interest="Quantara Professional"]',
    );
    await expect(professionalCard).toBeVisible();
    await professionalCard.click({ position: { x: 8, y: 8 } });
    await triggerByMeaningfulScroll(page);

    const dialog = leadDialog(page);
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel(/^Full Name/)).toHaveValue("Aisha Al Mansoori");
    await expect(page.getByLabel(/^Business Email/)).toHaveValue("aisha@example.com");
    await expect(dialog).toContainText("Package interest: Quantara Professional");

    await page.getByLabel(/^WhatsApp \/ Mobile/).fill("+971 50 123 4567");
    await page.getByLabel("Company", { exact: true }).fill("Example Contracting");
    await page.getByLabel(/^Industry/).fill("Construction & Contracting");
    await page.getByLabel(/I agree to receive Quantara product updates/).check();
    await page.getByRole("button", { name: "Get My Quantara Options" }).click();

    await expect(page.getByRole("status")).toHaveText("Thank you. Your request has been received.");
    await expect(page.getByText("Thank you. Your request has been received.")).toBeFocused();
    expect(submittedBody).toEqual({
      fullName: "Aisha Al Mansoori",
      email: "aisha@example.com",
      mobile: "+971 50 123 4567",
      company: "Example Contracting",
      industry: "Construction & Contracting",
      packageInterest: "Quantara Professional",
      page: "/pricing",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "dubai-boq",
      marketingConsent: true,
      website: "",
    });
    expect(JSON.stringify(submittedBody)).not.toMatch(/userId|submittedAt|privateKey|spreadsheetId/);

    const storedState = await page.evaluate(
      ({ submittedKey, dismissalKey }) => ({
        submitted: window.localStorage.getItem(submittedKey),
        dismissal: window.localStorage.getItem(dismissalKey),
      }),
      {
        submittedKey: LEAD_CAPTURE_SUBMITTED_KEY,
        dismissalKey: LEAD_CAPTURE_DISMISSAL_KEY,
      },
    );
    expect(storedState).toEqual({ submitted: "submitted", dismissal: null });

    const futureNow = Date.now() + LEAD_CAPTURE_TTL_MS + 1;
    await page.addInitScript((timestamp) => {
      Date.now = () => timestamp;
    }, futureNow);
    await expectPopupSuppressedAfterReload(page);
    expect(await page.evaluate((key) => window.localStorage.getItem(key), LEAD_CAPTURE_SUBMITTED_KEY))
      .toBe("submitted");
  });

  test("dismissal suppresses for seven days and the homepage can reopen after expiry", async ({ page }) => {
    await mockLeadApis(page, anonymousSession);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await triggerByMeaningfulScroll(page);
    await page.getByRole("button", { name: "Close lead form" }).click();
    await expect(leadDialog(page)).toHaveCount(0);
    await expect(page.locator("#main-content")).toBeVisible();

    const dismissal = await page.evaluate((key) => window.localStorage.getItem(key), LEAD_CAPTURE_DISMISSAL_KEY);
    expect(dismissal).not.toBeNull();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), LEAD_CAPTURE_SUBMITTED_KEY))
      .toBeNull();

    await expectPopupSuppressedAfterReload(page);

    await page.evaluate(
      ({ key, ttl }) => {
        window.localStorage.setItem(key, JSON.stringify({ capturedAt: Date.now() - ttl - 1 }));
      },
      { key: LEAD_CAPTURE_DISMISSAL_KEY, ttl: LEAD_CAPTURE_TTL_MS },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await triggerByMeaningfulScroll(page);
    await expect(leadDialog(page)).toBeVisible();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), LEAD_CAPTURE_DISMISSAL_KEY))
      .toBeNull();
  });

  test("dashboard is direct, prefilled, once per session, and marketplace never triggers it", async ({ page }) => {
    await page.clock.install();
    await addAuthenticatedCookie(page);
    await markOnboardingWelcomeSeen(page);
    const api = await mockLeadApis(page, authenticatedSession);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect.poll(api.sessionRequestCount).toBeGreaterThanOrEqual(5);
    await page.waitForTimeout(250);
    await page.clock.fastForward(AUTO_OPEN_DELAY_MS);

    await expect(leadDialog(page)).toBeVisible();
    await expect(page.getByLabel(/^Full Name/)).toHaveValue("Aisha Al Mansoori");
    await expect(page.getByLabel(/^Business Email/)).toHaveValue("aisha@example.com");
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), DASHBOARD_LEAD_SESSION_KEY))
      .toBe("shown");

    await page.getByRole("button", { name: "Close lead form" }).click();
    await page.goto("/projects", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(100);
    await page.clock.fastForward(AUTO_OPEN_DELAY_MS + 1);
    await expect(leadDialog(page)).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(100);
    await page.clock.fastForward(AUTO_OPEN_DELAY_MS + 1);
    await expect(leadDialog(page)).toHaveCount(0);

    await page.evaluate((key) => window.sessionStorage.removeItem(key), DASHBOARD_LEAD_SESSION_KEY);
    await page.goto("/marketplace", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(100);
    await page.clock.fastForward(AUTO_OPEN_DELAY_MS * 2);
    await scrollToRatio(page, 1);
    await expect(leadDialog(page)).toHaveCount(0);
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), DASHBOARD_LEAD_SESSION_KEY))
      .toBeNull();

    const sessionRequestsBeforeDashboardReturn = api.sessionRequestCount();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect.poll(api.sessionRequestCount).toBeGreaterThan(sessionRequestsBeforeDashboardReturn);
    await page.waitForTimeout(250);
    await page.clock.fastForward(AUTO_OPEN_DELAY_MS);
    await expect(leadDialog(page)).toBeVisible();
    await expect(page.getByLabel(/^Full Name/)).toHaveValue("Aisha Al Mansoori");
    await expect(page.getByLabel(/^Business Email/)).toHaveValue("aisha@example.com");
  });
});
