# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase5-routes.spec.ts >> Phase 5 Regional Location Routes Anonymous Access >> Anonymous user can access /boq-software-qatar directly without redirect
- Location: tests\e2e\phase5-routes.spec.ts:17:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Quantara assists with supported document extraction/).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/Quantara assists with supported document extraction/).first()

```

```yaml
- main:
  - link "Quantara Home":
    - /url: /
    - img "Quantara Logo"
    - text: Quantara
  - button "Platform"
  - button "Solutions"
  - button "Resources"
  - button "Comparisons"
  - button "Regional"
  - button "Company"
  - link "Sign In":
    - /url: /login
  - link "Request Early Access":
    - /url: /register
  - button "Open menu"
  - main:
    - link "Home":
      - /url: /
    - img
    - text: BOQ Software
    - heading "BOQ Software for Qatar Tender Revisions" [level=1]
    - paragraph: Qatar construction projects rely heavily on consultant-issued BOQs and complex MEP packages. Quantara provides the structured records required for rigorous professional review and revision tracking.
    - heading "Designed for Professional Estimators" [level=2]
    - paragraph: Quantara supports professionals who require structured data management for complex projects. All extracted quantities and generated proposals must be reviewed by a qualified human professional.
    - list:
      - listitem:
        - img
        - text: Contractors managing complex tenders
      - listitem:
        - img
        - text: Consultants structuring master templates
      - listitem:
        - img
        - text: MEP and fit-out specialists
    - heading "Consultant-Issued BOQ Management" [level=2]
    - paragraph: When contractors receive consultant-issued BOQs, especially large MEP packages, they must quickly structure the data for pricing. Managing frequent tender revisions without a dedicated system leads to lost tracking and pricing errors.
    - paragraph: Estimators waste valuable time reformatting consultant documents rather than applying professional commercial judgment.
    - heading "Structured Records for Professional Review" [level=2]
    - paragraph: Quantara structures these complex MEP packages and consultant-issued BOQs into a secure database. Tender revisions are tracked distinctly, maintaining a clear audit trail of the project scope.
    - paragraph: This structured approach ensures that the human professional always has accurate, organized data ready for commercial review.
    - heading "Relevant Features" [level=2]
    - heading "Hierarchical Structuring" [level=3]
    - paragraph: Organize items safely by trade or section.
    - text: Live
    - heading "Revision Tracking" [level=3]
    - paragraph: Maintain a distinct commercial audit trail.
    - text: Preview UI
    - heading "Format Extraction" [level=3]
    - paragraph: Extract items from text-based PDFs and spreadsheets.
    - text: Live
    - heading "Hypothetical Workflow Example" [level=2]
    - paragraph: "How a team might manage a major revision during the tender phase:"
    - text: "1"
    - heading "Baseline Upload" [level=3]
    - paragraph: The original tender package is securely imported.
    - text: "2"
    - heading "Variation Arrival" [level=3]
    - paragraph: A revised specification is received via PDF.
    - text: "3"
    - heading "Data Structuring" [level=3]
    - paragraph: New items are mapped into the controlled BOQ format.
    - text: "4"
    - heading "Professional Review" [level=3]
    - paragraph: The estimator applies commercial judgment to the varied quantities.
    - heading "Supported Inputs" [level=2]
    - heading "XLSX / CSV" [level=3]
    - text: Live
    - paragraph: Spreadsheet imports.
    - heading "Text-based PDF" [level=3]
    - text: Live
    - paragraph: Extraction from standard PDFs.
    - heading "CAD / BIM" [level=3]
    - text: Planned
    - paragraph: Future model integration.
    - paragraph: "Note: Capability to be confirmed."
    - heading "Supported Outputs" [level=2]
    - heading "Structured XLSX" [level=3]
    - text: Live
    - paragraph: Export governed data.
    - heading "PDF Proposals" [level=3]
    - text: Live
    - paragraph: Generate standardized documents.
    - heading "Current Limitations" [level=2]
    - list:
      - listitem: Quantara does not provide automated visual measurement or drawing takeoff.
      - listitem: The software does not certify costs, calculate taxes, or claim regional regulatory compliance.
      - listitem: All outputs strictly require independent professional validation.
    - heading "Professional Disclaimer" [level=3]
    - paragraph: Quantara assists with document extraction, BOQ organization, project records, templates and supported document-generation workflows. All extracted information, quantities, units, specifications, rates, assumptions, exclusions and generated documents must be reviewed by a qualified estimator, quantity surveyor, engineer or responsible project professional before tender, procurement, contractual or construction use.
    - heading "Frequently Asked Questions" [level=2]
    - button "Does Quantara calculate local taxes?" [expanded]:
      - text: Does Quantara calculate local taxes?
      - img
    - paragraph: No, Quantara does not calculate taxes, statutory deductions, or provide local regulatory compliance checks.
    - button "Is this software approved by local authorities?":
      - text: Is this software approved by local authorities?
      - img
    - paragraph: Quantara does not claim official government or authority approval. It is a commercial administrative tool.
    - button "Does it include a local rate database?":
      - text: Does it include a local rate database?
      - img
    - paragraph: No, Quantara does not include a verified local rate database. Estimators must supply their own professionally reviewed pricing.
    - button "Can it replace professional judgment?":
      - text: Can it replace professional judgment?
      - img
    - paragraph: Absolutely not. Quantara handles data extraction and structuring, but a qualified professional must verify all commercial data.
    - heading "Related Resources" [level=2]
    - link "BOQ Software Learn about structured BOQ management.":
      - /url: /boq-software
      - heading "BOQ Software" [level=3]
      - paragraph: Learn about structured BOQ management.
    - link "BOQ Management Controlling project records and templates.":
      - /url: /boq-management
      - heading "BOQ Management" [level=3]
      - paragraph: Controlling project records and templates.
    - link "AI BOQ Software AI-assisted document extraction workflows.":
      - /url: /ai-boq-software
      - heading "AI BOQ Software" [level=3]
      - paragraph: AI-assisted document extraction workflows.
  - heading "Ready to streamline your BOQ workflows?" [level=2]
  - link "Request Early Access":
    - /url: /register
  - link "Explore Features":
    - /url: /features
  - link "Quantara Home":
    - /url: /
    - img "Quantara Logo"
    - text: Quantara
  - paragraph: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
  - paragraph: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
  - paragraph:
    - text: "Email:"
    - link "solution@vistabylara.com":
      - /url: mailto:solution@vistabylara.com
  - paragraph:
    - text: "Telephone:"
    - link "+971 50 799 4292":
      - /url: tel:+971507994292
  - paragraph:
    - text: "WhatsApp:"
    - link "+971 50 799 4292":
      - /url: https://wa.me/971507994292
  - heading "Platform" [level=3]
  - list:
    - listitem:
      - link "Features":
        - /url: /features
    - listitem:
      - link "AI BOQ Software":
        - /url: /ai-boq-software
    - listitem:
      - link "BOQ Software":
        - /url: /boq-software
    - listitem:
      - link "Construction Estimating Software":
        - /url: /construction-estimating-software
    - listitem:
      - link "BOQ Management":
        - /url: /boq-management
    - listitem:
      - link "PDF BOQ Extraction":
        - /url: /pdf-boq-extraction
    - listitem:
      - link "Scanned PDF BOQ":
        - /url: /scanned-pdf-boq
  - heading "Solutions" [level=3]
  - list:
    - listitem:
      - link "All Industries":
        - /url: /industries
    - listitem:
      - link "Contractors":
        - /url: /boq-software-for-contractors
    - listitem:
      - link "Quantity Surveyors":
        - /url: /boq-software-for-quantity-surveyors
    - listitem:
      - link "MEP Contractors":
        - /url: /boq-software-for-mep-contractors
    - listitem:
      - link "HVAC Contractors":
        - /url: /boq-software-for-hvac-contractors
  - heading "Comparisons" [level=3]
  - list:
    - listitem:
      - link "Comparison Hub":
        - /url: /comparisons
    - listitem:
      - link "Quantara vs Excel for BOQ":
        - /url: /quantara-vs-excel-for-boq
    - listitem:
      - link "BOQ Software vs Spreadsheets":
        - /url: /boq-software-vs-spreadsheets
    - listitem:
      - link "AI BOQ vs Manual BOQ Preparation":
        - /url: /ai-boq-vs-manual-boq-preparation
    - listitem:
      - link "OCR vs Structured BOQ Extraction":
        - /url: /ocr-vs-structured-boq-extraction
  - heading "Resources" [level=3]
  - list:
    - listitem:
      - link "Resource Centre":
        - /url: /resources
    - listitem:
      - link "What Is a BOQ?":
        - /url: /what-is-a-boq
    - listitem:
      - link "How to Prepare a BOQ":
        - /url: /how-to-prepare-a-boq
    - listitem:
      - link "BOQ vs Construction Estimate":
        - /url: /boq-vs-construction-estimate
    - listitem:
      - link "BOQ vs Bill of Materials":
        - /url: /boq-vs-bill-of-materials
    - listitem:
      - link "BOQ Review Checklist":
        - /url: /boq-review-checklist
    - listitem:
      - link "Common BOQ Errors":
        - /url: /common-boq-errors
    - listitem:
      - link "BOQ Revision Control":
        - /url: /boq-revision-control
  - heading "Regional" [level=3]
  - list:
    - listitem:
      - link "GCC BOQ Software":
        - /url: /gcc-boq-software
    - listitem:
      - link "UAE":
        - /url: /boq-software-uae
    - listitem:
      - link "Dubai":
        - /url: /boq-software-dubai
    - listitem:
      - link "Abu Dhabi":
        - /url: /boq-software-abu-dhabi
    - listitem:
      - link "UAE Construction Estimating":
        - /url: /construction-estimating-software-uae
    - listitem:
      - link "UAE MEP Estimating":
        - /url: /mep-estimating-software-uae
    - listitem:
      - link "Saudi Arabia":
        - /url: /boq-software-saudi-arabia
  - heading "Company" [level=3]
  - list:
    - listitem:
      - link "About":
        - /url: /about
    - listitem:
      - link "Contact Sales":
        - /url: /contact-sales
    - listitem:
      - link "Request Early Access":
        - /url: /register
    - listitem:
      - link "Security":
        - /url: /security
    - listitem:
      - link "HTML Sitemap":
        - /url: /site-map
  - heading "Legal" [level=3]
  - list:
    - listitem:
      - link "Privacy":
        - /url: /privacy
    - listitem:
      - link "Terms":
        - /url: /terms
    - listitem:
      - link "Cookie Policy":
        - /url: /cookie-policy
    - listitem:
      - link "Data Processing":
        - /url: /data-processing
    - listitem:
      - link "Acceptable Use":
        - /url: /acceptable-use
    - listitem:
      - link "Subprocessors":
        - /url: /subprocessors
  - text: © 2026 Quantara. Operated by Vista By Lara. All rights reserved.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const PHASE5_ROUTES = [
  4  |   '/gcc-boq-software',
  5  |   '/boq-software-uae',
  6  |   '/boq-software-dubai',
  7  |   '/boq-software-abu-dhabi',
  8  |   '/construction-estimating-software-uae',
  9  |   '/mep-estimating-software-uae',
  10 |   '/boq-software-saudi-arabia',
  11 |   '/boq-software-qatar',
  12 |   '/boq-software-oman'
  13 | ];
  14 | 
  15 | test.describe('Phase 5 Regional Location Routes Anonymous Access', () => {
  16 |   for (const route of PHASE5_ROUTES) {
  17 |     test(`Anonymous user can access ${route} directly without redirect`, async ({ page }) => {
  18 |       const response = await page.goto(route);
  19 |       
  20 |       expect(response?.status()).toBe(200);
  21 |       expect(page.url()).toContain(route);
  22 |       
  23 |       // Ensure we haven't been redirected to /login
  24 |       expect(page.url()).not.toContain('/login');
  25 |       
  26 |       // Ensure the AppShell layout (Dashboard) is NOT rendered
  27 |       await expect(page.locator('aside')).toHaveCount(0);
  28 |       
  29 |       // Look for the specific H1 header that every page should have
  30 |       const h1 = page.locator('h1');
  31 |       await expect(h1).toBeVisible();
  32 |       
  33 |       // Ensure the professional disclaimer is visible somewhere on the page
  34 |       const disclaimer = page.getByText(/Quantara assists with supported document extraction/);
> 35 |       await expect(disclaimer.first()).toBeVisible();
     |                                        ^ Error: expect(locator).toBeVisible() failed
  36 |     });
  37 |   }
  38 | });
  39 | 
```