# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> Public Routes Acceptance >> Route /privacy should load successfully and have no accessibility violations
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
        - heading "Privacy Policy" [level=1] [ref=e40]
        - paragraph [ref=e41]: "Last updated: August 5, 2026"
        - paragraph [ref=e42]: Quantara is a Controlled Early Access BOQ and construction-estimating platform operated by Vista By Lara.
        - paragraph [ref=e43]: This temporary Privacy Policy explains the basic categories of information that may be collected through the Quantara public website, Early Access registration and sales-enquiry processes.
        - paragraph [ref=e44]: A complete Privacy Policy will be finalized before broader commercial onboarding or routine processing of confidential customer project information.
      - generic [ref=e45]:
        - generic [ref=e46]:
          - heading "Information we may collect" [level=2] [ref=e47]
          - list [ref=e48]:
            - listitem [ref=e49]: full name;
            - listitem [ref=e50]: business email address;
            - listitem [ref=e51]: telephone number;
            - listitem [ref=e52]: company name;
            - listitem [ref=e53]: country;
            - listitem [ref=e54]: job title or professional role;
            - listitem [ref=e55]: company type;
            - listitem [ref=e56]: industry or construction discipline;
            - listitem [ref=e57]: intended use;
            - listitem [ref=e58]: approximate project or BOQ volume;
            - listitem [ref=e59]: requested input and output formats;
            - listitem [ref=e60]: preferred contact method;
            - listitem [ref=e61]: Early Access interest information;
            - listitem [ref=e62]: support, sales and security messages;
            - listitem [ref=e63]: browser, device, IP address and basic website-usage logs.
          - paragraph [ref=e65]: Do not submit confidential drawings, project specifications, commercial rates, customer records, third-party personal information or other restricted project documents through public contact forms.
        - generic [ref=e66]:
          - heading "Why information may be used" [level=2] [ref=e67]
          - list [ref=e68]:
            - listitem [ref=e69]: respond to enquiries;
            - listitem [ref=e70]: evaluate Early Access applications;
            - listitem [ref=e71]: provide product demonstrations;
            - listitem [ref=e72]: understand BOQ and estimating needs;
            - listitem [ref=e73]: provide support;
            - listitem [ref=e74]: improve the public website;
            - listitem [ref=e75]: protect the website from abuse;
            - listitem [ref=e76]: comply with applicable obligations.
        - generic [ref=e77]:
          - heading "Early Access accounts" [level=2] [ref=e78]
          - paragraph [ref=e79]: Creating an Early Access account does not begin a paid subscription, automatic renewal or automatic billing.
          - paragraph [ref=e80]: Access may be limited according to product readiness, supported formats, onboarding capacity and intended use.
        - generic [ref=e81]:
          - heading "Project documents" [level=2] [ref=e82]
          - paragraph [ref=e83]: Approved users may later be able to upload project documents through authenticated product areas.
          - paragraph [ref=e84]: Users are responsible for ensuring they have the rights and lawful authority to upload and process client drawings, specifications, BOQ files, supplier information, pricing information, templates, project records and third-party information.
          - paragraph [ref=e85]: Users should not upload confidential or restricted project information until their organisation has reviewed and accepted the applicable final legal and data-processing terms.
        - generic [ref=e86]:
          - heading "Service providers" [level=2] [ref=e87]
          - paragraph [ref=e88]: Vista By Lara may use service providers for website hosting, databases, authentication, communications, analytics, security monitoring and technical operations.
          - paragraph [ref=e89]: Do not name specific providers unless they have been verified and approved for publication.
        - generic [ref=e90]:
          - heading "Data retention" [level=2] [ref=e91]
          - paragraph [ref=e92]: Enquiry, registration and support information may be retained for as long as reasonably necessary to manage Early Access participation, respond to requests, maintain operational and security records and comply with applicable obligations.
        - generic [ref=e93]:
          - heading "Data sharing" [level=2] [ref=e94]
          - paragraph [ref=e95]: Vista By Lara does not sell personal information submitted through the Quantara website. Information may be disclosed to service providers acting on our behalf, professional advisers or authorities where reasonably required for operational, security or legal purposes.
        - generic [ref=e96]:
          - heading "Correction and deletion requests" [level=2] [ref=e97]
          - paragraph [ref=e98]: Users may request correction or deletion of submitted personal information, subject to applicable legal, security, technical and record-keeping requirements.
        - generic [ref=e99]:
          - heading "Security" [level=2] [ref=e100]
          - paragraph [ref=e101]: Quantara uses authenticated access controls for protected product areas. Additional security, retention and data-processing documentation is being finalized for Controlled Early Access.
        - generic [ref=e102]:
          - heading "International processing" [level=2] [ref=e103]
          - paragraph [ref=e104]: Website and operational service providers may process information in countries other than the user’s country.
          - paragraph [ref=e105]: Additional information will be provided in the complete Privacy Policy and data-processing documentation.
        - generic [ref=e106]:
          - heading "Children" [level=2] [ref=e107]
          - paragraph [ref=e108]: Quantara is intended for business and professional users and is not directed to children.
        - generic [ref=e109]:
          - heading "Contact" [level=2] [ref=e110]
          - generic [ref=e111]:
            - list [ref=e112]:
              - listitem [ref=e113]:
                - strong [ref=e114]: "Email:"
                - link "solution@vistabylara.com" [ref=e115] [cursor=pointer]:
                  - /url: mailto:solution@vistabylara.com
              - listitem [ref=e116]:
                - strong [ref=e117]: "Telephone:"
                - link "+971 50 799 4292" [ref=e118] [cursor=pointer]:
                  - /url: tel:+971507994292
              - listitem [ref=e119]:
                - strong [ref=e120]: "WhatsApp:"
                - link "+971 50 799 4292" [ref=e121] [cursor=pointer]:
                  - /url: https://wa.me/971507994292
            - paragraph [ref=e122]: Support requests can be submitted 24 hours a day. Response times may vary during Controlled Early Access.
  - generic [ref=e124]:
    - generic [ref=e125]:
      - generic [ref=e126]:
        - link "Quantara Home" [ref=e127] [cursor=pointer]:
          - /url: /
          - img "Quantara Logo" [ref=e128]
          - text: Quantara
        - paragraph [ref=e129]: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
        - paragraph [ref=e130]: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
        - generic [ref=e131]:
          - paragraph [ref=e132]:
            - text: "Email:"
            - link "solution@vistabylara.com" [ref=e133] [cursor=pointer]:
              - /url: mailto:solution@vistabylara.com
          - paragraph [ref=e134]:
            - text: "Telephone:"
            - link "+971 50 799 4292" [ref=e135] [cursor=pointer]:
              - /url: tel:+971507994292
          - paragraph [ref=e136]:
            - text: "WhatsApp:"
            - link "+971 50 799 4292" [ref=e137] [cursor=pointer]:
              - /url: https://wa.me/971507994292
      - generic [ref=e138]:
        - heading "Platform" [level=3] [ref=e139]
        - list [ref=e140]:
          - listitem [ref=e141]:
            - link "Features" [ref=e142] [cursor=pointer]:
              - /url: /features
          - listitem [ref=e143]:
            - link "AI BOQ Software" [ref=e144] [cursor=pointer]:
              - /url: /ai-boq-software
          - listitem [ref=e145]:
            - link "BOQ Software" [ref=e146] [cursor=pointer]:
              - /url: /boq-software
          - listitem [ref=e147]:
            - link "Construction Estimating Software" [ref=e148] [cursor=pointer]:
              - /url: /construction-estimating-software
          - listitem [ref=e149]:
            - link "BOQ Management" [ref=e150] [cursor=pointer]:
              - /url: /boq-management
          - listitem [ref=e151]:
            - link "PDF BOQ Extraction" [ref=e152] [cursor=pointer]:
              - /url: /pdf-boq-extraction
          - listitem [ref=e153]:
            - link "Scanned PDF BOQ" [ref=e154] [cursor=pointer]:
              - /url: /scanned-pdf-boq
      - generic [ref=e155]:
        - heading "Solutions" [level=3] [ref=e156]
        - list [ref=e157]:
          - listitem [ref=e158]:
            - link "All Industries" [ref=e159] [cursor=pointer]:
              - /url: /industries
          - listitem [ref=e160]:
            - link "Contractors" [ref=e161] [cursor=pointer]:
              - /url: /boq-software-for-contractors
          - listitem [ref=e162]:
            - link "Quantity Surveyors" [ref=e163] [cursor=pointer]:
              - /url: /boq-software-for-quantity-surveyors
          - listitem [ref=e164]:
            - link "MEP Contractors" [ref=e165] [cursor=pointer]:
              - /url: /boq-software-for-mep-contractors
          - listitem [ref=e166]:
            - link "HVAC Contractors" [ref=e167] [cursor=pointer]:
              - /url: /boq-software-for-hvac-contractors
        - heading "Comparisons" [level=3] [ref=e168]
        - list [ref=e169]:
          - listitem [ref=e170]:
            - link "Comparison Hub" [ref=e171] [cursor=pointer]:
              - /url: /comparisons
          - listitem [ref=e172]:
            - link "Quantara vs Excel for BOQ" [ref=e173] [cursor=pointer]:
              - /url: /quantara-vs-excel-for-boq
          - listitem [ref=e174]:
            - link "BOQ Software vs Spreadsheets" [ref=e175] [cursor=pointer]:
              - /url: /boq-software-vs-spreadsheets
          - listitem [ref=e176]:
            - link "AI BOQ vs Manual BOQ Preparation" [ref=e177] [cursor=pointer]:
              - /url: /ai-boq-vs-manual-boq-preparation
          - listitem [ref=e178]:
            - link "OCR vs Structured BOQ Extraction" [ref=e179] [cursor=pointer]:
              - /url: /ocr-vs-structured-boq-extraction
      - generic [ref=e180]:
        - heading "Resources" [level=3] [ref=e181]
        - list [ref=e182]:
          - listitem [ref=e183]:
            - link "Resource Centre" [ref=e184] [cursor=pointer]:
              - /url: /resources
          - listitem [ref=e185]:
            - link "BOQ Calculation Formulas" [ref=e186] [cursor=pointer]:
              - /url: /boq-calculation-formulas
          - listitem [ref=e187]:
            - link "Free BOQ Calculator — External Vista By Lara Tool" [ref=e188] [cursor=pointer]:
              - /url: https://www.vistabylara.com/ai-tools/boq-calculator-uae
          - listitem [ref=e189]:
            - link "What Is a BOQ?" [ref=e190] [cursor=pointer]:
              - /url: /what-is-a-boq
          - listitem [ref=e191]:
            - link "How to Prepare a BOQ" [ref=e192] [cursor=pointer]:
              - /url: /how-to-prepare-a-boq
          - listitem [ref=e193]:
            - link "BOQ vs Construction Estimate" [ref=e194] [cursor=pointer]:
              - /url: /boq-vs-construction-estimate
          - listitem [ref=e195]:
            - link "BOQ vs Bill of Materials" [ref=e196] [cursor=pointer]:
              - /url: /boq-vs-bill-of-materials
          - listitem [ref=e197]:
            - link "BOQ Review Checklist" [ref=e198] [cursor=pointer]:
              - /url: /boq-review-checklist
      - generic [ref=e199]:
        - heading "Regional" [level=3] [ref=e200]
        - list [ref=e201]:
          - listitem [ref=e202]:
            - link "GCC BOQ Software" [ref=e203] [cursor=pointer]:
              - /url: /gcc-boq-software
          - listitem [ref=e204]:
            - link "UAE" [ref=e205] [cursor=pointer]:
              - /url: /boq-software-uae
          - listitem [ref=e206]:
            - link "Dubai" [ref=e207] [cursor=pointer]:
              - /url: /boq-software-dubai
          - listitem [ref=e208]:
            - link "Abu Dhabi" [ref=e209] [cursor=pointer]:
              - /url: /boq-software-abu-dhabi
          - listitem [ref=e210]:
            - link "UAE Construction Estimating" [ref=e211] [cursor=pointer]:
              - /url: /construction-estimating-software-uae
          - listitem [ref=e212]:
            - link "UAE MEP Estimating" [ref=e213] [cursor=pointer]:
              - /url: /mep-estimating-software-uae
          - listitem [ref=e214]:
            - link "Saudi Arabia" [ref=e215] [cursor=pointer]:
              - /url: /boq-software-saudi-arabia
      - generic [ref=e216]:
        - generic [ref=e217]:
          - heading "Enterprise Software" [level=3] [ref=e218]
          - paragraph [ref=e219]: Custom Quantara software implementation for companies requiring tailored workflows, integrations, branding, deployment, migration, onboarding or advanced operational requirements.
          - paragraph [ref=e220]: Custom implementation and onboarding starting from AED 15,000
          - paragraph [ref=e221]: Final scope and pricing are provided through a custom quotation following a requirements review.
          - link "Contact Sales →" [ref=e222] [cursor=pointer]:
            - /url: /contact-sales
        - generic [ref=e223]:
          - heading "Company" [level=3] [ref=e224]
          - list [ref=e225]:
            - listitem [ref=e226]:
              - link "About" [ref=e227] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e228]:
              - link "Contact Sales" [ref=e229] [cursor=pointer]:
                - /url: /contact-sales
            - listitem [ref=e230]:
              - link "Request Early Access" [ref=e231] [cursor=pointer]:
                - /url: /register
            - listitem [ref=e232]:
              - link "Security" [ref=e233] [cursor=pointer]:
                - /url: /security
            - listitem [ref=e234]:
              - link "HTML Sitemap" [ref=e235] [cursor=pointer]:
                - /url: /site-map
        - generic [ref=e236]:
          - heading "Legal" [level=3] [ref=e237]
          - list [ref=e238]:
            - listitem [ref=e239]:
              - link "Privacy" [ref=e240] [cursor=pointer]:
                - /url: /privacy
            - listitem [ref=e241]:
              - link "Terms" [ref=e242] [cursor=pointer]:
                - /url: /terms
            - listitem [ref=e243]:
              - link "Cookie Policy" [ref=e244] [cursor=pointer]:
                - /url: /cookie-policy
            - listitem [ref=e245]:
              - link "Data Processing" [ref=e246] [cursor=pointer]:
                - /url: /data-processing
            - listitem [ref=e247]:
              - link "Acceptable Use" [ref=e248] [cursor=pointer]:
                - /url: /acceptable-use
            - listitem [ref=e249]:
              - link "Subprocessors" [ref=e250] [cursor=pointer]:
                - /url: /subprocessors
    - generic [ref=e251]: © 2026 Quantara. Operated by Vista By Lara. All rights reserved.
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