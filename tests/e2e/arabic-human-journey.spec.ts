import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * ARABIC-RTL-LOCALIZATION — TEST 3: a focused Arabic Human Journey.
 * Deliberately NOT a duplicate of the full English
 * first-time-user-canva-boq-journey E2E — it reuses the same real fixture
 * pattern (a real premium catalogue item, a real project) and walks the
 * surfaces this pass actually localized: login → dashboard shell →
 * BOQ start wizard → add-item search → verification → documents →
 * professional preview (with the Arabic watermark). It deliberately stops
 * before the commercial unlock panel and checkout flow, since
 * src/components/commercial/** and src/app/settings/subscription/** are
 * frozen for this PR (Antigravity is finalizing BOQ_FINAL_OUTPUT) and
 * remain English pending the post-merge commercial mini-pass — asserting
 * Arabic text there would be a false claim.
 */

const prisma = new PrismaClient();
const COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_ID = "00000000-0000-4000-8000-000000000201";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let projectSlug: string;
let premiumItemCode: string;

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
}

test.describe.serial("ARABIC-RTL-LOCALIZATION — focused Arabic Human Journey", () => {
  test.beforeAll(async () => {
    const membership = await prisma.industryDataPackageItem.findFirstOrThrow({
      where: { masterItem: { isPremium: true, status: "ACTIVE" }, package: { key: "mechanical-hvac-professional" } },
      include: { masterItem: true },
    });
    premiumItemCode = membership.masterItem.itemCode;

    await prisma.client.upsert({
      where: { id: CLIENT_ID },
      update: {},
      create: { id: CLIENT_ID, companyId: COMPANY_ID, name: "Arabic Journey Test Client", email: "arabic-journey-client@example.test" },
    });
    projectSlug = `arabic-journey-${Date.now()}`;
    await prisma.project.create({
      data: {
        companyId: COMPANY_ID,
        clientId: CLIENT_ID,
        slug: projectSlug,
        reference: projectSlug,
        name: "Arabic Human Journey Test",
        industryEngineId: (await prisma.industryEngine.findFirstOrThrow({ where: { key: "construction" } })).id,
        currency: "AED",
        taxRate: 5,
      },
    });
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

  test("logs in, switches to Arabic, and completes source→BOQ→preview in Arabic UI", async ({ page, context }) => {
    test.setTimeout(150_000);
    await context.clearCookies();

    // ---- Login (still English at this point — the switcher lives inside the shell/login page itself) ----
    await login(page);

    // ---- Switch to Arabic; confirm SSR-consistent lang/dir ----
    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar", { timeout: 20_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("link", { name: "لوحة التحكم" })).toBeVisible({ timeout: 20_000 });

    // ---- BOQ start wizard, in Arabic ----
    await page.goto(`/projects/${projectSlug}/boq`);
    await expect(page.getByText("اختر كيف تريد أن تبدأ Quantara")).toBeVisible({ timeout: 40_000 });
    await page.getByRole("heading", { name: "البدء يدوياً" }).click();
    await expect(page.getByRole("heading", { name: "إضافة بند", exact: true })).toBeVisible({ timeout: 20_000 });

    // ---- Search catalogue, in Arabic — real premium item, badge in Arabic ----
    const searchTab = page.getByRole("button", { name: /البحث في الكتالوج/ });
    if (await searchTab.count() > 0) await searchTab.click();
    await page.getByPlaceholder(/ابحث في مكتبة الشركة/).fill(premiumItemCode);

    const premiumResult = page.getByRole("button", { name: new RegExp(escapeRegExp(premiumItemCode)) }).first();
    await expect(premiumResult).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("مميز", { exact: true }).first()).toBeVisible();
    await premiumResult.click();

    const useThisItemButton = page.getByRole("button", { name: "استخدام هذا البند" });
    await expect(useThisItemButton).toBeVisible({ timeout: 20_000 });
    await useThisItemButton.click();
    await expect(page.locator(`input[value="${premiumItemCode}"]`).first()).toBeVisible({ timeout: 20_000 });

    // Rate a real value (ZERO_SELLING_RATE is a real, pre-existing lock blocker independent of locale).
    const itemRow = page.getByRole("row", { name: new RegExp(escapeRegExp(premiumItemCode)) });
    await itemRow.getByRole("spinbutton").nth(1).fill("500");
    const saveDraftButton = page.getByRole("button", { name: "حفظ المسودة" });
    await saveDraftButton.click();
    await expect(saveDraftButton).toBeEnabled({ timeout: 20_000 });

    // ---- Validation page, in Arabic ----
    await page.goto(`/projects/${projectSlug}/verification`);
    const rerunButton = page.getByRole("button", { name: "إعادة تشغيل التحقق" });
    await expect(rerunButton).toBeVisible({ timeout: 30_000 });
    await rerunButton.click();
    await expect(rerunButton).toBeEnabled({ timeout: 30_000 });

    // ---- Documents → professional preview, in Arabic, with the Arabic watermark ----
    await page.goto(`/projects/${projectSlug}/documents`);
    const previewLink = page.getByRole("link", { name: "معاينة جدول الكميات الاحترافي" });
    await expect(previewLink).toBeVisible({ timeout: 20_000 });
    await previewLink.click();
    await page.waitForURL(/\/documents\/preview/, { timeout: 20_000 });

    await expect(page.getByText("الأقسام")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("البنود")).toBeVisible();
    await expect(page.getByText("الإجمالي الكلي")).toBeVisible();

    const previewFrame = page.frameLocator('iframe[title="معاينة المستند"]');
    await expect(previewFrame.getByText("معاينة QUANTARA — مسودة — افتح النسخة النهائية للتنزيل")).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole("button", { name: "تنزيل النسخة النهائية" })).toBeVisible();
  });
});
