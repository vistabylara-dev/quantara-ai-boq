import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prisma } from '../../src/lib/db/prisma';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'artifacts/production-readiness/screenshots/local');

// Ensure directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const publicRoutes = [
  { path: '/', name: 'homepage' },
  { path: '/features', name: 'features' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
  { path: '/security', name: 'security' },
  { path: '/data-processing', name: 'data-processing' },
  { path: '/cookie-policy', name: 'cookie-policy' },
  { path: '/acceptable-use', name: 'acceptable-use' },
  { path: '/subprocessors', name: 'subprocessors' },
  { path: '/contact-sales', name: 'contact-sales' },
];

const auditResults: any = {
  metadata: [],
  schemas: [],
  ctas: [],
};

test.describe('Production Readiness Audit', () => {
  
  test.afterAll(() => {
    fs.writeFileSync(path.join(process.cwd(), 'artifacts/production-readiness/audit-results.json'), JSON.stringify(auditResults, null, 2));
  });

  for (const route of publicRoutes) {
    test(`Audit ${route.name}`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);

      const url = new URL(page.url());
      expect(url.pathname).toBe(route.path);

      // 1. Accessibility (Axe)
      if (['homepage', 'features', 'contact-sales', 'security', 'privacy'].includes(route.name)) {
        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
        auditResults[`axe_${route.name}`] = accessibilityScanResults.violations;
      }

      // 2. Screenshots (Desktop & Mobile)
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${route.name}-desktop.png`), fullPage: true });

      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${route.name}-mobile.png`), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 }); // reset

      // 3. Metadata
      const title = await page.title();
      const desc = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(() => null);
      const robots = await page.locator('meta[name="robots"]').getAttribute('content').catch(() => null);
      const h1 = await page.locator('h1').first().innerText().catch(() => null);
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => null);
      const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content').catch(() => null);
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content').catch(() => null);
      const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content').catch(() => null);
      const lang = await page.locator('html').getAttribute('lang').catch(() => null);

      auditResults.metadata.push({
        path: route.path, status: 200, title, desc, canonical, robots, h1, ogTitle, ogDesc, ogImage, twitterCard, lang
      });

      // 4. Schema (JSON-LD)
      const schemas = await page.locator('script[type="application/ld+json"]').allInnerTexts();
      schemas.forEach(s => {
        try {
          const parsed = JSON.parse(s);
          auditResults.schemas.push({ path: route.path, type: parsed['@type'], content: parsed });
        } catch(e) {}
      });

      // 5. CTAs / Links
      const links = await page.locator('a, button').all();
      for (const link of links) {
        const text = (await link.innerText()).trim();
        const href = await link.getAttribute('href').catch(() => null);
        if (text && text.length > 0) {
          auditResults.ctas.push({ path: route.path, text, href });
        }
      }
    });
  }

  test('Contact Sales E2E with DB Cleanup', async ({ page }) => {
    // Navigate
    await page.goto('/contact-sales');
    const timestamp = Date.now();
    const testEmail = `quantara-e2e-${timestamp}@example.test`;

    // Invalid submission (empty)
    await page.click('button:has-text("Talk to an Expert")');
    // Ensure HTML5 validation kicks in, or custom validation
    // Wait for the button to remain enabled/submittable if there are validation errors, or wait for error message
    // If it relies on native HTML5 required, we can check if the form is invalid:
    const isValid = await page.evaluate(() => (document.querySelector('form') as HTMLFormElement).checkValidity());
    expect(isValid).toBe(false);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contact-sales-validation-error.png') });

    // Valid submission
    await page.fill('label:has-text("First Name") + input', 'E2E');
    await page.fill('label:has-text("Last Name") + input', 'Test');
    await page.fill('label:has-text("Work Email") + input', testEmail);
    
    // Select manipulation check (we just submit normally for now)
    await page.click('button:has-text("Talk to an Expert")');

    // Wait for success
    await expect(page.locator('text=Your request has been received.')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contact-sales-success.png') });

    // DB Verification
    const record = await prisma.salesInquiry.findFirst({ where: { workEmail: testEmail } });
    expect(record).not.toBeNull();
    expect(record?.deliveryStatus).toBe('stored');

    // Cleanup
    await prisma.salesInquiry.deleteMany({ where: { workEmail: testEmail } });
    const checkDeleted = await prisma.salesInquiry.findFirst({ where: { workEmail: testEmail } });
    expect(checkDeleted).toBeNull();
  });
});
