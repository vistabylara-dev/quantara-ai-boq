import { test, expect } from '@playwright/test';
import path from 'path';
import { prisma } from '../../src/lib/db/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import fs from 'fs';

test.describe('Edge Cases & Resiliency', () => {
  let companyId: string;
  let userId: string;
  let userEmail: string;

  test.beforeAll(async () => {
    companyId = randomUUID();
    userId = randomUUID();
    userEmail = `edge-${Date.now()}@quantara.local`;

    await prisma.company.create({
      data: {
        id: companyId,
        legalName: 'Edge Test Company',
        tradeName: 'Edge Test Company',
        email: 'test@example.com',
      }
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        passwordHash: hashedPassword,
        fullName: 'Edge User',
        companyId,
        role: UserRole.COMPANY_OWNER,
        emailVerifiedAt: new Date()
      }
    });

    // Project creation requires an industry engine enabled for the company
    // (see getEnabledIndustry in industry-repository.ts) and the new-project
    // form auto-selects the first one it finds via GET /api/industries.
    const industry = await prisma.industryEngine.findFirst() ?? (await prisma.industryEngine.create({
      data: { name: 'Construction', key: 'construction', description: 'Construction', configJson: {} }
    }));
    await prisma.companyIndustryEngine.upsert({
      where: { companyId_industryEngineId: { companyId, industryEngineId: industry.id } },
      update: { enabled: true },
      create: { companyId, industryEngineId: industry.id, enabled: true },
    });

    // Project creation also requires a real clientId, selected via
    // ClientPicker (see src/components/projects/client-picker.tsx) — not a
    // plain text field.
    await prisma.client.create({ data: { companyId, name: 'Edge Test Client' } });
  });

  test.afterAll(async () => {
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.company.delete({ where: { id: companyId } });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', userEmail);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should handle sign-out properly', async ({ page }) => {
    // Assuming a user menu on the top right
    await page.click('button:has(svg.lucide-user), button:has(img[alt="User"])');
    // Click Sign Out
    await page.click('text=Sign out');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
    
    // Try to access protected route directly
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should reject invalid file types', async ({ page }) => {
    // Create a dummy project
    await page.goto('/projects');
    await page.click('text=New project');
    await page.fill('input[name="name"]', 'Invalid File Project');
    await page.fill('input[name="reference"]', `INV-${Date.now()}`);
    await page.click('text=Select or create a client');
    await page.click('text=Edge Test Client');
    await page.fill('input[name="location"]', 'Dubai');
    await page.click('button:has-text("Create project")');
    await expect(page).toHaveURL(/\/projects\/(?!new)[a-zA-Z0-9-]+$/);
    await page.goto(`${page.url()}/files`);

    // Create a dummy exe file
    const invalidFilePath = path.join(__dirname, 'fixtures', 'invalid.exe');
    fs.writeFileSync(invalidFilePath, 'dummy');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([invalidFilePath]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/debug_invalid_file2.png', fullPage: true });

    // UI should show an error or validation message
    await expect(page.locator('text=Invalid file type').or(page.locator('text=not supported'))).toBeVisible({ timeout: 5000 });
    
    fs.unlinkSync(invalidFilePath);
  });

  test('should handle duplicate submissions gracefully', async ({ page }) => {
    await page.goto('/projects');
    await page.click('text=New project');
    await page.fill('input[name="name"]', 'Duplicate Submit Project');
    await page.fill('input[name="reference"]', `DUP-${Date.now()}`);
    await page.click('text=Select or create a client');
    await page.click('text=Edge Test Client');
    await page.fill('input[name="location"]', 'Dubai');
    
    // Double click
    const createBtn = page.locator('button:has-text("Create project")');
    await createBtn.click();
    await createBtn.click({ force: true }).catch(() => {});

    // Should only create one and redirect properly without 500 error
    await expect(page).toHaveURL(/\/projects\/(?!new)[a-zA-Z0-9-]+$/);
  });
});
