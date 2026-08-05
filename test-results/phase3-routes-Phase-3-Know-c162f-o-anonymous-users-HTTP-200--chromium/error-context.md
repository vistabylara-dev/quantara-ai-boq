# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase3-routes.spec.ts >> Phase 3 Knowledge Base Routes Public Access >> Route /what-is-a-boq should be accessible to anonymous users (HTTP 200)
- Location: tests\e2e\phase3-routes.spec.ts:21:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('footer')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('footer')

```

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2]'
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const PHASE_3_ROUTES = [
  4  |   '/what-is-a-boq',
  5  |   '/boq-vs-construction-estimate',
  6  |   '/boq-vs-bill-of-materials',
  7  |   '/how-to-prepare-a-boq',
  8  |   '/boq-review-checklist',
  9  |   '/common-boq-errors',
  10 |   '/boq-revision-control',
  11 |   '/how-to-convert-pdf-boq-to-excel',
  12 |   '/text-pdf-vs-scanned-pdf',
  13 |   '/ocr-for-boq-documents',
  14 |   '/how-to-review-ai-extracted-boq',
  15 |   '/quantity-takeoff-vs-boq-management',
  16 |   '/resources'
  17 | ];
  18 | 
  19 | test.describe('Phase 3 Knowledge Base Routes Public Access', () => {
  20 |   for (const route of PHASE_3_ROUTES) {
  21 |     test(`Route ${route} should be accessible to anonymous users (HTTP 200)`, async ({ page }) => {
  22 |       const response = await page.goto(route);
  23 |       
  24 |       expect(response?.status()).toBe(200);
  25 |       
  26 |       // Ensure it did not redirect to login
  27 |       expect(page.url()).not.toContain('/login');
  28 |       
  29 |       // Ensure the dashboard shell is NOT present
  30 |       const dashboardSidebar = page.locator('aside').filter({ hasText: 'Dashboard' });
  31 |       await expect(dashboardSidebar).toHaveCount(0);
  32 |       
  33 |       // Check for the public footer to confirm it's the public shell
  34 |       const footer = page.locator('footer');
> 35 |       await expect(footer).toBeVisible();
     |                            ^ Error: expect(locator).toBeVisible() failed
  36 |     });
  37 |   }
  38 | });
  39 | 
```