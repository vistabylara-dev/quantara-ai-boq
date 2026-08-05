# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase5-routes.spec.ts >> Phase 5 Regional Location Routes Anonymous Access >> Anonymous user can access /boq-software-dubai directly without redirect
- Location: tests\e2e\phase5-routes.spec.ts:17:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h1')

```

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2]'
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const PHASE5_ROUTES = [
  4  |   '/gcc-boq-software',
  5  |   '/boq-software-uae',
  6  |   '/boq-software-dubai',
  7  |   '/boq-software-abu-dhabi',
  8  |   '/construction-estimating-software-uae',
  9  |   '/mep-estimating-software-uae',
  10 |   '/boq-software-saudi-arabia',
  11 |   '/boq-software-qatar',
  12 |   '/boq-software-oman'
  13 | ];
  14 | 
  15 | test.describe('Phase 5 Regional Location Routes Anonymous Access', () => {
  16 |   for (const route of PHASE5_ROUTES) {
  17 |     test(`Anonymous user can access ${route} directly without redirect`, async ({ page }) => {
  18 |       const response = await page.goto(route);
  19 |       
  20 |       expect(response?.status()).toBe(200);
  21 |       expect(page.url()).toContain(route);
  22 |       
  23 |       // Ensure we haven't been redirected to /login
  24 |       expect(page.url()).not.toContain('/login');
  25 |       
  26 |       // Ensure the AppShell layout (Dashboard) is NOT rendered
  27 |       await expect(page.locator('aside')).toHaveCount(0);
  28 |       
  29 |       // Look for the specific H1 header that every page should have
  30 |       const h1 = page.locator('h1');
> 31 |       await expect(h1).toBeVisible();
     |                        ^ Error: expect(locator).toBeVisible() failed
  32 |       
  33 |       // Ensure the professional disclaimer is visible somewhere on the page
  34 |       const disclaimer = page.getByText(/Quantara assists with supported document extraction/);
  35 |       await expect(disclaimer.first()).toBeVisible();
  36 |     });
  37 |   }
  38 | });
  39 | 
```