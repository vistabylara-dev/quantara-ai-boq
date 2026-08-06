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
      - generic [ref=e37]:
        - link "← Back to Home" [ref=e39] [cursor=pointer]:
          - /url: /
        - generic [ref=e40]:
          - generic [ref=e41]:
            - heading "Contact Sales" [level=1] [ref=e42]
            - paragraph [ref=e43]: Tell us about your BOQ workflow, project-document formats, team requirements and Early Access needs.
            - generic [ref=e44]:
              - heading "Talk to the Quantara Team" [level=3] [ref=e45]
              - list [ref=e46]:
                - listitem [ref=e47]:
                  - strong [ref=e48]: "Email:"
                  - link "solution@vistabylara.com" [ref=e49] [cursor=pointer]:
                    - /url: mailto:solution@vistabylara.com
                - listitem [ref=e50]:
                  - strong [ref=e51]: "Telephone:"
                  - link "+971 50 799 4292" [ref=e52] [cursor=pointer]:
                    - /url: tel:+971507994292
                - listitem [ref=e53]:
                  - strong [ref=e54]: "WhatsApp:"
                  - link "+971 50 799 4292" [ref=e55] [cursor=pointer]:
                    - /url: https://wa.me/971507994292
              - paragraph [ref=e56]: Sales and support requests can be submitted 24 hours a day. Response times may vary during Controlled Early Access.
            - generic [ref=e57]:
              - heading "Why contact sales?" [level=3] [ref=e58]
              - list [ref=e59]:
                - listitem [ref=e60]: Discuss your current BOQ process
                - listitem [ref=e61]: Review supported input and output requirements
                - listitem [ref=e62]: Request an Early Access product walkthrough
                - listitem [ref=e63]: Share team and project-volume requirements
          - generic [ref=e64]:
            - heading "Talk to an Expert" [level=2] [ref=e65]
            - generic [ref=e66]:
              - generic [ref=e67]:
                - generic [ref=e68]:
                  - generic [ref=e69]: Full name
                  - textbox "Full name" [ref=e70]
                - generic [ref=e71]:
                  - generic [ref=e72]: Business email
                  - textbox "Business email" [ref=e73]
              - generic [ref=e74]:
                - generic [ref=e75]:
                  - generic [ref=e76]: Company name
                  - textbox "Company name" [ref=e77]
                - generic [ref=e78]:
                  - generic [ref=e79]: Country
                  - textbox "Country" [ref=e80]
              - generic [ref=e81]:
                - generic [ref=e82]:
                  - generic [ref=e83]: Role
                  - textbox "Role" [ref=e84]
                - generic [ref=e85]:
                  - generic [ref=e86]: Company type
                  - combobox "Company type" [ref=e87]:
                    - option "Main Contractor" [selected]
                    - option "Subcontractor"
                    - option "Consultancy"
                    - option "Developer"
                    - option "Other"
              - generic [ref=e88]:
                - generic [ref=e89]:
                  - generic [ref=e90]: Construction discipline
                  - textbox "Construction discipline" [ref=e91]
                - generic [ref=e92]:
                  - generic [ref=e93]: Approximate monthly BOQ volume
                  - textbox "Approximate monthly BOQ volume" [ref=e94]: 1-5
              - generic [ref=e95]:
                - generic [ref=e96]: Current BOQ process
                - textbox "Current BOQ process" [ref=e97]
              - generic [ref=e98]:
                - generic [ref=e99]:
                  - generic [ref=e100]: Required input formats
                  - textbox "Required input formats" [ref=e101]
                - generic [ref=e102]:
                  - generic [ref=e103]: Required output formats
                  - textbox "Required output formats" [ref=e104]
              - generic [ref=e105]:
                - generic [ref=e106]:
                  - generic [ref=e107]: Number of intended users
                  - textbox "Number of intended users" [ref=e108]: 1-5
                - generic [ref=e109]:
                  - generic [ref=e110]: Preferred contact method
                  - combobox "Preferred Contact Method" [ref=e111]:
                    - option "Email" [selected]
                    - option "Phone"
                    - option "WhatsApp"
              - generic [ref=e112]:
                - generic [ref=e113]: Message
                - textbox "Message" [ref=e114]
              - generic [ref=e115]:
                - 'checkbox "Privacy consent: I agree that Quantara may process my information to respond to this request." [ref=e116]'
                - generic [ref=e117]: "Privacy consent: I agree that Quantara may process my information to respond to this request."
              - button "Talk to an Expert" [ref=e118] [cursor=pointer]
              - paragraph [ref=e120]:
                - text: We use the information you provide to review your request and contact you about Quantara. Do not submit confidential project documents through this form.
                - link "Read our Privacy Policy" [ref=e121] [cursor=pointer]:
                  - /url: /privacy
                - text: .
    - generic [ref=e123]:
      - generic [ref=e124]:
        - generic [ref=e125]:
          - link "Quantara Home" [ref=e126] [cursor=pointer]:
            - /url: /
            - img "Quantara Logo" [ref=e127]
            - text: Quantara
          - paragraph [ref=e128]: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
          - paragraph [ref=e129]: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
          - generic [ref=e130]:
            - paragraph [ref=e131]:
              - text: "Email:"
              - link "solution@vistabylara.com" [ref=e132] [cursor=pointer]:
                - /url: mailto:solution@vistabylara.com
            - paragraph [ref=e133]:
              - text: "Telephone:"
              - link "+971 50 799 4292" [ref=e134] [cursor=pointer]:
                - /url: tel:+971507994292
            - paragraph [ref=e135]:
              - text: "WhatsApp:"
              - link "+971 50 799 4292" [ref=e136] [cursor=pointer]:
                - /url: https://wa.me/971507994292
        - generic [ref=e137]:
          - heading "Platform" [level=3] [ref=e138]
          - list [ref=e139]:
            - listitem [ref=e140]:
              - link "Features" [ref=e141] [cursor=pointer]:
                - /url: /features
            - listitem [ref=e142]:
              - link "AI BOQ Software" [ref=e143] [cursor=pointer]:
                - /url: /ai-boq-software
            - listitem [ref=e144]:
              - link "BOQ Software" [ref=e145] [cursor=pointer]:
                - /url: /boq-software
            - listitem [ref=e146]:
              - link "Construction Estimating Software" [ref=e147] [cursor=pointer]:
                - /url: /construction-estimating-software
            - listitem [ref=e148]:
              - link "BOQ Management" [ref=e149] [cursor=pointer]:
                - /url: /boq-management
            - listitem [ref=e150]:
              - link "PDF BOQ Extraction" [ref=e151] [cursor=pointer]:
                - /url: /pdf-boq-extraction
            - listitem [ref=e152]:
              - link "Scanned PDF BOQ" [ref=e153] [cursor=pointer]:
                - /url: /scanned-pdf-boq
        - generic [ref=e154]:
          - heading "Solutions" [level=3] [ref=e155]
          - list [ref=e156]:
            - listitem [ref=e157]:
              - link "All Industries" [ref=e158] [cursor=pointer]:
                - /url: /industries
            - listitem [ref=e159]:
              - link "Contractors" [ref=e160] [cursor=pointer]:
                - /url: /boq-software-for-contractors
            - listitem [ref=e161]:
              - link "Quantity Surveyors" [ref=e162] [cursor=pointer]:
                - /url: /boq-software-for-quantity-surveyors
            - listitem [ref=e163]:
              - link "MEP Contractors" [ref=e164] [cursor=pointer]:
                - /url: /boq-software-for-mep-contractors
            - listitem [ref=e165]:
              - link "HVAC Contractors" [ref=e166] [cursor=pointer]:
                - /url: /boq-software-for-hvac-contractors
          - heading "Comparisons" [level=3] [ref=e167]
          - list [ref=e168]:
            - listitem [ref=e169]:
              - link "Comparison Hub" [ref=e170] [cursor=pointer]:
                - /url: /comparisons
            - listitem [ref=e171]:
              - link "Quantara vs Excel for BOQ" [ref=e172] [cursor=pointer]:
                - /url: /quantara-vs-excel-for-boq
            - listitem [ref=e173]:
              - link "BOQ Software vs Spreadsheets" [ref=e174] [cursor=pointer]:
                - /url: /boq-software-vs-spreadsheets
            - listitem [ref=e175]:
              - link "AI BOQ vs Manual BOQ Preparation" [ref=e176] [cursor=pointer]:
                - /url: /ai-boq-vs-manual-boq-preparation
            - listitem [ref=e177]:
              - link "OCR vs Structured BOQ Extraction" [ref=e178] [cursor=pointer]:
                - /url: /ocr-vs-structured-boq-extraction
        - generic [ref=e179]:
          - heading "Resources" [level=3] [ref=e180]
          - list [ref=e181]:
            - listitem [ref=e182]:
              - link "Resource Centre" [ref=e183] [cursor=pointer]:
                - /url: /resources
            - listitem [ref=e184]:
              - link "BOQ Calculation Formulas" [ref=e185] [cursor=pointer]:
                - /url: /boq-calculation-formulas
            - listitem [ref=e186]:
              - link "Free BOQ Calculator — External Vista By Lara Tool" [ref=e187] [cursor=pointer]:
                - /url: https://www.vistabylara.com/ai-tools/boq-calculator-uae
            - listitem [ref=e188]:
              - link "What Is a BOQ?" [ref=e189] [cursor=pointer]:
                - /url: /what-is-a-boq
            - listitem [ref=e190]:
              - link "How to Prepare a BOQ" [ref=e191] [cursor=pointer]:
                - /url: /how-to-prepare-a-boq
            - listitem [ref=e192]:
              - link "BOQ vs Construction Estimate" [ref=e193] [cursor=pointer]:
                - /url: /boq-vs-construction-estimate
            - listitem [ref=e194]:
              - link "BOQ vs Bill of Materials" [ref=e195] [cursor=pointer]:
                - /url: /boq-vs-bill-of-materials
            - listitem [ref=e196]:
              - link "BOQ Review Checklist" [ref=e197] [cursor=pointer]:
                - /url: /boq-review-checklist
        - generic [ref=e198]:
          - heading "Regional" [level=3] [ref=e199]
          - list [ref=e200]:
            - listitem [ref=e201]:
              - link "GCC BOQ Software" [ref=e202] [cursor=pointer]:
                - /url: /gcc-boq-software
            - listitem [ref=e203]:
              - link "UAE" [ref=e204] [cursor=pointer]:
                - /url: /boq-software-uae
            - listitem [ref=e205]:
              - link "Dubai" [ref=e206] [cursor=pointer]:
                - /url: /boq-software-dubai
            - listitem [ref=e207]:
              - link "Abu Dhabi" [ref=e208] [cursor=pointer]:
                - /url: /boq-software-abu-dhabi
            - listitem [ref=e209]:
              - link "UAE Construction Estimating" [ref=e210] [cursor=pointer]:
                - /url: /construction-estimating-software-uae
            - listitem [ref=e211]:
              - link "UAE MEP Estimating" [ref=e212] [cursor=pointer]:
                - /url: /mep-estimating-software-uae
            - listitem [ref=e213]:
              - link "Saudi Arabia" [ref=e214] [cursor=pointer]:
                - /url: /boq-software-saudi-arabia
        - generic [ref=e215]:
          - generic [ref=e216]:
            - heading "Enterprise Software" [level=3] [ref=e217]
            - paragraph [ref=e218]: Custom Quantara software implementation for companies requiring tailored workflows, integrations, branding, deployment, migration, onboarding or advanced operational requirements.
            - paragraph [ref=e219]: Custom implementation and onboarding starting from AED 15,000
            - paragraph [ref=e220]: Final scope and pricing are provided through a custom quotation following a requirements review.
            - link "Contact Sales →" [ref=e221] [cursor=pointer]:
              - /url: /contact-sales
          - generic [ref=e222]:
            - heading "Company" [level=3] [ref=e223]
            - list [ref=e224]:
              - listitem [ref=e225]:
                - link "About" [ref=e226] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e227]:
                - link "Contact Sales" [ref=e228] [cursor=pointer]:
                  - /url: /contact-sales
              - listitem [ref=e229]:
                - link "Request Early Access" [ref=e230] [cursor=pointer]:
                  - /url: /register
              - listitem [ref=e231]:
                - link "Security" [ref=e232] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e233]:
                - link "HTML Sitemap" [ref=e234] [cursor=pointer]:
                  - /url: /site-map
          - generic [ref=e235]:
            - heading "Legal" [level=3] [ref=e236]
            - list [ref=e237]:
              - listitem [ref=e238]:
                - link "Privacy" [ref=e239] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e240]:
                - link "Terms" [ref=e241] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e242]:
                - link "Cookie Policy" [ref=e243] [cursor=pointer]:
                  - /url: /cookie-policy
              - listitem [ref=e244]:
                - link "Data Processing" [ref=e245] [cursor=pointer]:
                  - /url: /data-processing
              - listitem [ref=e246]:
                - link "Acceptable Use" [ref=e247] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e248]:
                - link "Subprocessors" [ref=e249] [cursor=pointer]:
                  - /url: /subprocessors
      - generic [ref=e250]: © 2026 Quantara. Operated by Vista By Lara. All rights reserved.
  - alert [ref=e252]
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