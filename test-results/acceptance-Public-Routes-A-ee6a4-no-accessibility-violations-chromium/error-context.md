# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> Public Routes Acceptance >> Route /register should load successfully and have no accessibility violations
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
    - generic [ref=e37]:
      - paragraph [ref=e38]: Quantara
      - heading "Request Early Access" [level=1] [ref=e39]
      - paragraph [ref=e40]: Creating an Early Access account does not begin a paid subscription or automatic billing. After submitting your request, our team reviews your company requirements. Approved applicants receive onboarding instructions and access details by business email.
      - generic [ref=e41]:
        - generic [ref=e42]:
          - generic [ref=e43]:
            - text: Full name
            - textbox "Full name" [ref=e44]
          - generic [ref=e45]:
            - text: Business Email
            - textbox "Business Email" [ref=e46]
        - generic [ref=e47]:
          - generic [ref=e48]:
            - text: Company
            - textbox "Company" [ref=e49]
          - generic [ref=e50]:
            - text: Role
            - combobox "Role" [ref=e51]:
              - option "Quantity Surveyor" [selected]
              - option "Estimator"
              - option "Engineer"
              - option "Project Manager"
              - option "Contractor"
              - option "Procurement Professional"
              - option "Company Owner"
              - option "Consultant"
              - option "Other"
        - generic [ref=e52]:
          - generic [ref=e53]:
            - text: Country
            - textbox "Country" [ref=e54]
          - generic [ref=e55]:
            - text: Primary Industry
            - textbox "Primary Industry" [ref=e56]
        - generic [ref=e57]:
          - generic [ref=e58]:
            - text: Intended Use
            - textbox "Intended Use" [ref=e59]
          - generic [ref=e60]:
            - text: Approx. Monthly Project Volume
            - combobox "Approx. Monthly Project Volume" [ref=e61]:
              - option "Select volume..." [selected]
              - option "1-5 projects"
              - option "6-20 projects"
              - option "21-50 projects"
              - option "50+ projects"
        - generic [ref=e62]:
          - text: Password
          - textbox "Password" [ref=e63]
          - paragraph [ref=e64]: At least 8 characters, with a letter and a number.
        - generic [ref=e65]:
          - checkbox "I consent to the collection and processing of my information for Early Access evaluation in accordance with the Privacy Policy." [ref=e66]
          - generic [ref=e67]:
            - text: I consent to the collection and processing of my information for Early Access evaluation in accordance with the
            - link "Privacy Policy" [ref=e68] [cursor=pointer]:
              - /url: /privacy
            - text: .
        - button "Request Early Access" [ref=e70] [cursor=pointer]
        - paragraph [ref=e72]:
          - text: We use the information you provide to review your request and contact you about Quantara. Do not submit confidential project documents through this form.
          - link "Read our Privacy Policy" [ref=e73] [cursor=pointer]:
            - /url: /privacy
          - text: .
      - generic [ref=e74]:
        - text: Already have an account?
        - link "Sign in" [ref=e75] [cursor=pointer]:
          - /url: /login
  - generic [ref=e77]:
    - generic [ref=e78]:
      - generic [ref=e79]:
        - link "Quantara Home" [ref=e80] [cursor=pointer]:
          - /url: /
          - img "Quantara Logo" [ref=e81]
          - text: Quantara
        - paragraph [ref=e82]: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
        - paragraph [ref=e83]: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
        - generic [ref=e84]:
          - paragraph [ref=e85]:
            - text: "Email:"
            - link "solution@vistabylara.com" [ref=e86] [cursor=pointer]:
              - /url: mailto:solution@vistabylara.com
          - paragraph [ref=e87]:
            - text: "Telephone:"
            - link "+971 50 799 4292" [ref=e88] [cursor=pointer]:
              - /url: tel:+971507994292
          - paragraph [ref=e89]:
            - text: "WhatsApp:"
            - link "+971 50 799 4292" [ref=e90] [cursor=pointer]:
              - /url: https://wa.me/971507994292
      - generic [ref=e91]:
        - heading "Platform" [level=3] [ref=e92]
        - list [ref=e93]:
          - listitem [ref=e94]:
            - link "Features" [ref=e95] [cursor=pointer]:
              - /url: /features
          - listitem [ref=e96]:
            - link "AI BOQ Software" [ref=e97] [cursor=pointer]:
              - /url: /ai-boq-software
          - listitem [ref=e98]:
            - link "BOQ Software" [ref=e99] [cursor=pointer]:
              - /url: /boq-software
          - listitem [ref=e100]:
            - link "Construction Estimating Software" [ref=e101] [cursor=pointer]:
              - /url: /construction-estimating-software
          - listitem [ref=e102]:
            - link "BOQ Management" [ref=e103] [cursor=pointer]:
              - /url: /boq-management
          - listitem [ref=e104]:
            - link "PDF BOQ Extraction" [ref=e105] [cursor=pointer]:
              - /url: /pdf-boq-extraction
          - listitem [ref=e106]:
            - link "Scanned PDF BOQ" [ref=e107] [cursor=pointer]:
              - /url: /scanned-pdf-boq
      - generic [ref=e108]:
        - heading "Solutions" [level=3] [ref=e109]
        - list [ref=e110]:
          - listitem [ref=e111]:
            - link "All Industries" [ref=e112] [cursor=pointer]:
              - /url: /industries
          - listitem [ref=e113]:
            - link "Contractors" [ref=e114] [cursor=pointer]:
              - /url: /boq-software-for-contractors
          - listitem [ref=e115]:
            - link "Quantity Surveyors" [ref=e116] [cursor=pointer]:
              - /url: /boq-software-for-quantity-surveyors
          - listitem [ref=e117]:
            - link "MEP Contractors" [ref=e118] [cursor=pointer]:
              - /url: /boq-software-for-mep-contractors
          - listitem [ref=e119]:
            - link "HVAC Contractors" [ref=e120] [cursor=pointer]:
              - /url: /boq-software-for-hvac-contractors
        - heading "Comparisons" [level=3] [ref=e121]
        - list [ref=e122]:
          - listitem [ref=e123]:
            - link "Comparison Hub" [ref=e124] [cursor=pointer]:
              - /url: /comparisons
          - listitem [ref=e125]:
            - link "Quantara vs Excel for BOQ" [ref=e126] [cursor=pointer]:
              - /url: /quantara-vs-excel-for-boq
          - listitem [ref=e127]:
            - link "BOQ Software vs Spreadsheets" [ref=e128] [cursor=pointer]:
              - /url: /boq-software-vs-spreadsheets
          - listitem [ref=e129]:
            - link "AI BOQ vs Manual BOQ Preparation" [ref=e130] [cursor=pointer]:
              - /url: /ai-boq-vs-manual-boq-preparation
          - listitem [ref=e131]:
            - link "OCR vs Structured BOQ Extraction" [ref=e132] [cursor=pointer]:
              - /url: /ocr-vs-structured-boq-extraction
      - generic [ref=e133]:
        - heading "Resources" [level=3] [ref=e134]
        - list [ref=e135]:
          - listitem [ref=e136]:
            - link "Resource Centre" [ref=e137] [cursor=pointer]:
              - /url: /resources
          - listitem [ref=e138]:
            - link "BOQ Calculation Formulas" [ref=e139] [cursor=pointer]:
              - /url: /boq-calculation-formulas
          - listitem [ref=e140]:
            - link "Free BOQ Calculator — External Vista By Lara Tool" [ref=e141] [cursor=pointer]:
              - /url: https://www.vistabylara.com/ai-tools/boq-calculator-uae
          - listitem [ref=e142]:
            - link "What Is a BOQ?" [ref=e143] [cursor=pointer]:
              - /url: /what-is-a-boq
          - listitem [ref=e144]:
            - link "How to Prepare a BOQ" [ref=e145] [cursor=pointer]:
              - /url: /how-to-prepare-a-boq
          - listitem [ref=e146]:
            - link "BOQ vs Construction Estimate" [ref=e147] [cursor=pointer]:
              - /url: /boq-vs-construction-estimate
          - listitem [ref=e148]:
            - link "BOQ vs Bill of Materials" [ref=e149] [cursor=pointer]:
              - /url: /boq-vs-bill-of-materials
          - listitem [ref=e150]:
            - link "BOQ Review Checklist" [ref=e151] [cursor=pointer]:
              - /url: /boq-review-checklist
      - generic [ref=e152]:
        - heading "Regional" [level=3] [ref=e153]
        - list [ref=e154]:
          - listitem [ref=e155]:
            - link "GCC BOQ Software" [ref=e156] [cursor=pointer]:
              - /url: /gcc-boq-software
          - listitem [ref=e157]:
            - link "UAE" [ref=e158] [cursor=pointer]:
              - /url: /boq-software-uae
          - listitem [ref=e159]:
            - link "Dubai" [ref=e160] [cursor=pointer]:
              - /url: /boq-software-dubai
          - listitem [ref=e161]:
            - link "Abu Dhabi" [ref=e162] [cursor=pointer]:
              - /url: /boq-software-abu-dhabi
          - listitem [ref=e163]:
            - link "UAE Construction Estimating" [ref=e164] [cursor=pointer]:
              - /url: /construction-estimating-software-uae
          - listitem [ref=e165]:
            - link "UAE MEP Estimating" [ref=e166] [cursor=pointer]:
              - /url: /mep-estimating-software-uae
          - listitem [ref=e167]:
            - link "Saudi Arabia" [ref=e168] [cursor=pointer]:
              - /url: /boq-software-saudi-arabia
      - generic [ref=e169]:
        - generic [ref=e170]:
          - heading "Enterprise Software" [level=3] [ref=e171]
          - paragraph [ref=e172]: Custom Quantara software implementation for companies requiring tailored workflows, integrations, branding, deployment, migration, onboarding or advanced operational requirements.
          - paragraph [ref=e173]: Custom implementation and onboarding starting from AED 15,000
          - paragraph [ref=e174]: Final scope and pricing are provided through a custom quotation following a requirements review.
          - link "Contact Sales →" [ref=e175] [cursor=pointer]:
            - /url: /contact-sales
        - generic [ref=e176]:
          - heading "Company" [level=3] [ref=e177]
          - list [ref=e178]:
            - listitem [ref=e179]:
              - link "About" [ref=e180] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e181]:
              - link "Contact Sales" [ref=e182] [cursor=pointer]:
                - /url: /contact-sales
            - listitem [ref=e183]:
              - link "Request Early Access" [ref=e184] [cursor=pointer]:
                - /url: /register
            - listitem [ref=e185]:
              - link "Security" [ref=e186] [cursor=pointer]:
                - /url: /security
            - listitem [ref=e187]:
              - link "HTML Sitemap" [ref=e188] [cursor=pointer]:
                - /url: /site-map
        - generic [ref=e189]:
          - heading "Legal" [level=3] [ref=e190]
          - list [ref=e191]:
            - listitem [ref=e192]:
              - link "Privacy" [ref=e193] [cursor=pointer]:
                - /url: /privacy
            - listitem [ref=e194]:
              - link "Terms" [ref=e195] [cursor=pointer]:
                - /url: /terms
            - listitem [ref=e196]:
              - link "Cookie Policy" [ref=e197] [cursor=pointer]:
                - /url: /cookie-policy
            - listitem [ref=e198]:
              - link "Data Processing" [ref=e199] [cursor=pointer]:
                - /url: /data-processing
            - listitem [ref=e200]:
              - link "Acceptable Use" [ref=e201] [cursor=pointer]:
                - /url: /acceptable-use
            - listitem [ref=e202]:
              - link "Subprocessors" [ref=e203] [cursor=pointer]:
                - /url: /subprocessors
    - generic [ref=e204]: © 2026 Quantara. Operated by Vista By Lara. All rights reserved.
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