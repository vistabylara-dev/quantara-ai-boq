import { test, expect } from '@playwright/test';

const PHASE_3_ROUTES = [
  '/what-is-a-boq',
  '/boq-vs-construction-estimate',
  '/boq-vs-bill-of-materials',
  '/how-to-prepare-a-boq',
  '/boq-review-checklist',
  '/common-boq-errors',
  '/boq-revision-control',
  '/how-to-convert-pdf-boq-to-excel',
  '/text-pdf-vs-scanned-pdf',
  '/ocr-for-boq-documents',
  '/how-to-review-ai-extracted-boq',
  '/quantity-takeoff-vs-boq-management',
  '/resources'
];

test.describe('Phase 3 Knowledge Base Routes Public Access', () => {
  for (const route of PHASE_3_ROUTES) {
    test(`Route ${route} should be accessible to anonymous users (HTTP 200)`, async ({ page }) => {
      const response = await page.goto(route);
      
      expect(response?.status()).toBe(200);
      
      // Ensure it did not redirect to login
      expect(page.url()).not.toContain('/login');
      
      // Ensure the dashboard shell is NOT present
      const dashboardSidebar = page.locator('aside').filter({ hasText: 'Dashboard' });
      await expect(dashboardSidebar).toHaveCount(0);
      
      // Check for the public footer to confirm it's the public shell
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
    });
  }
});
