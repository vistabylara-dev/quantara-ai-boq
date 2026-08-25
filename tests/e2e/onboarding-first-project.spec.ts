import { expect, test, type Page } from "@playwright/test";

const USER_ID = "onboarding_first_project_e2e";

function envelope(data: unknown) {
  return JSON.stringify({ ok: true, data });
}

async function mockAuthenticatedDashboard(page: Page, activeProjects: number) {
  await page.context().addCookies([
    {
      name: "quantara_session",
      value: "e2e-session-presence-only",
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = [];

    if (pathname === "/api/auth/session") {
      data = {
        authenticated: true,
        user: {
          id: USER_ID,
          companyId: "onboarding_company_e2e",
          role: "COMPANY_OWNER",
          fullName: "Onboarding Test User",
          email: "onboarding@example.com",
          platformRole: null,
          customerPreviewActive: false,
        },
      };
    } else if (pathname === "/api/dashboard/metrics") {
      data = {
        activeProjects,
        totalClients: 0,
        totalBoqs: activeProjects,
        totalUploadedFiles: 0,
        totalGeneratedDocuments: 0,
        catalogueItems: 0,
        pendingApprovals: 0,
        failedOperations: 0,
      };
    } else if (pathname === "/api/dashboard/subscription-summary") {
      data = {
        companyName: "Onboarding Test Company",
        planName: null,
        planType: null,
        status: "NONE",
        trialExpiresAt: null,
        startsAt: null,
        expiresAt: null,
      };
    } else if (pathname === "/api/commerce/checkout-options") {
      data = { products: [] };
    } else if (pathname === "/api/admin/simulation") {
      data = { simulation: null };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope(data),
    });
  });
}

test.describe("first-project onboarding route", () => {
  test("Start guided tour takes a zero-project user directly to New Project", async ({ page }) => {
    await mockAuthenticatedDashboard(page, 0);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const welcome = page.getByRole("dialog", { name: "Welcome to Quantara" });
    await expect(welcome).toBeVisible();
    await welcome.getByRole("button", { name: "Start guided tour" }).click();

    await expect(page).toHaveURL(/\/projects\/new$/);
    await expect(page.getByRole("heading", { name: "New project workspace" })).toBeVisible();
  });

  test("an established user is not interrupted or redirected", async ({ page }) => {
    await mockAuthenticatedDashboard(page, 1);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("dialog", { name: "Welcome to Quantara" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
