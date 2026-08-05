# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase4-routes.spec.ts >> Phase 4 Industry Routes Public Access >> Route /boq-software-for-engineering-consultants should be accessible to anonymous users (HTTP 200)
- Location: tests\e2e\phase4-routes.spec.ts:17:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 0
```

# Page snapshot

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2] [ref=e4]'
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const phase4Routes = [
  4  |   '/industries',
  5  |   '/boq-software-for-contractors',
  6  |   '/boq-software-for-quantity-surveyors',
  7  |   '/boq-software-for-mep-contractors',
  8  |   '/boq-software-for-hvac-contractors',
  9  |   '/boq-software-for-fit-out-companies',
  10 |   '/boq-software-for-fire-fighting-contractors',
  11 |   '/boq-software-for-facilities-management',
  12 |   '/boq-software-for-engineering-consultants'
  13 | ];
  14 | 
  15 | test.describe('Phase 4 Industry Routes Public Access', () => {
  16 |   for (const route of phase4Routes) {
  17 |     test(`Route ${route} should be accessible to anonymous users (HTTP 200)`, async ({ page }) => {
  18 |       const response = await page.goto(route);
  19 |       
  20 |       expect(response?.status()).toBe(200);
  21 |       
  22 |       // Ensure it did not redirect to login
  23 |       expect(page.url()).not.toContain('/login');
  24 |       
  25 |       // Verify one H1 exists
  26 |       const h1Count = await page.locator('h1').count();
> 27 |       expect(h1Count).toBe(1);
     |                       ^ Error: expect(received).toBe(expected) // Object.is equality
  28 |       
  29 |       // Verify no dashboard sidebar or authenticated shell elements
  30 |       const sidebarExists = await page.locator('nav[aria-label="Sidebar"]').count();
  31 |       expect(sidebarExists).toBe(0);
  32 | 
  33 |       // Verify the footer is present
  34 |       const footerExists = await page.locator('footer').count();
  35 |       expect(footerExists).toBeGreaterThan(0);
  36 |     });
  37 |   }
  38 | });
  39 | 
```