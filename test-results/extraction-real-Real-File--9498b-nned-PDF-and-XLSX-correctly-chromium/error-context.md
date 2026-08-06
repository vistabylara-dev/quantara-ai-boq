# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extraction-real.spec.ts >> Real File Extraction >> should process text PDF, scanned PDF, and XLSX correctly
- Location: tests\e2e\extraction-real.spec.ts:53:7

# Error details

```
PrismaClientValidationError: 
Invalid `prisma.company.create()` invocation in
C:\Users\PC\Desktop\quantara-ai-boq\tests\e2e\extraction-real.spec.ts:17:26

  14 userId = randomUUID();
  15 userEmail = `extraction-${Date.now()}@quantara.local`;
  16 
→ 17 await prisma.company.create({
       data: {
         id: "4c52694d-552e-4aa9-806b-cd8f8df1e512",
         name: "Extraction Test Company",
         domain: "quantara.local",
     +   legalName: String
       }
     })

Argument `legalName` is missing.
```

```
PrismaClientKnownRequestError: 
Invalid `prisma.user.delete()` invocation in
C:\Users\PC\Desktop\quantara-ai-boq\tests\e2e\extraction-real.spec.ts:41:29

  38 
  39 test.afterAll(async () => {
  40   await prisma.project.deleteMany({ where: { companyId } });
→ 41   await prisma.user.delete(
An operation failed because it depends on one or more records that were required but not found. No record was found for a delete.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import path from 'path';
  3   | import { prisma } from '../../src/lib/db/prisma';
  4   | import bcrypt from 'bcryptjs';
  5   | import { randomUUID } from 'crypto';
  6   | 
  7   | test.describe('Real File Extraction', () => {
  8   |   let companyId: string;
  9   |   let userId: string;
  10  |   let userEmail: string;
  11  | 
  12  |   test.beforeAll(async () => {
  13  |     companyId = randomUUID();
  14  |     userId = randomUUID();
  15  |     userEmail = `extraction-${Date.now()}@quantara.local`;
  16  | 
  17  |     await prisma.company.create({
  18  |       data: {
  19  |         id: companyId,
  20  |         name: 'Extraction Test Company',
  21  |         domain: 'quantara.local',
  22  |       }
  23  |     });
  24  | 
  25  |     const hashedPassword = await bcrypt.hash('Password123!', 10);
  26  |     await prisma.user.create({
  27  |       data: {
  28  |         id: userId,
  29  |         email: userEmail,
  30  |         password: hashedPassword,
  31  |         name: 'Extraction User',
  32  |         companyId,
  33  |         emailVerified: new Date(),
  34  |         approvalStatus: 'APPROVED'
  35  |       }
  36  |     });
  37  |   });
  38  | 
  39  |   test.afterAll(async () => {
  40  |     await prisma.project.deleteMany({ where: { companyId } });
> 41  |     await prisma.user.delete({ where: { id: userId } });
      |                             ^ PrismaClientKnownRequestError: 
  42  |     await prisma.company.delete({ where: { id: companyId } });
  43  |   });
  44  | 
  45  |   test.beforeEach(async ({ page }) => {
  46  |     await page.goto('/login');
  47  |     await page.fill('input[type="email"]', userEmail);
  48  |     await page.fill('input[type="password"]', 'Password123!');
  49  |     await page.click('button[type="submit"]');
  50  |     await expect(page).toHaveURL(/\/projects/);
  51  |   });
  52  | 
  53  |   test('should process text PDF, scanned PDF, and XLSX correctly', async ({ page }) => {
  54  |     test.setTimeout(120000); // 2 mins for extraction
  55  | 
  56  |     // Create project
  57  |     await page.click('text=New Project');
  58  |     await page.fill('input[name="name"]', 'Extraction Test Project');
  59  |     await page.click('button:has-text("Create Project")');
  60  |     await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/boq/);
  61  |     
  62  |     // Upload files
  63  |     await page.click('text=Upload Files');
  64  |     
  65  |     // Path to fixtures
  66  |     const fixturesDir = path.resolve(__dirname, 'fixtures');
  67  |     const textPdfPath = path.join(fixturesDir, 'sample-text.pdf');
  68  |     const scannedPdfPath = path.join(fixturesDir, 'sample-scanned.pdf');
  69  |     const xlsxPath = path.join(fixturesDir, 'sample.xlsx');
  70  | 
  71  |     const fileInput = page.locator('input[type="file"]');
  72  |     
  73  |     // Upload text PDF
  74  |     await fileInput.setInputFiles([textPdfPath]);
  75  |     await expect(page.locator('text=Upload Complete').first()).toBeVisible({ timeout: 15000 });
  76  |     
  77  |     // Upload scanned PDF
  78  |     await fileInput.setInputFiles([scannedPdfPath]);
  79  |     await expect(page.locator('text=Upload Complete').nth(1)).toBeVisible({ timeout: 15000 });
  80  |     
  81  |     // Upload XLSX
  82  |     await fileInput.setInputFiles([xlsxPath]);
  83  |     await expect(page.locator('text=Upload Complete').nth(2)).toBeVisible({ timeout: 15000 });
  84  |     
  85  |     // Close upload modal
  86  |     await page.keyboard.press('Escape');
  87  | 
  88  |     // Wait for processing to complete on all files
  89  |     // In UI, we expect "Review Required" or "Completed" status. 
  90  |     // We will wait until there are no "Processing" labels.
  91  |     await expect(page.locator('text=Processing')).toHaveCount(0, { timeout: 60000 });
  92  |     
  93  |     // The scanned PDF should require review or show a warning because it has no text layer.
  94  |     // The XLSX should process fine and find items.
  95  |     
  96  |     // Let's verify the XLSX extraction by going to Review
  97  |     await page.click('text=Review');
  98  |     
  99  |     // Expect to see extracted items from the XLSX
  100 |     await expect(page.locator('text=Concrete Foundation')).toBeVisible();
  101 |     await expect(page.locator('text=Steel Reinforcement')).toBeVisible();
  102 |     
  103 |     // Confirm import
  104 |     await page.click('text=Import to BOQ');
  105 |     await expect(page.locator('text=successfully imported')).toBeVisible();
  106 |   });
  107 | });
  108 | 
```