import { expect, test, type Page } from "@playwright/test";

const USER_ID = "onboarding_first_project_e2e";
const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

function envelope(data: unknown) {
  return JSON.stringify({ ok: true, data });
}

async function mockAuthenticatedDashboard(page: Page, activeProjects: number) {
  const projectSubmissions: unknown[] = [];
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
    } else if (pathname === "/api/industries") {
      data = [{ id: "industry-e2e", key: "fit-out", name: "Fit-out", enabled: true }];
    } else if (pathname === "/api/clients" && route.request().method() === "GET") {
      data = {
        items: [{ id: CLIENT_ID, name: "Existing Test Client", companyName: null }],
        total: 1,
        page: 1,
        pageSize: 20,
      };
    } else if (pathname === "/api/projects" && route.request().method() === "POST") {
      projectSubmissions.push(route.request().postDataJSON());
      data = {
        project: { id: "first-project-e2e" },
        boq: { id: "first-boq-e2e" },
      };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope(data),
    });
  });

  return projectSubmissions;
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

  test("successful project creation opens its automatically created BOQ", async ({ page }) => {
    const submissions = await mockAuthenticatedDashboard(page, 0);
    await page.goto("/projects/new", { waitUntil: "domcontentloaded" });

    await page.getByLabel("Project name").fill("First Value Project");
    await page.getByLabel("Project reference").fill("FIRST-VALUE-001");
    const clientsLoaded = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/clients"
      && response.request().method() === "GET",
    );
    await page.getByRole("button", { name: "Select or create a client" }).click();
    await clientsLoaded;
    await page.getByRole("button", { name: "Existing Test Client" }).click();
    await page.getByLabel("Industry engine").selectOption("fit-out");
    await page.getByLabel("Location").fill("Dubai");
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(/\/projects\/first-project-e2e\/boq$/);
    expect(submissions).toEqual([
      expect.objectContaining({
        name: "First Value Project",
        reference: "FIRST-VALUE-001",
        clientId: CLIENT_ID,
        industryId: "fit-out",
      }),
    ]);
  });
});
