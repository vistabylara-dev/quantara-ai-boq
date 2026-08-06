# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> Public Routes Acceptance >> Route /terms should load successfully and have no accessibility violations
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
        - heading "Terms of Controlled Early Access" [level=1] [ref=e40]
        - paragraph [ref=e41]: "Last updated: August 5, 2026"
        - paragraph [ref=e42]: These temporary Terms apply to use of the Quantara public website and participation in the Quantara Controlled Early Access programme.
        - paragraph [ref=e43]: A complete Terms of Service agreement will be finalized before broader commercial use.
      - generic [ref=e44]:
        - generic [ref=e45]:
          - heading "Product status" [level=2] [ref=e46]
          - paragraph [ref=e47]: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
          - paragraph [ref=e48]: Features may be incomplete, changed, limited, interrupted or removed during this stage.
          - paragraph [ref=e49]: "Feature status may be shown as:"
          - list [ref=e50]:
            - listitem [ref=e51]: Live;
            - listitem [ref=e52]: Preview UI;
            - listitem [ref=e53]: In Development;
            - listitem [ref=e54]: Planned.
        - generic [ref=e55]:
          - heading "No paid subscription" [level=2] [ref=e56]
          - paragraph [ref=e57]: Creating an Early Access account does not begin a paid subscription, automatic renewal or automatic billing.
          - paragraph [ref=e58]: Commercial plans, usage limits and payment terms will be provided separately before any paid service begins.
        - generic [ref=e59]:
          - heading "Professional review required" [level=2] [ref=e60]
          - generic [ref=e61]:
            - paragraph [ref=e62]: Quantara assists with document extraction, BOQ organization, project information, templates and supported document-generation workflows. It does not replace a qualified quantity surveyor, estimator, engineer, architect, project manager, commercial manager, procurement professional, legal adviser or responsible project professional.
            - paragraph [ref=e63]: All extracted information, quantities, units, descriptions, specifications, rates, prices, assumptions, exclusions and generated documents must be independently reviewed before tender, procurement, commercial, contractual or construction use.
        - generic [ref=e64]:
          - heading "No guarantee of accuracy" [level=2] [ref=e65]
          - paragraph [ref=e66]: "Early Access output may contain:"
          - list [ref=e67]:
            - listitem [ref=e68]: extraction errors;
            - listitem [ref=e69]: OCR errors;
            - listitem [ref=e70]: omissions;
            - listitem [ref=e71]: duplicated items;
            - listitem [ref=e72]: incorrect grouping;
            - listitem [ref=e73]: incorrect quantities;
            - listitem [ref=e74]: formatting problems;
            - listitem [ref=e75]: incomplete descriptions;
            - listitem [ref=e76]: misinterpreted specifications.
        - generic [ref=e77]:
          - heading "Supported formats" [level=2] [ref=e78]
          - paragraph [ref=e79]: Only formats expressly marked Live should be treated as currently supported.
          - paragraph [ref=e80]: CAD, BIM, IFC, DWG, Revit, visual quantity takeoff, drawing-scale measurement and automatic floor-plan interpretation must not be assumed to be available unless explicitly confirmed as Live.
        - generic [ref=e81]:
          - heading "User responsibilities" [level=2] [ref=e82]
          - paragraph [ref=e83]: "Users must:"
          - list [ref=e84]:
            - listitem [ref=e85]: provide accurate account and company information;
            - listitem [ref=e86]: protect their credentials;
            - listitem [ref=e87]: use Quantara lawfully;
            - listitem [ref=e88]: upload only authorized content;
            - listitem [ref=e89]: avoid uploading malware;
            - listitem [ref=e90]: professionally review all outputs;
            - listitem [ref=e91]: respect confidentiality and intellectual property;
            - listitem [ref=e92]: avoid presenting unreviewed output as certified professional work.
        - generic [ref=e93]:
          - heading "Ownership and authority" [level=2] [ref=e94]
          - paragraph [ref=e95]: Users retain responsibility for information and documents they submit.
          - paragraph [ref=e96]: Users must hold the rights or authority necessary to upload client drawings, specifications, supplier information, prices, templates and other project records.
        - generic [ref=e97]:
          - heading "Availability" [level=2] [ref=e98]
          - paragraph [ref=e99]: Early Access availability is not guaranteed.
          - paragraph [ref=e100]: Quantara may suspend, limit or change access for maintenance, security, abuse prevention, technical issues, operational reasons or product changes.
        - generic [ref=e101]:
          - heading "Prohibited use" [level=2] [ref=e102]
          - paragraph [ref=e103]: "Users must not:"
          - list [ref=e104]:
            - listitem [ref=e105]: attempt unauthorized access;
            - listitem [ref=e106]: interfere with service operation;
            - listitem [ref=e107]: upload malicious code;
            - listitem [ref=e108]: violate privacy or intellectual-property rights;
            - listitem [ref=e109]: submit unlawful content;
            - listitem [ref=e110]: misrepresent unreviewed output;
            - listitem [ref=e111]: attempt to extract protected credentials or source code unlawfully.
        - generic [ref=e112]:
          - heading "Reliance limitation" [level=2] [ref=e113]
          - paragraph [ref=e114]: Do not rely exclusively on Quantara for tender submission, pricing, procurement, contractual commitments, project valuation, payment certification, construction execution or regulatory compliance. Independent professional review is required.
        - generic [ref=e115]:
          - heading "Contact" [level=2] [ref=e116]
          - list [ref=e118]:
            - listitem [ref=e119]:
              - strong [ref=e120]: "Email:"
              - link "solution@vistabylara.com" [ref=e121] [cursor=pointer]:
                - /url: mailto:solution@vistabylara.com
            - listitem [ref=e122]:
              - strong [ref=e123]: "Telephone:"
              - link "+971 50 799 4292" [ref=e124] [cursor=pointer]:
                - /url: tel:+971507994292
            - listitem [ref=e125]:
              - strong [ref=e126]: "WhatsApp:"
              - link "+971 50 799 4292" [ref=e127] [cursor=pointer]:
                - /url: https://wa.me/971507994292
  - generic [ref=e129]:
    - generic [ref=e130]:
      - generic [ref=e131]:
        - link "Quantara Home" [ref=e132] [cursor=pointer]:
          - /url: /
          - img "Quantara Logo" [ref=e133]
          - text: Quantara
        - paragraph [ref=e134]: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
        - paragraph [ref=e135]: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
        - generic [ref=e136]:
          - paragraph [ref=e137]:
            - text: "Email:"
            - link "solution@vistabylara.com" [ref=e138] [cursor=pointer]:
              - /url: mailto:solution@vistabylara.com
          - paragraph [ref=e139]:
            - text: "Telephone:"
            - link "+971 50 799 4292" [ref=e140] [cursor=pointer]:
              - /url: tel:+971507994292
          - paragraph [ref=e141]:
            - text: "WhatsApp:"
            - link "+971 50 799 4292" [ref=e142] [cursor=pointer]:
              - /url: https://wa.me/971507994292
      - generic [ref=e143]:
        - heading "Platform" [level=3] [ref=e144]
        - list [ref=e145]:
          - listitem [ref=e146]:
            - link "Features" [ref=e147] [cursor=pointer]:
              - /url: /features
          - listitem [ref=e148]:
            - link "AI BOQ Software" [ref=e149] [cursor=pointer]:
              - /url: /ai-boq-software
          - listitem [ref=e150]:
            - link "BOQ Software" [ref=e151] [cursor=pointer]:
              - /url: /boq-software
          - listitem [ref=e152]:
            - link "Construction Estimating Software" [ref=e153] [cursor=pointer]:
              - /url: /construction-estimating-software
          - listitem [ref=e154]:
            - link "BOQ Management" [ref=e155] [cursor=pointer]:
              - /url: /boq-management
          - listitem [ref=e156]:
            - link "PDF BOQ Extraction" [ref=e157] [cursor=pointer]:
              - /url: /pdf-boq-extraction
          - listitem [ref=e158]:
            - link "Scanned PDF BOQ" [ref=e159] [cursor=pointer]:
              - /url: /scanned-pdf-boq
      - generic [ref=e160]:
        - heading "Solutions" [level=3] [ref=e161]
        - list [ref=e162]:
          - listitem [ref=e163]:
            - link "All Industries" [ref=e164] [cursor=pointer]:
              - /url: /industries
          - listitem [ref=e165]:
            - link "Contractors" [ref=e166] [cursor=pointer]:
              - /url: /boq-software-for-contractors
          - listitem [ref=e167]:
            - link "Quantity Surveyors" [ref=e168] [cursor=pointer]:
              - /url: /boq-software-for-quantity-surveyors
          - listitem [ref=e169]:
            - link "MEP Contractors" [ref=e170] [cursor=pointer]:
              - /url: /boq-software-for-mep-contractors
          - listitem [ref=e171]:
            - link "HVAC Contractors" [ref=e172] [cursor=pointer]:
              - /url: /boq-software-for-hvac-contractors
        - heading "Comparisons" [level=3] [ref=e173]
        - list [ref=e174]:
          - listitem [ref=e175]:
            - link "Comparison Hub" [ref=e176] [cursor=pointer]:
              - /url: /comparisons
          - listitem [ref=e177]:
            - link "Quantara vs Excel for BOQ" [ref=e178] [cursor=pointer]:
              - /url: /quantara-vs-excel-for-boq
          - listitem [ref=e179]:
            - link "BOQ Software vs Spreadsheets" [ref=e180] [cursor=pointer]:
              - /url: /boq-software-vs-spreadsheets
          - listitem [ref=e181]:
            - link "AI BOQ vs Manual BOQ Preparation" [ref=e182] [cursor=pointer]:
              - /url: /ai-boq-vs-manual-boq-preparation
          - listitem [ref=e183]:
            - link "OCR vs Structured BOQ Extraction" [ref=e184] [cursor=pointer]:
              - /url: /ocr-vs-structured-boq-extraction
      - generic [ref=e185]:
        - heading "Resources" [level=3] [ref=e186]
        - list [ref=e187]:
          - listitem [ref=e188]:
            - link "Resource Centre" [ref=e189] [cursor=pointer]:
              - /url: /resources
          - listitem [ref=e190]:
            - link "BOQ Calculation Formulas" [ref=e191] [cursor=pointer]:
              - /url: /boq-calculation-formulas
          - listitem [ref=e192]:
            - link "Free BOQ Calculator — External Vista By Lara Tool" [ref=e193] [cursor=pointer]:
              - /url: https://www.vistabylara.com/ai-tools/boq-calculator-uae
          - listitem [ref=e194]:
            - link "What Is a BOQ?" [ref=e195] [cursor=pointer]:
              - /url: /what-is-a-boq
          - listitem [ref=e196]:
            - link "How to Prepare a BOQ" [ref=e197] [cursor=pointer]:
              - /url: /how-to-prepare-a-boq
          - listitem [ref=e198]:
            - link "BOQ vs Construction Estimate" [ref=e199] [cursor=pointer]:
              - /url: /boq-vs-construction-estimate
          - listitem [ref=e200]:
            - link "BOQ vs Bill of Materials" [ref=e201] [cursor=pointer]:
              - /url: /boq-vs-bill-of-materials
          - listitem [ref=e202]:
            - link "BOQ Review Checklist" [ref=e203] [cursor=pointer]:
              - /url: /boq-review-checklist
      - generic [ref=e204]:
        - heading "Regional" [level=3] [ref=e205]
        - list [ref=e206]:
          - listitem [ref=e207]:
            - link "GCC BOQ Software" [ref=e208] [cursor=pointer]:
              - /url: /gcc-boq-software
          - listitem [ref=e209]:
            - link "UAE" [ref=e210] [cursor=pointer]:
              - /url: /boq-software-uae
          - listitem [ref=e211]:
            - link "Dubai" [ref=e212] [cursor=pointer]:
              - /url: /boq-software-dubai
          - listitem [ref=e213]:
            - link "Abu Dhabi" [ref=e214] [cursor=pointer]:
              - /url: /boq-software-abu-dhabi
          - listitem [ref=e215]:
            - link "UAE Construction Estimating" [ref=e216] [cursor=pointer]:
              - /url: /construction-estimating-software-uae
          - listitem [ref=e217]:
            - link "UAE MEP Estimating" [ref=e218] [cursor=pointer]:
              - /url: /mep-estimating-software-uae
          - listitem [ref=e219]:
            - link "Saudi Arabia" [ref=e220] [cursor=pointer]:
              - /url: /boq-software-saudi-arabia
      - generic [ref=e221]:
        - generic [ref=e222]:
          - heading "Enterprise Software" [level=3] [ref=e223]
          - paragraph [ref=e224]: Custom Quantara software implementation for companies requiring tailored workflows, integrations, branding, deployment, migration, onboarding or advanced operational requirements.
          - paragraph [ref=e225]: Custom implementation and onboarding starting from AED 15,000
          - paragraph [ref=e226]: Final scope and pricing are provided through a custom quotation following a requirements review.
          - link "Contact Sales →" [ref=e227] [cursor=pointer]:
            - /url: /contact-sales
        - generic [ref=e228]:
          - heading "Company" [level=3] [ref=e229]
          - list [ref=e230]:
            - listitem [ref=e231]:
              - link "About" [ref=e232] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e233]:
              - link "Contact Sales" [ref=e234] [cursor=pointer]:
                - /url: /contact-sales
            - listitem [ref=e235]:
              - link "Request Early Access" [ref=e236] [cursor=pointer]:
                - /url: /register
            - listitem [ref=e237]:
              - link "Security" [ref=e238] [cursor=pointer]:
                - /url: /security
            - listitem [ref=e239]:
              - link "HTML Sitemap" [ref=e240] [cursor=pointer]:
                - /url: /site-map
        - generic [ref=e241]:
          - heading "Legal" [level=3] [ref=e242]
          - list [ref=e243]:
            - listitem [ref=e244]:
              - link "Privacy" [ref=e245] [cursor=pointer]:
                - /url: /privacy
            - listitem [ref=e246]:
              - link "Terms" [ref=e247] [cursor=pointer]:
                - /url: /terms
            - listitem [ref=e248]:
              - link "Cookie Policy" [ref=e249] [cursor=pointer]:
                - /url: /cookie-policy
            - listitem [ref=e250]:
              - link "Data Processing" [ref=e251] [cursor=pointer]:
                - /url: /data-processing
            - listitem [ref=e252]:
              - link "Acceptable Use" [ref=e253] [cursor=pointer]:
                - /url: /acceptable-use
            - listitem [ref=e254]:
              - link "Subprocessors" [ref=e255] [cursor=pointer]:
                - /url: /subprocessors
    - generic [ref=e256]: © 2026 Quantara. Operated by Vista By Lara. All rights reserved.
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