import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicRoutes = [
  '/',
  '/features',
  '/privacy',
  '/terms',
  '/security',
  '/contact-sales',
  '/register',
];

test.describe('Public Routes Acceptance', () => {
  for (const route of publicRoutes) {
    test(`Route ${route} should load successfully and have no accessibility violations`, async ({ page }) => {
      const response = await page.goto(route);
      
      // 1. Verify HTTP Status
      expect(response?.status()).toBe(200);
      
      // 2. Verify Authentication Bypass (should not redirect to /login)
      expect(page.url()).not.toContain('/login');
      if (route !== '/') {
        expect(page.url()).toContain(route);
      }
      
      // 3. Take screenshot
      await page.screenshot({ path: `screenshots/${route === '/' ? 'home' : route.replace('/', '')}.png`, fullPage: true });
      
      // 4. Verify Accessibility
      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});

test.describe('Contact Form Acceptance', () => {
  test('Should submit successfully and not touch Prisma', async ({ page, request }) => {
    // Intercept the API call to ensure it's made and check response
    await page.route('/api/contact', async route => {
      const request = route.request();
      expect(request.method()).toBe('POST');
      
      // Mock the response so we don't actually send emails or hit DB if there was one
      // Wait, the API already just returns success without Prisma. 
      // The requirement says: "The Playwright contact-form test must never create an uncontrolled record in the production database."
      // Since we know `/api/contact` doesn't use Prisma currently, we can let it pass, or mock it to be 100% safe.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.goto('/contact-sales');
    await page.getByRole('textbox', { name: 'First Name' }).fill('Integration');
    await page.getByRole('textbox', { name: 'Last Name' }).fill('Test');
    await page.getByRole('textbox', { name: 'Work Email' }).fill('test@example.com');
    await page.getByRole('textbox', { name: 'Construction Discipline' }).fill('Civil');
    await page.getByRole('textbox', { name: 'Current BOQ Process' }).fill('Excel');
    
    // Check consent checkbox
    await page.getByRole('checkbox', { name: /consent/i }).check();
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Thank you.')).toBeVisible();
    await page.screenshot({ path: 'screenshots/contact-sales-success.png' });
  });
});
