import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../../src/lib/db/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

/**
 * Focused authenticated Arabic coverage for the delta translated in this
 * pass: BOQ editor/grid and Proposals/Reports. Companion to
 * saas-arabic-coverage.spec.ts (dashboard/catalogue/settings/integrations/
 * industry-engines), which this file intentionally does not re-touch.
 */

const PASSWORD = "Password123!";

async function loginAndSwitchToArabic(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").waitFor({ state: "visible", timeout: 60_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  // See saas-arabic-coverage.spec.ts for why the dashboard heading (not
  // <html lang>/<html dir>) is the reliable "the switch has landed" signal.
  await expect(page.getByRole("heading", { name: "مساحة العمل" })).toBeVisible({ timeout: 20_000 });
}

test.describe("SAAS-ARABIC-AUTHENTICATED-FINAL", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(150_000);

  let companyId: string;
  let userId: string;
  let userEmail: string;
  let projectSlug: string;

  test.beforeAll(async () => {
    companyId = randomUUID();
    userId = randomUUID();
    userEmail = `arabic-final-${userId}@quantara.local`;

    await prisma.company.create({
      data: {
        id: companyId,
        legalName: "Arabic Final Coverage Company",
        tradeName: "Arabic Final Coverage Company",
        email: "arabic-final-coverage@example.com",
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: "Arabic Final Coverage User",
        companyId,
        role: UserRole.COMPANY_OWNER,
        emailVerifiedAt: new Date(),
      },
    });

    const client = await prisma.client.create({ data: { companyId, name: "Arabic Final Coverage Client" } });
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

    projectSlug = `arabic-final-project-${Date.now()}`;
    const projectId = randomUUID();
    await prisma.project.create({
      data: {
        id: projectId,
        name: "Arabic Final Project",
        companyId,
        reference: "AR-FINAL-1",
        slug: projectSlug,
        clientId: client.id,
        industryEngineId: industry.id,
      },
    });

    // A draft BOQ with one section/item so the BOQ page renders the editor
    // grid directly rather than the empty-state start wizard.
    const boq = await prisma.bOQ.create({
      data: { companyId, projectId, title: "Arabic Final BOQ" },
    });
    const section = await prisma.bOQSection.create({
      data: { companyId, boqId: boq.id, code: "A", title: "General", sortOrder: 1 },
    });
    await prisma.bOQItem.create({
      data: {
        companyId,
        sectionId: section.id,
        itemNumber: 1,
        itemCode: "ITM-001",
        category: "General",
        description: "Test Item",
        quantity: 1,
        unit: "nr",
        unitCost: 100,
        sellingRate: 100,
        totalAmount: 100,
        sortOrder: 1,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  test("BOQ editor/grid renders Arabic UI text", async ({ page, context }) => {
    await context.clearCookies();
    await loginAndSwitchToArabic(page, userEmail);
    await page.goto(`/projects/${projectSlug}/boq`);

    // First-ever hit to this dynamic route in a fresh dev build can take
    // well over a minute to compile (this page pulls in BoqEditor,
    // AddItemFromSourceModal, the catalogue drawer, and the workflow
    // stepper) — generous timeout to avoid flaking on cold compile.
    await expect(page.getByText("استوديو جدول الكميات")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("columnheader", { name: "الوصف" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "الكمية" })).toBeVisible();
    await expect(page.getByText("سجل الإصدارات")).toBeVisible();
    await expect(
      page
        .locator("#boq-editor-section")
        .getByRole("button", { name: "قفل الإصدار", exact: true }),
    ).toBeVisible();

    // No horizontal overflow on the RTL grid surface.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("Proposals list and creation wizard render Arabic UI text", async ({ page, context }) => {
    await context.clearCookies();
    await loginAndSwitchToArabic(page, userEmail);
    await page.goto(`/projects/${projectSlug}/proposals`);

    await expect(page.getByText("عروض العميل")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "إنشاء عرض للعميل" })).toBeVisible();

    await page.getByRole("button", { name: "إنشاء عرض للعميل" }).click();
    await expect(page.getByRole("heading", { name: "إنشاء عرض للعميل" })).toBeVisible();
    await expect(page.getByText("إنشاء عرض جدول كميات")).toBeVisible();
    await expect(page.getByText("إنشاء عرض تقرير فني")).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("Technical reports list renders Arabic UI text", async ({ page, context }) => {
    await context.clearCookies();
    await loginAndSwitchToArabic(page, userEmail);
    await page.goto(`/projects/${projectSlug}/technical-reports`);

    await expect(page.getByText("التقارير الفنية", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("تقرير جديد")).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
