import { test, expect } from '@playwright/test';

test.describe('Breadcrumb Schema and UI Verification', () => {
  const routes = [
    '/what-is-a-boq',
    '/boq-software-for-mep-contractors',
    '/quantara-vs-excel-for-boq',
    '/site-map'
  ];

  for (const route of routes) {
    test(`Route ${route} should have matching schema and UI breadcrumb`, async ({ page }) => {
      await page.goto(route);
      
      // Get JSON-LD BreadcrumbList
      const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
      let breadcrumbSchema = null;
      let count = 0;
      for (const schemaStr of schemas) {
        try {
          const parsed = JSON.parse(schemaStr);
          if (parsed['@type'] === 'BreadcrumbList') {
            breadcrumbSchema = parsed;
            count++;
          }
        } catch(e) {}
      }
      
      expect(count).toBe(1); // exactly one BreadcrumbList per page
      
      // Visible breadcrumbs
      const visibleBreadcrumbLocators = await page.locator('div:has(> a:has-text("Home")) span').allTextContents();
      
      if (breadcrumbSchema && breadcrumbSchema.itemListElement && breadcrumbSchema.itemListElement.length > 0) {
        const lastItem = breadcrumbSchema.itemListElement[breadcrumbSchema.itemListElement.length - 1];
        
        // Ensure visible breadcrumb includes the name in JSON-LD
        const visibleText = await page.locator('.container.mx-auto').innerText();
        expect(visibleText.replace(/\\n/g, ' ')).toContain(lastItem.name);
      }
    });
  }
});
