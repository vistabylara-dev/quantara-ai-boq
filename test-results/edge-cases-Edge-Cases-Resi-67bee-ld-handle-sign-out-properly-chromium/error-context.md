# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: edge-cases.spec.ts >> Edge Cases & Resiliency >> should handle sign-out properly
- Location: tests\e2e\edge-cases.spec.ts:54:7

# Error details

```
PrismaClientValidationError: 
Invalid `prisma.company.create()` invocation in
C:\Users\PC\Desktop\quantara-ai-boq\tests\e2e\edge-cases.spec.ts:18:26

  15 userId = randomUUID();
  16 userEmail = `edge-${Date.now()}@quantara.local`;
  17 
→ 18 await prisma.company.create({
       data: {
         id: "cc8de976-51c9-4fe2-a5fe-baca7b84bdd3",
         name: "Edge Test Company",
         domain: "quantara.local",
     +   legalName: String
       }
     })

Argument `legalName` is missing.
```

```
PrismaClientKnownRequestError: 
Invalid `prisma.user.delete()` invocation in
C:\Users\PC\Desktop\quantara-ai-boq\tests\e2e\edge-cases.spec.ts:42:29

  39 
  40 test.afterAll(async () => {
  41   await prisma.project.deleteMany({ where: { companyId } });
→ 42   await prisma.user.delete(
An operation failed because it depends on one or more records that were required but not found. No record was found for a delete.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import path from 'path';
  3   | import { prisma } from '../../src/lib/db/prisma';
  4   | import bcrypt from 'bcryptjs';
  5   | import { randomUUID } from 'crypto';
  6   | import fs from 'fs';
  7   | 
  8   | test.describe('Edge Cases & Resiliency', () => {
  9   |   let companyId: string;
  10  |   let userId: string;
  11  |   let userEmail: string;
  12  | 
  13  |   test.beforeAll(async () => {
  14  |     companyId = randomUUID();
  15  |     userId = randomUUID();
  16  |     userEmail = `edge-${Date.now()}@quantara.local`;
  17  | 
  18  |     await prisma.company.create({
  19  |       data: {
  20  |         id: companyId,
  21  |         name: 'Edge Test Company',
  22  |         domain: 'quantara.local',
  23  |       }
  24  |     });
  25  | 
  26  |     const hashedPassword = await bcrypt.hash('Password123!', 10);
  27  |     await prisma.user.create({
  28  |       data: {
  29  |         id: userId,
  30  |         email: userEmail,
  31  |         password: hashedPassword,
  32  |         name: 'Edge User',
  33  |         companyId,
  34  |         emailVerified: new Date(),
  35  |         approvalStatus: 'APPROVED'
  36  |       }
  37  |     });
  38  |   });
  39  | 
  40  |   test.afterAll(async () => {
  41  |     await prisma.project.deleteMany({ where: { companyId } });
> 42  |     await prisma.user.delete({ where: { id: userId } });
      |                             ^ PrismaClientKnownRequestError: 
  43  |     await prisma.company.delete({ where: { id: companyId } });
  44  |   });
  45  | 
  46  |   test.beforeEach(async ({ page }) => {
  47  |     await page.goto('/login');
  48  |     await page.fill('input[type="email"]', userEmail);
  49  |     await page.fill('input[type="password"]', 'Password123!');
  50  |     await page.click('button[type="submit"]');
  51  |     await expect(page).toHaveURL(/\/projects/);
  52  |   });
  53  | 
  54  |   test('should handle sign-out properly', async ({ page }) => {
  55  |     // Assuming a user menu on the top right
  56  |     await page.click('button:has(svg.lucide-user), button:has(img[alt="User"])');
  57  |     // Click Sign Out
  58  |     await page.click('text=Log out');
  59  |     
  60  |     // Should be redirected to login
  61  |     await expect(page).toHaveURL(/\/login/);
  62  |     
  63  |     // Try to access protected route directly
  64  |     await page.goto('/projects');
  65  |     await expect(page).toHaveURL(/\/login/);
  66  |   });
  67  | 
  68  |   test('should reject invalid file types', async ({ page }) => {
  69  |     // Create a dummy project
  70  |     await page.click('text=New Project');
  71  |     await page.fill('input[name="name"]', 'Invalid File Project');
  72  |     await page.click('button:has-text("Create Project")');
  73  |     await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/boq/);
  74  |     
  75  |     await page.click('text=Upload Files');
  76  |     
  77  |     // Create a dummy exe file
  78  |     const invalidFilePath = path.join(__dirname, 'fixtures', 'invalid.exe');
  79  |     fs.writeFileSync(invalidFilePath, 'dummy');
  80  | 
  81  |     const fileInput = page.locator('input[type="file"]');
  82  |     await fileInput.setInputFiles([invalidFilePath]);
  83  |     
  84  |     // UI should show an error or validation message
  85  |     await expect(page.locator('text=Invalid file type').or(page.locator('text=not supported'))).toBeVisible({ timeout: 5000 });
  86  |     
  87  |     fs.unlinkSync(invalidFilePath);
  88  |   });
  89  | 
  90  |   test('should handle duplicate submissions gracefully', async ({ page }) => {
  91  |     await page.click('text=New Project');
  92  |     await page.fill('input[name="name"]', 'Duplicate Submit Project');
  93  |     
  94  |     // Double click
  95  |     const createBtn = page.locator('button:has-text("Create Project")');
  96  |     await createBtn.click();
  97  |     await createBtn.click({ force: true }).catch(() => {});
  98  |     
  99  |     // Should only create one and redirect properly without 500 error
  100 |     await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/boq/);
  101 |   });
  102 | });
  103 | 
```