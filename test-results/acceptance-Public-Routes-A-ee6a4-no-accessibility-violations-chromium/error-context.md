# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> Public Routes Acceptance >> Route /register should load successfully and have no accessibility violations
- Location: tests\e2e\acceptance.spec.ts:16:9

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 93

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#020617",
+               "contrastRatio": 4.23,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#64748b",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.23 (foreground color: #64748b, background color: #020617, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"rounded-[32px] border border-slate-800 bg-slate-950 p-8\">",
+                 "target": Array [
+                   ".rounded-\\[32px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.23 (foreground color: #64748b, background color: #020617, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-sm uppercase tracking-[0.28em] text-slate-500\">Quantara AI</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".uppercase",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#020617",
+               "contrastRatio": 4.23,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#64748b",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.23 (foreground color: #64748b, background color: #020617, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"rounded-[32px] border border-slate-800 bg-slate-950 p-8\">",
+                 "target": Array [
+                   ".rounded-\\[32px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.23 (foreground color: #64748b, background color: #020617, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"mt-1 text-xs text-slate-500\">At least 8 characters, with a letter and a number.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".text-xs",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - paragraph [ref=e5]: Quantara AI
      - heading "Request Early Access" [level=1] [ref=e6]
      - paragraph [ref=e7]: Creating an Early Access account does not begin a paid subscription or automatic billing.
      - generic [ref=e8]:
        - generic [ref=e9]:
          - generic [ref=e10]:
            - text: Full name
            - textbox "Full name" [ref=e11]
          - generic [ref=e12]:
            - text: Business Email
            - textbox "Business Email" [ref=e13]
        - generic [ref=e14]:
          - generic [ref=e15]:
            - text: Company
            - textbox "Company" [ref=e16]
          - generic [ref=e17]:
            - text: Role
            - combobox "Role" [ref=e18]:
              - option "Quantity Surveyor" [selected]
              - option "Estimator"
              - option "Engineer"
              - option "Project Manager"
              - option "Contractor"
              - option "Procurement Professional"
              - option "Company Owner"
              - option "Consultant"
              - option "Other"
        - generic [ref=e19]:
          - generic [ref=e20]:
            - text: Country
            - textbox "Country" [ref=e21]
          - generic [ref=e22]:
            - text: Primary Industry
            - textbox "Primary Industry" [ref=e23]
        - generic [ref=e24]:
          - generic [ref=e25]:
            - text: Intended Use
            - textbox "Intended Use" [ref=e26]
          - generic [ref=e27]:
            - text: Approx. Monthly Project Volume
            - combobox "Approx. Monthly Project Volume" [ref=e28]:
              - option "Select volume..." [selected]
              - option "1-5 projects"
              - option "6-20 projects"
              - option "21-50 projects"
              - option "50+ projects"
        - generic [ref=e29]:
          - text: Interest Tier
          - combobox "Interest Tier" [ref=e30]:
            - option "Starter Interest" [selected]
            - option "Professional Interest"
            - option "Business Interest"
        - generic [ref=e31]:
          - text: Password
          - textbox "Password" [ref=e32]
          - paragraph [ref=e33]: At least 8 characters, with a letter and a number.
        - generic [ref=e34]:
          - checkbox "I consent to the collection and processing of my information for Early Access evaluation in accordance with the Privacy Policy." [ref=e35]
          - generic [ref=e36]:
            - text: I consent to the collection and processing of my information for Early Access evaluation in accordance with the
            - link "Privacy Policy" [ref=e37] [cursor=pointer]:
              - /url: /privacy
            - text: .
        - button "Request Access" [ref=e38] [cursor=pointer]
      - generic [ref=e39]:
        - text: Already have an account?
        - link "Sign in" [ref=e40] [cursor=pointer]:
          - /url: /login
  - alert [ref=e41]
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
> 33 |       expect(accessibilityScanResults.violations).toEqual([]);
     |                                                   ^ Error: expect(received).toEqual(expected) // deep equality
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
  57 |     await page.getByRole('textbox', { name: 'First Name' }).fill('Integration');
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