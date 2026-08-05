import { test, expect } from '@playwright/test';

const seoRoutes = [
  { path: '/ai-boq-software', h1: 'AI BOQ Software for Structured, Human-Reviewed Project Workflows' },
  { path: '/boq-software', h1: 'BOQ Software for Controlled Construction and Estimating Workflows' },
  { path: '/construction-estimating-software', h1: 'Construction Estimating Software Built Around Structured BOQ Workflows' },
  { path: '/boq-management', h1: 'BOQ Management for Controlled Project Records and Revisions' },
  { path: '/pdf-boq-extraction', h1: 'AI-Assisted PDF BOQ Extraction with Structured Human Review' },
  { path: '/scanned-pdf-boq', h1: 'Scanned PDF BOQ Processing with OCR-Assisted Review' },
  { path: '/quantity-surveying-software', h1: 'Quantity Surveying Software for Structured BOQ Review and Project Control' },
  { path: '/boq-document-generation', h1: 'BOQ Document Generation from Structured, Reviewed Project Data' }
];

test.describe('Anonymous SEO Pillar Routes', () => {
  for (const route of seoRoutes) {
    test(`Route ${route.path} meets all public-access and SEO criteria`, async ({ page }) => {
      const response = await page.goto(route.path);
      
      expect(response).not.toBeNull();
      // Ensure HTTP 200 OK
      expect(response?.status()).toBe(200);
      
      // Ensure no redirect and URL does not contain /login
      const url = new URL(page.url());
      expect(url.pathname).toBe(route.path);
      expect(url.pathname).not.toContain('/login');
      
      // Expected H1 is visible
      await expect(page.locator(`h1:has-text("${route.h1}")`)).toBeVisible();
      
      // Public navigation is visible (check for "Features" or "Contact Sales" in header)
      await expect(page.locator('header nav a:has-text("Features")')).toBeVisible();
      
      // Dashboard sidebar is absent (check for some sidebar locator, e.g., aside nav)
      // We will assert that a link to "Dashboard" or typical authenticated menu does not exist
      await expect(page.locator('text=Dashboard').first()).toBeHidden();
      
      // Footer is visible
      await expect(page.locator('footer')).toBeVisible();
      
      // Canonical is self-referencing
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe(`https://quantara.vistabylara.com${route.path}`);
      
      // Robots meta does not contain noindex
      const robots = await page.locator('meta[name="robots"]').count();
      if (robots > 0) {
         const robotsContent = await page.locator('meta[name="robots"]').getAttribute('content');
         expect(robotsContent).not.toContain('noindex');
      }
    });
  }
});
