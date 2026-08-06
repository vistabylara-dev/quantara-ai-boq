import { test, expect } from '@playwright/test';

const ROUTES = [
  '/comparisons',
  '/quantara-vs-excel-for-boq',
  '/boq-software-vs-spreadsheets',
  '/ai-boq-vs-manual-boq-preparation',
  '/ocr-vs-structured-boq-extraction',
  '/quantity-takeoff-vs-boq-software',
  '/boq-software-vs-document-management',
  '/construction-estimating-software-vs-excel',
  '/when-to-use-boq-software'
];

test.describe('Phase 6 Comparison Routes Anonymous Access', () => {
  for (const route of ROUTES) {
    test(`Anonymous user can access ${route} directly without redirect`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);

      // Verify we are not redirected to login
      await expect(page).toHaveURL(new RegExp(`${route}$`));

      // Ensure the dashboard sidebar does NOT render (no app-shell specific elements if possible, or just verify public layout)
      // We can verify a known public footer element is visible
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();

      // Look for the main element
      const main = page.locator('main');
      await expect(main.first()).toBeVisible();
    });
  }
});
