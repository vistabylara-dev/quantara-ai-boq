# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> Contact Form Acceptance >> Should submit successfully and not touch Prisma
- Location: tests\e2e\acceptance.spec.ts:39:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: 'First Name' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - link "← Back to Home" [ref=e6] [cursor=pointer]:
        - /url: /
      - generic [ref=e7]:
        - generic [ref=e8]:
          - heading "Contact Sales" [level=1] [ref=e9]
          - paragraph [ref=e10]: Discuss enterprise implementation, custom integrations, or get answers to security and compliance questions for your BOQ workflows.
          - generic [ref=e11]:
            - heading "Why contact sales?" [level=3] [ref=e12]
            - list [ref=e13]:
              - listitem [ref=e14]:
                - generic [ref=e15]: ✓
                - text: Custom pricing for large estimating teams
              - listitem [ref=e16]:
                - generic [ref=e17]: ✓
                - text: Security & compliance reviews
              - listitem [ref=e18]:
                - generic [ref=e19]: ✓
                - text: Dedicated onboarding and training support
        - generic [ref=e20]:
          - heading "Talk to an Expert" [level=2] [ref=e21]
          - generic [ref=e22]:
            - generic [ref=e23]:
              - generic [ref=e24]:
                - generic [ref=e25]: First Name
                - textbox [ref=e26]
              - generic [ref=e27]:
                - generic [ref=e28]: Last Name
                - textbox [ref=e29]
            - generic [ref=e30]:
              - generic [ref=e31]: Work Email
              - textbox [ref=e32]
            - generic [ref=e33]:
              - generic [ref=e34]:
                - generic [ref=e35]: Company Type
                - combobox "Company Type" [ref=e36]:
                  - option "Main Contractor" [selected]
                  - option "Subcontractor"
                  - option "Consultancy"
                  - option "Developer"
                  - option "Other"
              - generic [ref=e37]:
                - generic [ref=e38]: Construction Discipline
                - textbox [ref=e39]: General
            - generic [ref=e40]:
              - generic [ref=e41]: Current BOQ Process
              - textbox [ref=e42]
            - generic [ref=e43]:
              - generic [ref=e44]:
                - generic [ref=e45]: Avg Monthly BOQ Volume
                - combobox "Average Monthly Volume" [ref=e46]:
                  - option "1-5" [selected]
                  - option "6-20"
                  - option "21-50"
                  - option "50+"
              - generic [ref=e47]:
                - generic [ref=e48]: Number of Users
                - combobox "Number of Users" [ref=e49]:
                  - option "1-5" [selected]
                  - option "6-20"
                  - option "21-50"
                  - option "50+"
            - generic [ref=e50]:
              - generic [ref=e51]:
                - generic [ref=e52]: Required Input Formats
                - textbox "e.g. PDF, CAD" [ref=e53]
              - generic [ref=e54]:
                - generic [ref=e55]: Required Output Formats
                - textbox "e.g. Excel, PDF" [ref=e56]
            - generic [ref=e57]:
              - generic [ref=e58]:
                - generic [ref=e59]: Integration Req.
                - textbox "e.g. ERP" [ref=e60]
              - generic [ref=e61]:
                - generic [ref=e62]: Preferred Contact
                - combobox "Preferred Contact Method" [ref=e63]:
                  - option "Email" [selected]
                  - option "Phone"
            - generic [ref=e64]:
              - checkbox "I consent to the collection and processing of my information in accordance with the Privacy Policy." [ref=e65]
              - generic [ref=e66]:
                - text: I consent to the collection and processing of my information in accordance with the
                - link "Privacy Policy" [ref=e67] [cursor=pointer]:
                  - /url: /privacy
                - text: .
            - button "Talk to an Expert" [ref=e68] [cursor=pointer]
  - alert [ref=e69]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | 
  4  | const publicRoutes = [
  5  |   '/',
  6  |   '/features',
  7  |   '/privacy',
  8  |   '/terms',
  9  |   '/security',
  10 |   '/contact-sales',
  11 |   '/register',
  12 | ];
  13 | 
  14 | test.describe('Public Routes Acceptance', () => {
  15 |   for (const route of publicRoutes) {
  16 |     test(`Route ${route} should load successfully and have no accessibility violations`, async ({ page }) => {
  17 |       const response = await page.goto(route);
  18 |       
  19 |       // 1. Verify HTTP Status
  20 |       expect(response?.status()).toBe(200);
  21 |       
  22 |       // 2. Verify Authentication Bypass (should not redirect to /login)
  23 |       expect(page.url()).not.toContain('/login');
  24 |       if (route !== '/') {
  25 |         expect(page.url()).toContain(route);
  26 |       }
  27 |       
  28 |       // 3. Take screenshot
  29 |       await page.screenshot({ path: `screenshots/${route === '/' ? 'home' : route.replace('/', '')}.png`, fullPage: true });
  30 |       
  31 |       // 4. Verify Accessibility
  32 |       const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  33 |       expect(accessibilityScanResults.violations).toEqual([]);
  34 |     });
  35 |   }
  36 | });
  37 | 
  38 | test.describe('Contact Form Acceptance', () => {
  39 |   test('Should submit successfully and not touch Prisma', async ({ page, request }) => {
  40 |     // Intercept the API call to ensure it's made and check response
  41 |     await page.route('/api/contact', async route => {
  42 |       const request = route.request();
  43 |       expect(request.method()).toBe('POST');
  44 |       
  45 |       // Mock the response so we don't actually send emails or hit DB if there was one
  46 |       // Wait, the API already just returns success without Prisma. 
  47 |       // The requirement says: "The Playwright contact-form test must never create an uncontrolled record in the production database."
  48 |       // Since we know `/api/contact` doesn't use Prisma currently, we can let it pass, or mock it to be 100% safe.
  49 |       await route.fulfill({
  50 |         status: 200,
  51 |         contentType: 'application/json',
  52 |         body: JSON.stringify({ success: true })
  53 |       });
  54 |     });
  55 | 
  56 |     await page.goto('/contact-sales');
> 57 |     await page.getByRole('textbox', { name: 'First Name' }).fill('Integration');
     |                                                             ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  58 |     await page.getByRole('textbox', { name: 'Last Name' }).fill('Test');
  59 |     await page.getByRole('textbox', { name: 'Work Email' }).fill('test@example.com');
  60 |     await page.getByRole('textbox', { name: 'Construction Discipline' }).fill('Civil');
  61 |     await page.getByRole('textbox', { name: 'Current BOQ Process' }).fill('Excel');
  62 |     
  63 |     // Check consent checkbox
  64 |     await page.getByRole('checkbox', { name: /consent/i }).check();
  65 |     
  66 |     await page.click('button[type="submit"]');
  67 |     
  68 |     await expect(page.locator('text=Thank you.')).toBeVisible();
  69 |     await page.screenshot({ path: 'screenshots/contact-sales-success.png' });
  70 |   });
  71 | });
  72 | 
```