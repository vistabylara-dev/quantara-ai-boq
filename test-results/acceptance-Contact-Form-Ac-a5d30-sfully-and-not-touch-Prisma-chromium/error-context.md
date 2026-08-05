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
- main [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - link "← Back to Home" [ref=e6] [cursor=pointer]:
        - /url: /
      - generic [ref=e7]:
        - generic [ref=e8]:
          - heading "Contact Sales" [level=1] [ref=e9]
          - paragraph [ref=e10]: Tell us about your BOQ workflow, project-document formats, team requirements and Early Access needs.
          - generic [ref=e11]:
            - heading "Talk to the Quantara Team" [level=3] [ref=e12]
            - list [ref=e13]:
              - listitem [ref=e14]:
                - strong [ref=e15]: "Email:"
                - link "solution@vistabylara.com" [ref=e16] [cursor=pointer]:
                  - /url: mailto:solution@vistabylara.com
              - listitem [ref=e17]:
                - strong [ref=e18]: "Telephone:"
                - link "+971 50 799 4292" [ref=e19] [cursor=pointer]:
                  - /url: tel:+971507994292
              - listitem [ref=e20]:
                - strong [ref=e21]: "WhatsApp:"
                - link "+971 50 799 4292" [ref=e22] [cursor=pointer]:
                  - /url: https://wa.me/971507994292
            - paragraph [ref=e23]: Sales and support requests can be submitted 24 hours a day. Response times may vary during Controlled Early Access.
          - generic [ref=e24]:
            - heading "Why contact sales?" [level=3] [ref=e25]
            - list [ref=e26]:
              - listitem [ref=e27]: Discuss your current BOQ process
              - listitem [ref=e28]: Review supported input and output requirements
              - listitem [ref=e29]: Request an Early Access product walkthrough
              - listitem [ref=e30]: Share team and project-volume requirements
        - generic [ref=e31]:
          - heading "Talk to an Expert" [level=2] [ref=e32]
          - generic [ref=e33]:
            - generic [ref=e34]:
              - generic [ref=e35]:
                - text: Full name
                - textbox "Full name" [ref=e36]
              - generic [ref=e37]:
                - text: Business email
                - textbox "Business email" [ref=e38]
            - generic [ref=e39]:
              - generic [ref=e40]:
                - text: Company name
                - textbox "Company name" [ref=e41]
              - generic [ref=e42]:
                - text: Country
                - textbox "Country" [ref=e43]
            - generic [ref=e44]:
              - generic [ref=e45]:
                - text: Role
                - textbox "Role" [ref=e46]
              - generic [ref=e47]:
                - text: Company type
                - combobox "Company type" [ref=e48]:
                  - option "Main Contractor" [selected]
                  - option "Subcontractor"
                  - option "Consultancy"
                  - option "Developer"
                  - option "Other"
            - generic [ref=e49]:
              - generic [ref=e50]:
                - text: Construction discipline
                - textbox "Construction discipline" [ref=e51]
              - generic [ref=e52]:
                - text: Approximate monthly BOQ volume
                - textbox "Approximate monthly BOQ volume" [ref=e53]: 1-5
            - generic [ref=e54]:
              - text: Current BOQ process
              - textbox "Current BOQ process" [ref=e55]
            - generic [ref=e56]:
              - generic [ref=e57]:
                - text: Required input formats
                - textbox "Required input formats" [ref=e58]
              - generic [ref=e59]:
                - text: Required output formats
                - textbox "Required output formats" [ref=e60]
            - generic [ref=e61]:
              - generic [ref=e62]:
                - text: Number of intended users
                - textbox "Number of intended users" [ref=e63]: 1-5
              - generic [ref=e64]:
                - text: Preferred contact method
                - combobox "Preferred Contact Method" [ref=e65]:
                  - option "Email" [selected]
                  - option "Phone"
                  - option "WhatsApp"
            - generic [ref=e66]:
              - text: Message
              - textbox "Message" [ref=e67]
            - generic [ref=e68]:
              - 'checkbox "Privacy consent: I agree that Quantara may process my information to respond to this request." [ref=e69]'
              - text: "Privacy consent: I agree that Quantara may process my information to respond to this request."
            - button "Talk to an Expert" [ref=e70]
            - paragraph [ref=e72]:
              - text: We use the information you provide to review your request and contact you about Quantara. Do not submit confidential project documents through this form.
              - link "Read our Privacy Policy" [ref=e73] [cursor=pointer]:
                - /url: /privacy
              - text: .
    - generic [ref=e75]:
      - generic [ref=e76]:
        - generic [ref=e77]:
          - link "Quantara Home" [ref=e78] [cursor=pointer]:
            - /url: /
            - img "Quantara Logo" [ref=e79]
            - text: Quantara
          - paragraph [ref=e80]: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
          - paragraph [ref=e81]: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
        - generic [ref=e82]:
          - heading "Product" [level=3] [ref=e83]
          - list [ref=e84]:
            - listitem [ref=e85]:
              - link "Features" [ref=e86] [cursor=pointer]:
                - /url: /features
            - listitem [ref=e87]:
              - link "About" [ref=e88] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e89]:
              - link "Resources" [ref=e90] [cursor=pointer]:
                - /url: /resources
            - listitem [ref=e91]:
              - link "Industries" [ref=e92] [cursor=pointer]:
                - /url: /industries
            - listitem [ref=e93]:
              - link "GCC BOQ Software" [ref=e94] [cursor=pointer]:
                - /url: /gcc-boq-software
            - listitem [ref=e95]:
              - link "Request Early Access" [ref=e96] [cursor=pointer]:
                - /url: /register
            - listitem [ref=e97]:
              - link "Contact Sales" [ref=e98] [cursor=pointer]:
                - /url: /contact-sales
        - generic [ref=e99]:
          - heading "BOQ Resources" [level=3] [ref=e100]
          - list [ref=e101]:
            - listitem [ref=e102]:
              - link "AI BOQ Software" [ref=e103] [cursor=pointer]:
                - /url: /ai-boq-software
            - listitem [ref=e104]:
              - link "BOQ Software" [ref=e105] [cursor=pointer]:
                - /url: /boq-software
            - listitem [ref=e106]:
              - link "Construction Estimating Software" [ref=e107] [cursor=pointer]:
                - /url: /construction-estimating-software
            - listitem [ref=e108]:
              - link "PDF BOQ Extraction" [ref=e109] [cursor=pointer]:
                - /url: /pdf-boq-extraction
            - listitem [ref=e110]:
              - link "Quantity Surveying Software" [ref=e111] [cursor=pointer]:
                - /url: /quantity-surveying-software
            - listitem [ref=e112]:
              - link "Comparisons" [ref=e113] [cursor=pointer]:
                - /url: /comparisons
        - generic [ref=e114]:
          - heading "Legal" [level=3] [ref=e115]
          - list [ref=e116]:
            - listitem [ref=e117]:
              - link "Security" [ref=e118] [cursor=pointer]:
                - /url: /security
            - listitem [ref=e119]:
              - link "Privacy" [ref=e120] [cursor=pointer]:
                - /url: /privacy
            - listitem [ref=e121]:
              - link "Terms" [ref=e122] [cursor=pointer]:
                - /url: /terms
            - listitem [ref=e123]:
              - link "Data Processing" [ref=e124] [cursor=pointer]:
                - /url: /data-processing
            - listitem [ref=e125]:
              - link "Cookie Policy" [ref=e126] [cursor=pointer]:
                - /url: /cookie-policy
            - listitem [ref=e127]:
              - link "Acceptable Use" [ref=e128] [cursor=pointer]:
                - /url: /acceptable-use
            - listitem [ref=e129]:
              - link "Subprocessors" [ref=e130] [cursor=pointer]:
                - /url: /subprocessors
        - generic [ref=e131]:
          - heading "Quantara Support" [level=3] [ref=e132]
          - list [ref=e133]:
            - listitem [ref=e134]:
              - text: "Email:"
              - link "solution@vistabylara.com" [ref=e135] [cursor=pointer]:
                - /url: mailto:solution@vistabylara.com
            - listitem [ref=e136]:
              - text: "Telephone:"
              - link "+971 50 799 4292" [ref=e137] [cursor=pointer]:
                - /url: tel:+971507994292
            - listitem [ref=e138]:
              - text: "WhatsApp:"
              - link "+971 50 799 4292" [ref=e139] [cursor=pointer]:
                - /url: https://wa.me/971507994292
          - paragraph [ref=e140]: Support requests can be submitted 24 hours a day. Response times may vary during Controlled Early Access.
      - generic [ref=e141]: © 2026 Quantara. Operated by Vista By Lara. All rights reserved.
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