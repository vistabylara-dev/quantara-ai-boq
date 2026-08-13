import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../../src/lib/db/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { SESSION_COOKIE_NAME } from "../../src/lib/auth/session-cookie-name";
import { LOCALE_COOKIE_NAME } from "../../src/lib/i18n/config";

/**
 * Engineer reusable-item workflow (feature/engineer-my-library), focused
 * Playwright journey: manual BOQ item -> "Save for future projects" ->
 * My Items -> reuse in a second project's BOQ. Business-logic coverage
 * (duplicate-safety, tenant isolation, independence of the reused copy)
 * lives in tests/engineer-my-library.test.ts — this file proves the same
 * journey actually works end-to-end through the real UI, plus that the new
 * UI text renders correctly in Arabic/RTL.
 */

const PASSWORD = "Password123!";

async function authenticate(page: Page, email: string, locale: "en" | "ar" = "en") {
  const loginResponse = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(loginResponse.status(), "login API response").toBe(200);
  const sessionCookie = (await page.context().cookies()).find((cookie) => cookie.name === SESSION_COOKIE_NAME);
  expect(sessionCookie, "login response must install the session cookie").toBeDefined();
  if (locale === "ar") {
    await page.context().addCookies([
      { name: LOCALE_COOKIE_NAME, value: "ar", url: "http://localhost:3000", sameSite: "Lax" },
    ]);
  }
}

test.describe("ENGINEER-MY-LIBRARY-REUSE-JOURNEY", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let companyId: string;
  let userId: string;
  let userEmail: string;
  let projectASlug: string;
  let projectBSlug: string;

  test.beforeAll(async () => {
    companyId = randomUUID();
    userId = randomUUID();
    userEmail = `engineer-lib-e2e-${userId}@quantara.local`;

    await prisma.company.create({
      data: {
        id: companyId,
        legalName: "Engineer Library E2E Company",
        tradeName: "Engineer Library E2E Company",
        email: "engineer-lib-e2e@example.com",
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: "Engineer Library E2E User",
        companyId,
        role: UserRole.COMPANY_OWNER,
        emailVerifiedAt: new Date(),
      },
    });

    const client = await prisma.client.create({ data: { companyId, name: "Engineer Library E2E Client" } });
    const industry = await prisma.industryEngine.upsert({
      where: { key: "construction" },
      update: {},
      create: { name: "Construction", key: "construction", description: "Construction", configJson: {} },
    });
    await prisma.companyIndustryEngine.upsert({
      where: { companyId_industryEngineId: { companyId, industryEngineId: industry.id } },
      update: { enabled: true },
      create: { companyId, industryEngineId: industry.id, enabled: true },
    });

    // Two projects, seeded directly (bypassing the free-plan project-limit
    // gate that only applies to the create-project service path) — this
    // spec is about the reuse workflow, not entitlement limits.
    projectASlug = `engineer-lib-a-${Date.now()}`;
    const projectAId = randomUUID();
    await prisma.project.create({
      data: { id: projectAId, name: "Engineer Library Project A", companyId, reference: "ENGLIB-E2E-A", slug: projectASlug, clientId: client.id, industryEngineId: industry.id },
    });
    const boqA = await prisma.bOQ.create({ data: { companyId, projectId: projectAId, title: "Engineer Library BOQ A" } });
    await prisma.bOQSection.create({ data: { companyId, boqId: boqA.id, code: "A", title: "General", sortOrder: 1 } });

    projectBSlug = `engineer-lib-b-${Date.now()}`;
    const projectBId = randomUUID();
    await prisma.project.create({
      data: { id: projectBId, name: "Engineer Library Project B", companyId, reference: "ENGLIB-E2E-B", slug: projectBSlug, clientId: client.id, industryEngineId: industry.id },
    });
    const boqB = await prisma.bOQ.create({ data: { companyId, projectId: projectBId, title: "Engineer Library BOQ B" } });
    await prisma.bOQSection.create({ data: { companyId, boqId: boqB.id, code: "A", title: "General", sortOrder: 1 } });
  });

  test.afterAll(async () => {
    await prisma.companyItemUsage.deleteMany({ where: { companyId } });
    await prisma.companyLibraryItem.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  test("manual BOQ item -> save for future projects -> second project -> My Items -> reuse", async ({ page, context }) => {
    await context.clearCookies();
    await authenticate(page, userEmail);

    // 1. Create a manual BOQ item in Project A.
    await page.goto(`/projects/${projectASlug}/boq`);
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await page.getByRole("button", { name: "Enter Manually" }).click();
    await page.getByPlaceholder("Item code").fill("ENGLIB-E2E-1");
    await page.getByPlaceholder("Category").fill("Testing");
    await page.getByPlaceholder("Description").fill("Reusable Engineer Item");
    await page.getByPlaceholder("Specification").fill("Engineer specification text");
    await page.getByPlaceholder("Unit", { exact: true }).fill("m2");
    await page.getByPlaceholder("Unit cost").fill("100");
    await page.getByRole("button", { name: "Add to BOQ" }).click();

    // Modal closes and the new item renders as a real, persisted grid row.
    await expect(page.locator('input[value="ENGLIB-E2E-1"]')).toBeVisible({ timeout: 20_000 });

    // 2. Save it for future projects, from that item's row.
    const itemRow = page.locator("tr", { has: page.locator('input[value="ENGLIB-E2E-1"]') });
    await itemRow.getByRole("button", { name: "Save for future projects" }).click();
    await expect(page.getByText(/Saved "Reusable Engineer Item" to your Company Library/)).toBeVisible({ timeout: 20_000 });

    // 3. Open Company Library -> My Items and find it. First-ever hit to
    // this route in a fresh dev build can take well over 20s to compile.
    await page.goto("/company-library");
    await expect(page.getByRole("button", { name: "My Items" })).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: "My Items" }).click();
    const libraryRow = page.locator("tr", { hasText: "ENGLIB-E2E-1" });
    await expect(libraryRow).toBeVisible({ timeout: 30_000 });

    // Confirm the saved copy carries the right (name -> description-field,
    // specification -> library-description) mapping and open its detail page.
    await libraryRow.getByRole("link", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: "Reusable Engineer Item" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("textbox").filter({ hasText: "Engineer specification text" })).toBeVisible();

    // 4. Open a second project and reuse the saved item into its BOQ via search.
    await page.goto(`/projects/${projectBSlug}/boq`);
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await page.getByPlaceholder(/Search company library/).fill("ENGLIB-E2E-1");
    await expect(page.getByText("Reusable Engineer Item").first()).toBeVisible({ timeout: 20_000 });
    await page.getByText("Reusable Engineer Item").first().click();
    await page.getByRole("button", { name: "Add to BOQ" }).click();

    // The reused item now exists, independently, in Project B's BOQ.
    await expect(page.locator('input[value="ENGLIB-E2E-1"]')).toBeVisible({ timeout: 20_000 });

    // 5. Editing the reused copy in Project B must never touch the saved library original.
    const reusedDescriptionInput = page.locator('input[value="Reusable Engineer Item"]');
    await reusedDescriptionInput.fill("Edited only in Project B");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled({ timeout: 20_000 });

    await page.goto("/company-library");
    await page.getByRole("button", { name: "My Items" }).click();
    const libraryRowAfter = page.locator("tr", { hasText: "ENGLIB-E2E-1" });
    await expect(libraryRowAfter.getByText("Reusable Engineer Item")).toBeVisible({ timeout: 20_000 });
  });

  test("new engineer-library UI (save action, My Items tab) renders in Arabic", async ({ page, context }) => {
    await context.clearCookies();
    await authenticate(page, userEmail, "ar");

    await page.goto(`/projects/${projectASlug}/boq`);
    await expect(page.getByRole("button", { name: "حفظ للمشاريع المستقبلية" }).first()).toBeVisible({ timeout: 90_000 });

    await page.goto("/company-library");
    await expect(page.getByRole("button", { name: "بنودي" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "بنود الشركة" })).toBeVisible();
    await expect(page.getByRole("button", { name: "المشاريع السابقة" })).toBeVisible();
    await expect(page.getByRole("button", { name: "المفضلة" })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
