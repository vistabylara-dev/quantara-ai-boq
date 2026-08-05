import { test, expect } from '@playwright/test';

const PHASE5_ROUTES = [
  '/gcc-boq-software',
  '/boq-software-uae',
  '/boq-software-dubai',
  '/boq-software-abu-dhabi',
  '/construction-estimating-software-uae',
  '/mep-estimating-software-uae',
  '/boq-software-saudi-arabia',
  '/boq-software-qatar',
  '/boq-software-oman'
];

test.describe('Phase 5 Regional Location Routes Anonymous Access', () => {
  for (const route of PHASE5_ROUTES) {
    test(`Anonymous user can access ${route} directly without redirect`, async ({ page }) => {
      const response = await page.goto(route);
      
      expect(response?.status()).toBe(200);
      expect(page.url()).toContain(route);
      
      // Ensure we haven't been redirected to /login
      expect(page.url()).not.toContain('/login');
      
      // Ensure the AppShell layout (Dashboard) is NOT rendered
      await expect(page.locator('aside')).toHaveCount(0);
      
      // Look for the specific H1 header that every page should have
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      
      // Ensure the professional disclaimer is visible somewhere on the page
      const disclaimer = page.getByText(/Quantara assists with supported document extraction/);
      await expect(disclaimer.first()).toBeVisible();
    });
  }
});
