import { test, expect } from '@playwright/test';

const publicRoutes = [
  { path: '/', title: 'Quantara' },
  { path: '/features', title: 'Features | Quantara' },
  { path: '/security', title: 'Security' },
  { path: '/contact-sales', title: 'Quantara' }, // or whatever the title defaults to if we didn't set it
  { path: '/privacy', title: 'Quantara' },
  { path: '/terms', title: 'Quantara' },
  { path: '/data-processing', title: 'Quantara' },
  { path: '/cookie-policy', title: 'Quantara' },
  { path: '/acceptable-use', title: 'Quantara' },
  { path: '/subprocessors', title: 'Quantara' },
];

test.describe('Anonymous Public Routes', () => {
  for (const route of publicRoutes) {
    test(`Route ${route.path} should return HTTP 200 and not redirect`, async ({ page }) => {
      const response = await page.goto(route.path);
      
      expect(response).not.toBeNull();
      // Ensure HTTP 200 OK
      expect(response?.status()).toBe(200);
      
      // Ensure no redirect (Playwright handles redirects transparently but the final URL should match)
      // wait for load state
      await page.waitForLoadState('networkidle');
      const url = new URL(page.url());
      expect(url.pathname).toBe(route.path);
    });
  }
  
  test('Contact Sales page exposes the current requirements form without a fake purchase CTA', async ({ page }) => {
    await page.goto('/contact-sales');

    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Business email')).toBeVisible();
    await expect(page.getByLabel('Company name')).toBeVisible();
    await expect(page.getByLabel('Privacy consent')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Talk to an Expert' })).toBeVisible();
    await expect(page.getByRole('button', { name: /buy|subscribe|checkout/i })).toHaveCount(0);
  });
});
