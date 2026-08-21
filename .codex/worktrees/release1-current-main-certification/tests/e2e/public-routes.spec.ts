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
  
  test('Contact Sales page should submit successfully', async ({ page }) => {
    await page.goto('/contact-sales');
    
    await page.fill('label:has-text("First Name") + input', 'John');
    await page.fill('label:has-text("Last Name") + input', 'Doe');
    await page.fill('label:has-text("Work Email") + input', 'test@example.com');
    
    await page.click('button:has-text("Talk to an Expert")');
    
    await expect(page.locator('text=Thank you.')).toBeVisible();
    await expect(page.locator('text=Your request has been received.')).toBeVisible();
  });
});
