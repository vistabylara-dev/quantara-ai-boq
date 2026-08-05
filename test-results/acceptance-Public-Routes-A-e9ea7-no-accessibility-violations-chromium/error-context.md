# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> Public Routes Acceptance >> Route /features should load successfully and have no accessibility violations
- Location: tests\e2e\acceptance.spec.ts:16:9

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 105

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
+               "bgColor": "#f3f7fa",
+               "contrastRatio": 2.58,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#909cad",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.58 (foreground color: #909cad, background color: #f3f7fa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"p-6 bg-slate-100 dark:bg-slate-900/20 rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm opacity-70\">",
+                 "target": Array [
+                   ".bg-slate-100.dark\\:bg-slate-900\\/20.dark\\:border-slate-800\\/50:nth-child(1)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"min-h-screen bg-slate-50 dark:bg-[#030508] text-slate-900 dark:text-slate-100 py-24\">",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.58 (foreground color: #909cad, background color: #f3f7fa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-slate-500 dark:text-slate-500 text-sm\">Automated extraction of quantities and specifications directly from 3D models.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-slate-100.dark\\:bg-slate-900\\/20.dark\\:border-slate-800\\/50:nth-child(1) > .text-slate-500.dark\\:text-slate-500.text-sm",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f3f7fa",
+               "contrastRatio": 2.58,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#909cad",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.58 (foreground color: #909cad, background color: #f3f7fa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"p-6 bg-slate-100 dark:bg-slate-900/20 rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm opacity-70\">",
+                 "target": Array [
+                   ".bg-slate-100.dark\\:bg-slate-900\\/20.dark\\:border-slate-800\\/50:nth-child(2)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"min-h-screen bg-slate-50 dark:bg-[#030508] text-slate-900 dark:text-slate-100 py-24\">",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.58 (foreground color: #909cad, background color: #f3f7fa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-slate-500 dark:text-slate-500 text-sm\">Predictive pricing trends and risk assessment based on historical BOQ data.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-slate-100.dark\\:bg-slate-900\\/20.dark\\:border-slate-800\\/50:nth-child(2) > .text-slate-500.dark\\:text-slate-500.text-sm",
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
      - link "← Back to Home" [ref=e6] [cursor=pointer]:
        - /url: /
      - generic [ref=e7]:
        - heading "Product Features" [level=1] [ref=e8]
        - paragraph [ref=e9]: Quantara is currently in Early Access. Below is the status of our core BOQ and estimating capabilities.
      - generic [ref=e10]:
        - generic [ref=e11]:
          - heading "Live in Early Access" [level=2] [ref=e12]
          - generic [ref=e14]:
            - generic [ref=e15]:
              - heading "Multi-format BOQ extraction" [level=3] [ref=e16]
              - paragraph [ref=e17]: Extract scope, item, quantity, and specification information from PDF, XLSX, and CSV formats.
            - generic [ref=e18]:
              - heading "Automated BOQ organization and grouping" [level=3] [ref=e19]
              - paragraph [ref=e20]: Group extracted BOQ content into controlled categories and sections.
            - generic [ref=e21]:
              - heading "BOQ hierarchy and item management" [level=3] [ref=e22]
              - paragraph [ref=e23]: Organize BOQs into sections, items, quantities, units, and revisions.
            - generic [ref=e24]:
              - heading "Project and client workspaces" [level=3] [ref=e25]
              - paragraph [ref=e26]: Manage BOQs, projects, clients, and generated records within secure workspaces.
            - generic [ref=e27]:
              - heading "Document generation" [level=3] [ref=e28]
              - paragraph [ref=e29]: Generate professional PDFs, DOCX, XLSX, proposals, and technical reports.
            - generic [ref=e30]:
              - heading "Template governance" [level=3] [ref=e31]
              - paragraph [ref=e32]: Use approved templates to ensure consistent proposals and documents.
        - generic [ref=e33]:
          - heading "In Development" [level=2] [ref=e34]
          - generic [ref=e36]:
            - generic [ref=e37]:
              - heading "Supplier and supply-chain intelligence" [level=3] [ref=e38]
              - paragraph [ref=e39]: Integrate supplier insights for more accurate estimating workflows.
            - generic [ref=e40]:
              - heading "Google Drive integration" [level=3] [ref=e41]
              - paragraph [ref=e42]: Seamlessly import project documents and export completed BOQs to Google Drive.
        - generic [ref=e43]:
          - heading "Planned" [level=2] [ref=e44]
          - generic [ref=e46]:
            - generic [ref=e47]:
              - heading "CAD & BIM Extraction" [level=3] [ref=e48]
              - paragraph [ref=e49]: Automated extraction of quantities and specifications directly from 3D models.
            - generic [ref=e50]:
              - heading "Advanced Estimating Analytics" [level=3] [ref=e51]
              - paragraph [ref=e52]: Predictive pricing trends and risk assessment based on historical BOQ data.
  - alert [ref=e53]
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