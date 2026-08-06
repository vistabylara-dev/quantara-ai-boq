# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> Public Routes Acceptance >> Route /features should load successfully and have no accessibility violations
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
        - navigation "Breadcrumb" [ref=e37]:
          - list [ref=e38]:
            - listitem [ref=e39]:
              - link "Home" [ref=e40] [cursor=pointer]:
                - /url: /
            - listitem [ref=e41]: /
            - listitem [ref=e42]:
              - link "Platform" [ref=e43] [cursor=pointer]:
                - /url: /features
            - listitem [ref=e44]: /
            - listitem [ref=e45]: Features
        - generic [ref=e47]:
          - heading "Features and Status Matrix" [level=1] [ref=e48]
          - paragraph [ref=e49]: Explore the complete set of capabilities available in Quantara's Controlled Early Access. Quantara provides project-first BOQ workflows with strict governance and professional review requirements.
        - generic [ref=e52]:
          - generic [ref=e53]:
            - generic [ref=e54]:
              - heading "Project-first workspace" [level=3] [ref=e55]
              - generic [ref=e56]: Live
            - paragraph [ref=e57]: Manage all BOQ tasks securely within dedicated project workspaces.
          - generic [ref=e58]:
            - generic [ref=e59]:
              - heading "Manual uploads" [level=3] [ref=e60]
              - generic [ref=e61]: Live
            - paragraph [ref=e62]: Upload text-based and scanned PDF BOQ documents directly into your project.
          - generic [ref=e63]:
            - generic [ref=e64]:
              - heading "Structured imports" [level=3] [ref=e65]
              - generic [ref=e66]: Live
            - paragraph [ref=e67]: Import structured BOQ data efficiently via XLSX and CSV formats.
          - generic [ref=e68]:
            - generic [ref=e69]:
              - heading "Connected applications" [level=3] [ref=e70]
              - generic [ref=e71]: Planned
            - paragraph [ref=e72]: Directly sync project data from authorized external applications.
          - generic [ref=e73]:
            - generic [ref=e74]:
              - heading "Hybrid-source projects" [level=3] [ref=e75]
              - generic [ref=e76]: Live
            - paragraph [ref=e77]: Combine supported PDFs, spreadsheets and manually imported project data in one workspace. Connected application integrations are planned.
          - generic [ref=e78]:
            - generic [ref=e79]:
              - heading "Source normalization" [level=3] [ref=e80]
              - generic [ref=e81]: Live
            - paragraph [ref=e82]: Automatically map varied external formats into standard, reviewable items.
          - generic [ref=e83]:
            - generic [ref=e84]:
              - heading "Project Source Centre" [level=3] [ref=e85]
              - generic [ref=e86]: Live
            - paragraph [ref=e87]: Manage all ingested project documents and data versions from a central hub.
          - generic [ref=e88]:
            - generic [ref=e89]:
              - heading "Source versions" [level=3] [ref=e90]
              - generic [ref=e91]: Live
            - paragraph [ref=e92]: Maintain distinct, traceable versions of all documents uploaded to a project.
          - generic [ref=e93]:
            - generic [ref=e94]:
              - heading "Voice instructions" [level=3] [ref=e95]
              - generic [ref=e96]: In Development
            - paragraph [ref=e97]: Provide natural spoken instructions for structuring and updating BOQs.
          - generic [ref=e98]:
            - generic [ref=e99]:
              - heading "Typed instructions" [level=3] [ref=e100]
              - generic [ref=e101]: In Development
            - paragraph [ref=e102]: Command the AI securely through text queries and typed BOQ update instructions.
          - generic [ref=e103]:
            - generic [ref=e104]:
              - heading "Structured AI proposals" [level=3] [ref=e105]
              - generic [ref=e106]: In Development
            - paragraph [ref=e107]: Quantara proposes governed changes to your records for review, rather than modifying directly.
          - generic [ref=e108]:
            - generic [ref=e109]:
              - heading "Selective approval" [level=3] [ref=e110]
              - generic [ref=e111]: In Development
            - paragraph [ref=e112]: Approve or reject individual proposed changes from the AI.
          - generic [ref=e113]:
            - generic [ref=e114]:
              - heading "Governed revision creation" [level=3] [ref=e115]
              - generic [ref=e116]: Live
            - paragraph [ref=e117]: Every approved change applies exclusively to a securely recorded project revision.
          - generic [ref=e118]:
            - generic [ref=e119]:
              - heading "BOQ source traceability" [level=3] [ref=e120]
              - generic [ref=e121]: Live
            - paragraph [ref=e122]: Trace generated BOQ records directly back to the original source document.
          - generic [ref=e123]:
            - generic [ref=e124]:
              - heading "Technical-report assistant" [level=3] [ref=e125]
              - generic [ref=e126]: In Development
            - paragraph [ref=e127]: Draft, organize and revise structured technical reports alongside the BOQ.
          - generic [ref=e128]:
            - generic [ref=e129]:
              - heading "Output generation" [level=3] [ref=e130]
              - generic [ref=e131]: Live
            - paragraph [ref=e132]: Generate professional, branded PDFs and detailed XLSX spreadsheets.
    - generic [ref=e134]:
      - generic [ref=e135]:
        - generic [ref=e136]:
          - link "Quantara Home" [ref=e137] [cursor=pointer]:
            - /url: /
            - img "Quantara Logo" [ref=e138]
            - text: Quantara
          - paragraph [ref=e139]: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
          - paragraph [ref=e140]: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
          - generic [ref=e141]:
            - paragraph [ref=e142]:
              - text: "Email:"
              - link "solution@vistabylara.com" [ref=e143] [cursor=pointer]:
                - /url: mailto:solution@vistabylara.com
            - paragraph [ref=e144]:
              - text: "Telephone:"
              - link "+971 50 799 4292" [ref=e145] [cursor=pointer]:
                - /url: tel:+971507994292
            - paragraph [ref=e146]:
              - text: "WhatsApp:"
              - link "+971 50 799 4292" [ref=e147] [cursor=pointer]:
                - /url: https://wa.me/971507994292
        - generic [ref=e148]:
          - heading "Platform" [level=3] [ref=e149]
          - list [ref=e150]:
            - listitem [ref=e151]:
              - link "Features" [ref=e152] [cursor=pointer]:
                - /url: /features
            - listitem [ref=e153]:
              - link "AI BOQ Software" [ref=e154] [cursor=pointer]:
                - /url: /ai-boq-software
            - listitem [ref=e155]:
              - link "BOQ Software" [ref=e156] [cursor=pointer]:
                - /url: /boq-software
            - listitem [ref=e157]:
              - link "Construction Estimating Software" [ref=e158] [cursor=pointer]:
                - /url: /construction-estimating-software
            - listitem [ref=e159]:
              - link "BOQ Management" [ref=e160] [cursor=pointer]:
                - /url: /boq-management
            - listitem [ref=e161]:
              - link "PDF BOQ Extraction" [ref=e162] [cursor=pointer]:
                - /url: /pdf-boq-extraction
            - listitem [ref=e163]:
              - link "Scanned PDF BOQ" [ref=e164] [cursor=pointer]:
                - /url: /scanned-pdf-boq
        - generic [ref=e165]:
          - heading "Solutions" [level=3] [ref=e166]
          - list [ref=e167]:
            - listitem [ref=e168]:
              - link "All Industries" [ref=e169] [cursor=pointer]:
                - /url: /industries
            - listitem [ref=e170]:
              - link "Contractors" [ref=e171] [cursor=pointer]:
                - /url: /boq-software-for-contractors
            - listitem [ref=e172]:
              - link "Quantity Surveyors" [ref=e173] [cursor=pointer]:
                - /url: /boq-software-for-quantity-surveyors
            - listitem [ref=e174]:
              - link "MEP Contractors" [ref=e175] [cursor=pointer]:
                - /url: /boq-software-for-mep-contractors
            - listitem [ref=e176]:
              - link "HVAC Contractors" [ref=e177] [cursor=pointer]:
                - /url: /boq-software-for-hvac-contractors
          - heading "Comparisons" [level=3] [ref=e178]
          - list [ref=e179]:
            - listitem [ref=e180]:
              - link "Comparison Hub" [ref=e181] [cursor=pointer]:
                - /url: /comparisons
            - listitem [ref=e182]:
              - link "Quantara vs Excel for BOQ" [ref=e183] [cursor=pointer]:
                - /url: /quantara-vs-excel-for-boq
            - listitem [ref=e184]:
              - link "BOQ Software vs Spreadsheets" [ref=e185] [cursor=pointer]:
                - /url: /boq-software-vs-spreadsheets
            - listitem [ref=e186]:
              - link "AI BOQ vs Manual BOQ Preparation" [ref=e187] [cursor=pointer]:
                - /url: /ai-boq-vs-manual-boq-preparation
            - listitem [ref=e188]:
              - link "OCR vs Structured BOQ Extraction" [ref=e189] [cursor=pointer]:
                - /url: /ocr-vs-structured-boq-extraction
        - generic [ref=e190]:
          - heading "Resources" [level=3] [ref=e191]
          - list [ref=e192]:
            - listitem [ref=e193]:
              - link "Resource Centre" [ref=e194] [cursor=pointer]:
                - /url: /resources
            - listitem [ref=e195]:
              - link "BOQ Calculation Formulas" [ref=e196] [cursor=pointer]:
                - /url: /boq-calculation-formulas
            - listitem [ref=e197]:
              - link "Free BOQ Calculator — External Vista By Lara Tool" [ref=e198] [cursor=pointer]:
                - /url: https://www.vistabylara.com/ai-tools/boq-calculator-uae
            - listitem [ref=e199]:
              - link "What Is a BOQ?" [ref=e200] [cursor=pointer]:
                - /url: /what-is-a-boq
            - listitem [ref=e201]:
              - link "How to Prepare a BOQ" [ref=e202] [cursor=pointer]:
                - /url: /how-to-prepare-a-boq
            - listitem [ref=e203]:
              - link "BOQ vs Construction Estimate" [ref=e204] [cursor=pointer]:
                - /url: /boq-vs-construction-estimate
            - listitem [ref=e205]:
              - link "BOQ vs Bill of Materials" [ref=e206] [cursor=pointer]:
                - /url: /boq-vs-bill-of-materials
            - listitem [ref=e207]:
              - link "BOQ Review Checklist" [ref=e208] [cursor=pointer]:
                - /url: /boq-review-checklist
        - generic [ref=e209]:
          - heading "Regional" [level=3] [ref=e210]
          - list [ref=e211]:
            - listitem [ref=e212]:
              - link "GCC BOQ Software" [ref=e213] [cursor=pointer]:
                - /url: /gcc-boq-software
            - listitem [ref=e214]:
              - link "UAE" [ref=e215] [cursor=pointer]:
                - /url: /boq-software-uae
            - listitem [ref=e216]:
              - link "Dubai" [ref=e217] [cursor=pointer]:
                - /url: /boq-software-dubai
            - listitem [ref=e218]:
              - link "Abu Dhabi" [ref=e219] [cursor=pointer]:
                - /url: /boq-software-abu-dhabi
            - listitem [ref=e220]:
              - link "UAE Construction Estimating" [ref=e221] [cursor=pointer]:
                - /url: /construction-estimating-software-uae
            - listitem [ref=e222]:
              - link "UAE MEP Estimating" [ref=e223] [cursor=pointer]:
                - /url: /mep-estimating-software-uae
            - listitem [ref=e224]:
              - link "Saudi Arabia" [ref=e225] [cursor=pointer]:
                - /url: /boq-software-saudi-arabia
        - generic [ref=e226]:
          - generic [ref=e227]:
            - heading "Enterprise Software" [level=3] [ref=e228]
            - paragraph [ref=e229]: Custom Quantara software implementation for companies requiring tailored workflows, integrations, branding, deployment, migration, onboarding or advanced operational requirements.
            - paragraph [ref=e230]: Custom implementation and onboarding starting from AED 15,000
            - paragraph [ref=e231]: Final scope and pricing are provided through a custom quotation following a requirements review.
            - link "Contact Sales →" [ref=e232] [cursor=pointer]:
              - /url: /contact-sales
          - generic [ref=e233]:
            - heading "Company" [level=3] [ref=e234]
            - list [ref=e235]:
              - listitem [ref=e236]:
                - link "About" [ref=e237] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e238]:
                - link "Contact Sales" [ref=e239] [cursor=pointer]:
                  - /url: /contact-sales
              - listitem [ref=e240]:
                - link "Request Early Access" [ref=e241] [cursor=pointer]:
                  - /url: /register
              - listitem [ref=e242]:
                - link "Security" [ref=e243] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e244]:
                - link "HTML Sitemap" [ref=e245] [cursor=pointer]:
                  - /url: /site-map
          - generic [ref=e246]:
            - heading "Legal" [level=3] [ref=e247]
            - list [ref=e248]:
              - listitem [ref=e249]:
                - link "Privacy" [ref=e250] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e251]:
                - link "Terms" [ref=e252] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e253]:
                - link "Cookie Policy" [ref=e254] [cursor=pointer]:
                  - /url: /cookie-policy
              - listitem [ref=e255]:
                - link "Data Processing" [ref=e256] [cursor=pointer]:
                  - /url: /data-processing
              - listitem [ref=e257]:
                - link "Acceptable Use" [ref=e258] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e259]:
                - link "Subprocessors" [ref=e260] [cursor=pointer]:
                  - /url: /subprocessors
      - generic [ref=e261]: © 2026 Quantara. Operated by Vista By Lara. All rights reserved.
  - alert [ref=e263]
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