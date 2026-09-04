import { expect, test, type Page } from "@playwright/test";

const USER_ID = "onboarding_first_project_e2e";
const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

function envelope(data: unknown) {
  return JSON.stringify({ ok: true, data });
}

async function mockAuthenticatedDashboard(
  page: Page,
  activeProjects: number,
  options: { existingClient?: boolean } = {},
) {
  const projectSubmissions: unknown[] = [];
  const clientSubmissions: unknown[] = [];
  const existingClient = options.existingClient ?? true;
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
        items: existingClient
          ? [{ id: CLIENT_ID, name: "Existing Test Client", companyName: null }]
          : [],
        total: existingClient ? 1 : 0,
        page: 1,
        pageSize: 20,
      };
    } else if (pathname === "/api/clients" && route.request().method() === "POST") {
      clientSubmissions.push(route.request().postDataJSON());
      data = {
        id: CLIENT_ID,
        name: "Quick Client",
        companyName: null,
        email: null,
        phone: null,
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

  return { clientSubmissions, projectSubmissions };
}

async function openHydratedNewProject(page: Page) {
  const industriesLoaded = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/industries"
    && response.request().method() === "GET",
  );

  await page.goto("/projects/new", { waitUntil: "domcontentloaded" });
  await industriesLoaded;
  await expect(page.getByRole("heading", { name: "New project workspace" })).toBeVisible();
}

test.describe("first-project onboarding route", () => {
  test.describe.configure({ mode: "serial" });
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

  test("successful project creation opens drawing intake", async ({ page }) => {
    const { projectSubmissions } = await mockAuthenticatedDashboard(page, 0);
    await openHydratedNewProject(page);

    await page.getByLabel("Project name").fill("First Value Project");
    await page.getByLabel("Project reference").fill("FIRST-VALUE-001");
    await page.getByRole("button", { name: "Select or create a client" }).click();
    await expect(page.getByRole("button", { name: "Existing Test Client" })).toBeVisible();
    await page.getByRole("button", { name: "Existing Test Client" }).click();
    await page.getByLabel("Industry engine").selectOption("fit-out");
    await page.getByLabel("Location").fill("Dubai");
    await page.getByRole("button", { name: "Create project and upload drawings" }).click();

    await expect(page).toHaveURL(/\/projects\/first-project-e2e\/drawings$/);
    expect(projectSubmissions).toEqual([
      expect.objectContaining({
        name: "First Value Project",
        reference: "FIRST-VALUE-001",
        clientId: CLIENT_ID,
        industryId: "fit-out",
      }),
    ]);
  });

  test("a zero-client user can self-serve client creation and reach drawing intake", async ({ page }) => {
    const { clientSubmissions, projectSubmissions } = await mockAuthenticatedDashboard(
      page,
      0,
      { existingClient: false },
    );
    await openHydratedNewProject(page);

    await expect(page.getByRole("dialog", { name: "Find the Right Quantara Package" })).toHaveCount(0);

    await page.getByLabel("Project name").fill("Self Service Project");
    await page.getByLabel("Project reference").fill("SELF-SERVICE-001");
    await page.getByRole("button", { name: "Select or create a client" }).click();
    await page.getByPlaceholder("Search clients...").fill("Quick Client");
    await page.getByRole("button", { name: /Create new client/ }).click();
    await expect(page.getByLabel("Client name")).toHaveValue("Quick Client");
    await page.getByLabel("Company name").fill("Quick Client LLC");
    await page.getByLabel("Email").fill("projects@quickclient.example");
    await page.getByLabel("Phone").fill("+971 50 000 0000");
    await page.getByRole("button", { name: "Create and select" }).click();
    await expect(page.getByRole("heading", { name: "Create client" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Quick Client" })).toBeVisible();
    await page.getByLabel("Industry engine").selectOption("fit-out");
    await page.getByLabel("Location").fill("Dubai");
    await page.getByRole("button", { name: "Create project and upload drawings" }).click();

    await expect(page).toHaveURL(/\/projects\/first-project-e2e\/drawings$/);
    expect(clientSubmissions).toEqual([
      expect.objectContaining({
        name: "Quick Client",
        companyName: "Quick Client LLC",
        email: "projects@quickclient.example",
        phone: "+971 50 000 0000",
      }),
    ]);
    expect(projectSubmissions).toEqual([
      expect.objectContaining({
        clientId: CLIENT_ID,
        industryId: "fit-out",
        name: "Self Service Project",
      }),
    ]);
  });
});
