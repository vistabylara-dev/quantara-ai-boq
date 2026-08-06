# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> Public Routes Acceptance >> Route /security should load successfully and have no accessibility violations
- Location: tests\e2e\acceptance.spec.ts:16:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.screenshot: Test timeout of 30000ms exceeded.
Call log:
  - taking page screenshot
  - waiting for fonts to load...
  - fonts loaded

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "Quantara Home" [ref=e5] [cursor=pointer]:
          - /url: /
          - img "Quantara Logo" [ref=e6]
          - text: Quantara
        - generic [ref=e7]:
          - button "Platform" [ref=e9] [cursor=pointer]
          - button "Solutions" [ref=e13] [cursor=pointer]
          - button "Resources" [ref=e17] [cursor=pointer]
          - button "Comparisons" [ref=e21] [cursor=pointer]
          - button "Regional" [ref=e25] [cursor=pointer]
          - button "Company" [ref=e29] [cursor=pointer]
        - generic [ref=e32]:
          - link "Sign In" [ref=e33] [cursor=pointer]:
            - /url: /login
          - link "Request Early Access" [ref=e34] [cursor=pointer]:
            - /url: /register
    - main [ref=e35]:
      - generic [ref=e36]:
        - link "← Back to Home" [ref=e38] [cursor=pointer]:
          - /url: /
        - generic [ref=e39]:
          - heading "Security and Controlled Early Access" [level=1] [ref=e40]
          - paragraph [ref=e41]: "Last updated: August 5, 2026"
          - paragraph [ref=e42]: Quantara is currently available through Controlled Early Access.
        - generic [ref=e43]:
          - generic [ref=e44]:
            - heading "Current security position" [level=2] [ref=e45]
            - generic [ref=e46]:
              - paragraph [ref=e47]: Access to authenticated product areas requires user authentication.
              - paragraph [ref=e48]: Quantara uses controlled company, project and user workspaces.
              - paragraph [ref=e49]: Public marketing and legal-information pages do not require authentication.
              - paragraph [ref=e50]: Product access and feature availability may be limited during Controlled Early Access.
              - paragraph [ref=e51]: Security, retention and data-processing documentation is being finalized before broader commercial onboarding.
              - paragraph [ref=e52]: Professional users remain responsible for reviewing information before commercial, contractual, tender or construction use.
          - generic [ref=e53]:
            - heading "Important limitation" [level=2] [ref=e54]
            - generic [ref=e55]:
              - paragraph [ref=e56]: No internet service, software platform or electronic-storage method can guarantee absolute security.
              - paragraph [ref=e57]: Do not upload confidential drawings, restricted specifications, commercially sensitive pricing, private client information or third-party personal data until your organisation has reviewed and accepted the applicable final legal and data-processing terms.
          - generic [ref=e58]:
            - heading "Report a security concern" [level=2] [ref=e59]
            - generic [ref=e60]:
              - list [ref=e61]:
                - listitem [ref=e62]:
                  - strong [ref=e63]: "Email:"
                  - link "solution@vistabylara.com" [ref=e64] [cursor=pointer]:
                    - /url: mailto:solution@vistabylara.com
                - listitem [ref=e65]:
                  - strong [ref=e66]: "Telephone:"
                  - link "+971 50 799 4292" [ref=e67] [cursor=pointer]:
                    - /url: tel:+971507994292
                - listitem [ref=e68]:
                  - strong [ref=e69]: "WhatsApp:"
                  - link "+971 50 799 4292" [ref=e70] [cursor=pointer]:
                    - /url: https://wa.me/971507994292
              - paragraph [ref=e71]: Support and security reports can be submitted 24 hours a day. Response times may vary during Controlled Early Access.
            - generic [ref=e72]:
              - paragraph [ref=e73]: "When reporting an issue, include:"
              - list [ref=e74]:
                - listitem [ref=e75]: the affected page or feature;
                - listitem [ref=e76]: a clear description;
                - listitem [ref=e77]: reproduction steps;
                - listitem [ref=e78]: the date and time observed;
                - listitem [ref=e79]: screenshots where appropriate.
              - paragraph [ref=e80]: Do not send passwords, private keys, access tokens or other authentication secrets.
    - generic [ref=e82]:
      - generic [ref=e83]:
        - generic [ref=e84]:
          - link "Quantara Home" [ref=e85] [cursor=pointer]:
            - /url: /
            - img "Quantara Logo" [ref=e86]
            - text: Quantara
          - paragraph [ref=e87]: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
          - paragraph [ref=e88]: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
          - generic [ref=e89]:
            - paragraph [ref=e90]:
              - text: "Email:"
              - link "solution@vistabylara.com" [ref=e91] [cursor=pointer]:
                - /url: mailto:solution@vistabylara.com
            - paragraph [ref=e92]:
              - text: "Telephone:"
              - link "+971 50 799 4292" [ref=e93] [cursor=pointer]:
                - /url: tel:+971507994292
            - paragraph [ref=e94]:
              - text: "WhatsApp:"
              - link "+971 50 799 4292" [ref=e95] [cursor=pointer]:
                - /url: https://wa.me/971507994292
        - generic [ref=e96]:
          - heading "Platform" [level=3] [ref=e97]
          - list [ref=e98]:
            - listitem [ref=e99]:
              - link "Features" [ref=e100] [cursor=pointer]:
                - /url: /features
            - listitem [ref=e101]:
              - link "AI BOQ Software" [ref=e102] [cursor=pointer]:
                - /url: /ai-boq-software
            - listitem [ref=e103]:
              - link "BOQ Software" [ref=e104] [cursor=pointer]:
                - /url: /boq-software
            - listitem [ref=e105]:
              - link "Construction Estimating Software" [ref=e106] [cursor=pointer]:
                - /url: /construction-estimating-software
            - listitem [ref=e107]:
              - link "BOQ Management" [ref=e108] [cursor=pointer]:
                - /url: /boq-management
            - listitem [ref=e109]:
              - link "PDF BOQ Extraction" [ref=e110] [cursor=pointer]:
                - /url: /pdf-boq-extraction
            - listitem [ref=e111]:
              - link "Scanned PDF BOQ" [ref=e112] [cursor=pointer]:
                - /url: /scanned-pdf-boq
        - generic [ref=e113]:
          - heading "Solutions" [level=3] [ref=e114]
          - list [ref=e115]:
            - listitem [ref=e116]:
              - link "All Industries" [ref=e117] [cursor=pointer]:
                - /url: /industries
            - listitem [ref=e118]:
              - link "Contractors" [ref=e119] [cursor=pointer]:
                - /url: /boq-software-for-contractors
            - listitem [ref=e120]:
              - link "Quantity Surveyors" [ref=e121] [cursor=pointer]:
                - /url: /boq-software-for-quantity-surveyors
            - listitem [ref=e122]:
              - link "MEP Contractors" [ref=e123] [cursor=pointer]:
                - /url: /boq-software-for-mep-contractors
            - listitem [ref=e124]:
              - link "HVAC Contractors" [ref=e125] [cursor=pointer]:
                - /url: /boq-software-for-hvac-contractors
          - heading "Comparisons" [level=3] [ref=e126]
          - list [ref=e127]:
            - listitem [ref=e128]:
              - link "Comparison Hub" [ref=e129] [cursor=pointer]:
                - /url: /comparisons
            - listitem [ref=e130]:
              - link "Quantara vs Excel for BOQ" [ref=e131] [cursor=pointer]:
                - /url: /quantara-vs-excel-for-boq
            - listitem [ref=e132]:
              - link "BOQ Software vs Spreadsheets" [ref=e133] [cursor=pointer]:
                - /url: /boq-software-vs-spreadsheets
            - listitem [ref=e134]:
              - link "AI BOQ vs Manual BOQ Preparation" [ref=e135] [cursor=pointer]:
                - /url: /ai-boq-vs-manual-boq-preparation
            - listitem [ref=e136]:
              - link "OCR vs Structured BOQ Extraction" [ref=e137] [cursor=pointer]:
                - /url: /ocr-vs-structured-boq-extraction
        - generic [ref=e138]:
          - heading "Resources" [level=3] [ref=e139]
          - list [ref=e140]:
            - listitem [ref=e141]:
              - link "Resource Centre" [ref=e142] [cursor=pointer]:
                - /url: /resources
            - listitem [ref=e143]:
              - link "BOQ Calculation Formulas" [ref=e144] [cursor=pointer]:
                - /url: /boq-calculation-formulas
            - listitem [ref=e145]:
              - link "Free BOQ Calculator — External Vista By Lara Tool" [ref=e146] [cursor=pointer]:
                - /url: https://www.vistabylara.com/ai-tools/boq-calculator-uae
            - listitem [ref=e147]:
              - link "What Is a BOQ?" [ref=e148] [cursor=pointer]:
                - /url: /what-is-a-boq
            - listitem [ref=e149]:
              - link "How to Prepare a BOQ" [ref=e150] [cursor=pointer]:
                - /url: /how-to-prepare-a-boq
            - listitem [ref=e151]:
              - link "BOQ vs Construction Estimate" [ref=e152] [cursor=pointer]:
                - /url: /boq-vs-construction-estimate
            - listitem [ref=e153]:
              - link "BOQ vs Bill of Materials" [ref=e154] [cursor=pointer]:
                - /url: /boq-vs-bill-of-materials
            - listitem [ref=e155]:
              - link "BOQ Review Checklist" [ref=e156] [cursor=pointer]:
                - /url: /boq-review-checklist
        - generic [ref=e157]:
          - heading "Regional" [level=3] [ref=e158]
          - list [ref=e159]:
            - listitem [ref=e160]:
              - link "GCC BOQ Software" [ref=e161] [cursor=pointer]:
                - /url: /gcc-boq-software
            - listitem [ref=e162]:
              - link "UAE" [ref=e163] [cursor=pointer]:
                - /url: /boq-software-uae
            - listitem [ref=e164]:
              - link "Dubai" [ref=e165] [cursor=pointer]:
                - /url: /boq-software-dubai
            - listitem [ref=e166]:
              - link "Abu Dhabi" [ref=e167] [cursor=pointer]:
                - /url: /boq-software-abu-dhabi
            - listitem [ref=e168]:
              - link "UAE Construction Estimating" [ref=e169] [cursor=pointer]:
                - /url: /construction-estimating-software-uae
            - listitem [ref=e170]:
              - link "UAE MEP Estimating" [ref=e171] [cursor=pointer]:
                - /url: /mep-estimating-software-uae
            - listitem [ref=e172]:
              - link "Saudi Arabia" [ref=e173] [cursor=pointer]:
                - /url: /boq-software-saudi-arabia
        - generic [ref=e174]:
          - generic [ref=e175]:
            - heading "Enterprise Software" [level=3] [ref=e176]
            - paragraph [ref=e177]: Custom Quantara software implementation for companies requiring tailored workflows, integrations, branding, deployment, migration, onboarding or advanced operational requirements.
            - paragraph [ref=e178]: Custom implementation and onboarding starting from AED 15,000
            - paragraph [ref=e179]: Final scope and pricing are provided through a custom quotation following a requirements review.
            - link "Contact Sales →" [ref=e180] [cursor=pointer]:
              - /url: /contact-sales
          - generic [ref=e181]:
            - heading "Company" [level=3] [ref=e182]
            - list [ref=e183]:
              - listitem [ref=e184]:
                - link "About" [ref=e185] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e186]:
                - link "Contact Sales" [ref=e187] [cursor=pointer]:
                  - /url: /contact-sales
              - listitem [ref=e188]:
                - link "Request Early Access" [ref=e189] [cursor=pointer]:
                  - /url: /register
              - listitem [ref=e190]:
                - link "Security" [ref=e191] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e192]:
                - link "HTML Sitemap" [ref=e193] [cursor=pointer]:
                  - /url: /site-map
          - generic [ref=e194]:
            - heading "Legal" [level=3] [ref=e195]
            - list [ref=e196]:
              - listitem [ref=e197]:
                - link "Privacy" [ref=e198] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e199]:
                - link "Terms" [ref=e200] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e201]:
                - link "Cookie Policy" [ref=e202] [cursor=pointer]:
                  - /url: /cookie-policy
              - listitem [ref=e203]:
                - link "Data Processing" [ref=e204] [cursor=pointer]:
                  - /url: /data-processing
              - listitem [ref=e205]:
                - link "Acceptable Use" [ref=e206] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e207]:
                - link "Subprocessors" [ref=e208] [cursor=pointer]:
                  - /url: /subprocessors
      - generic [ref=e209]: © 2026 Quantara. Operated by Vista By Lara. All rights reserved.
  - generic [ref=e215] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e216]
    - generic [ref=e220]:
      - button "Open issues overlay" [ref=e221]:
        - generic [ref=e222]:
          - generic [ref=e223]: "0"
          - generic [ref=e224]: "1"
        - generic [ref=e225]: Issue
      - button "Collapse issues badge" [ref=e226]
  - alert [ref=e229]
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
> 29 |       await page.screenshot({ path: `screenshots/${route === '/' ? 'home' : route.replace('/', '')}.png`, fullPage: true });
     |                  ^ Error: page.screenshot: Test timeout of 30000ms exceeded.
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