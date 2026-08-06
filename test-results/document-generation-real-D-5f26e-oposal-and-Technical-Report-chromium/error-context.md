# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: document-generation-real.spec.ts >> Document Generation Validation >> should generate Proposal and Technical Report
- Location: tests\e2e\document-generation-real.spec.ts:130:7

# Error details

```
PrismaClientValidationError: 
Invalid `prisma.company.create()` invocation in
C:\Users\PC\Desktop\quantara-ai-boq\tests\e2e\document-generation-real.spec.ts:16:26

  13 userId = randomUUID();
  14 userEmail = `docgen-${Date.now()}@quantara.local`;
  15 
→ 16 await prisma.company.create({
       data: {
         id: "3a1bb20b-198b-4916-9842-51f523e0b71a",
         name: "Doc Gen Test Company",
         domain: "quantara.local",
     +   legalName: String
       }
     })

Argument `legalName` is missing.
```

```
PrismaClientKnownRequestError: 
Invalid `prisma.user.delete()` invocation in
C:\Users\PC\Desktop\quantara-ai-boq\tests\e2e\document-generation-real.spec.ts:87:29

  84 
  85 test.afterAll(async () => {
  86   await prisma.project.deleteMany({ where: { companyId } });
→ 87   await prisma.user.delete(
An operation failed because it depends on one or more records that were required but not found. No record was found for a delete.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { prisma } from '../../src/lib/db/prisma';
  3   | import bcrypt from 'bcryptjs';
  4   | import { randomUUID } from 'crypto';
  5   | 
  6   | test.describe('Document Generation Validation', () => {
  7   |   let companyId: string;
  8   |   let userId: string;
  9   |   let userEmail: string;
  10  | 
  11  |   test.beforeAll(async () => {
  12  |     companyId = randomUUID();
  13  |     userId = randomUUID();
  14  |     userEmail = `docgen-${Date.now()}@quantara.local`;
  15  | 
  16  |     await prisma.company.create({
  17  |       data: {
  18  |         id: companyId,
  19  |         name: 'Doc Gen Test Company',
  20  |         domain: 'quantara.local',
  21  |       }
  22  |     });
  23  | 
  24  |     const hashedPassword = await bcrypt.hash('Password123!', 10);
  25  |     await prisma.user.create({
  26  |       data: {
  27  |         id: userId,
  28  |         email: userEmail,
  29  |         password: hashedPassword,
  30  |         name: 'Doc Gen User',
  31  |         companyId,
  32  |         emailVerified: new Date(),
  33  |         approvalStatus: 'APPROVED'
  34  |       }
  35  |     });
  36  |     
  37  |     // Create base data to generate from
  38  |     const projectId = randomUUID();
  39  |     await prisma.project.create({
  40  |         data: {
  41  |             id: projectId,
  42  |             name: 'Doc Gen Project',
  43  |             companyId,
  44  |             boqSettingsJson: {}
  45  |         }
  46  |     });
  47  |     
  48  |     const snapshotId = randomUUID();
  49  |     await prisma.boqRevisionSnapshot.create({
  50  |         data: {
  51  |             id: snapshotId,
  52  |             projectId,
  53  |             revisionNumber: 1,
  54  |             createdById: userId,
  55  |             summaryJson: {},
  56  |             sectionsJson: [
  57  |                 {
  58  |                     id: randomUUID(),
  59  |                     key: 'SEC-1',
  60  |                     name: 'Generated Section',
  61  |                     orderIndex: 0,
  62  |                     items: [
  63  |                         {
  64  |                             id: randomUUID(),
  65  |                             key: 'ITM-1',
  66  |                             name: 'Generated Item',
  67  |                             quantity: 10,
  68  |                             unit: 'm2',
  69  |                             orderIndex: 0,
  70  |                             options: []
  71  |                         }
  72  |                     ]
  73  |                 }
  74  |             ]
  75  |         }
  76  |     });
  77  |     
  78  |     // Set the latest snapshot
  79  |     await prisma.project.update({
  80  |         where: { id: projectId },
  81  |         data: { latestSnapshotId: snapshotId }
  82  |     });
  83  |   });
  84  | 
  85  |   test.afterAll(async () => {
  86  |     await prisma.project.deleteMany({ where: { companyId } });
> 87  |     await prisma.user.delete({ where: { id: userId } });
      |                             ^ PrismaClientKnownRequestError: 
  88  |     await prisma.company.delete({ where: { id: companyId } });
  89  |   });
  90  | 
  91  |   test.beforeEach(async ({ page }) => {
  92  |     await page.goto('/login');
  93  |     await page.fill('input[type="email"]', userEmail);
  94  |     await page.fill('input[type="password"]', 'Password123!');
  95  |     await page.click('button[type="submit"]');
  96  |     await expect(page).toHaveURL(/\/projects/);
  97  |   });
  98  | 
  99  |   test('should generate and download PDF, XLSX, and CSV', async ({ page }) => {
  100 |     test.setTimeout(90000);
  101 |     
  102 |     await page.click('text=Doc Gen Project');
  103 |     await page.click('text=Export');
  104 |     
  105 |     // PDF
  106 |     const [pdfDownload] = await Promise.all([
  107 |       page.waitForEvent('download'),
  108 |       page.click('text=Export as PDF')
  109 |     ]);
  110 |     const pdfPath = await pdfDownload.path();
  111 |     expect(pdfPath).toBeTruthy();
  112 |     
  113 |     // CSV
  114 |     const [csvDownload] = await Promise.all([
  115 |       page.waitForEvent('download'),
  116 |       page.click('text=Export as CSV')
  117 |     ]);
  118 |     const csvPath = await csvDownload.path();
  119 |     expect(csvPath).toBeTruthy();
  120 | 
  121 |     // XLSX
  122 |     const [xlsxDownload] = await Promise.all([
  123 |       page.waitForEvent('download'),
  124 |       page.click('text=Export as Excel')
  125 |     ]);
  126 |     const xlsxPath = await xlsxDownload.path();
  127 |     expect(xlsxPath).toBeTruthy();
  128 |   });
  129 |   
  130 |   test('should generate Proposal and Technical Report', async ({ page }) => {
  131 |     test.setTimeout(90000);
  132 |     await page.click('text=Doc Gen Project');
  133 |     
  134 |     // Proposal
  135 |     await page.click('text=Proposals');
  136 |     await page.click('text=New Proposal');
  137 |     await page.fill('input[name="clientName"]', 'Test Client');
  138 |     await page.click('button:has-text("Create Proposal")');
  139 |     await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/proposals\/[a-zA-Z0-9-]+/);
  140 |     await expect(page.locator('text=Generated Item')).toBeVisible();
  141 | 
  142 |     // Technical Report
  143 |     await page.goto('/projects');
  144 |     await page.click('text=Doc Gen Project');
  145 |     await page.click('text=Reports');
  146 |     await page.click('text=New Report');
  147 |     await page.fill('input[name="title"]', 'Test Report');
  148 |     await page.click('button:has-text("Create Report")');
  149 |     await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/technical-reports\/[a-zA-Z0-9-]+/);
  150 |     await expect(page.locator('text=Test Report')).toBeVisible();
  151 |   });
  152 | });
  153 | 
```