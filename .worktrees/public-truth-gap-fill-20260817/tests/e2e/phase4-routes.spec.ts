import { test, expect } from '@playwright/test';

const phase4Routes = [
  '/industries',
  '/boq-software-for-contractors',
  '/boq-software-for-quantity-surveyors',
  '/boq-software-for-mep-contractors',
  '/boq-software-for-hvac-contractors',
  '/boq-software-for-fit-out-companies',
  '/boq-software-for-fire-fighting-contractors',
  '/boq-software-for-facilities-management',
  '/boq-software-for-engineering-consultants'
];

test.describe('Phase 4 Industry Routes Public Access', () => {
  for (const route of phase4Routes) {
    test(`Route ${route} should be accessible to anonymous users (HTTP 200)`, async ({ page }) => {
      const response = await page.goto(route);
      
      expect(response?.status()).toBe(200);
      
      // Ensure it did not redirect to login
      expect(page.url()).not.toContain('/login');
      
      // Verify the main content area exists
      const main = page.locator('main');
      await expect(main.first()).toBeVisible();
      
      // Verify no dashboard sidebar or authenticated shell elements
      const sidebarExists = await page.locator('nav[aria-label="Sidebar"]').count();
      expect(sidebarExists).toBe(0);

      // Verify the footer is present
      const footerExists = await page.locator('footer').count();
      expect(footerExists).toBeGreaterThan(0);
    });
  }
});
