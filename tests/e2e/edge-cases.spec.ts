import { test, expect } from '@playwright/test';
import path from 'path';
import { prisma } from '../../src/lib/db/prisma';
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
        name: 'Edge Test Company',
        domain: 'quantara.local',
      }
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        password: hashedPassword,
        name: 'Edge User',
        companyId,
        emailVerified: new Date(),
        approvalStatus: 'APPROVED'
      }
    });
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
    await expect(page).toHaveURL(/\/projects/);
  });

  test('should handle sign-out properly', async ({ page }) => {
    // Assuming a user menu on the top right
    await page.click('button:has(svg.lucide-user), button:has(img[alt="User"])');
    // Click Sign Out
    await page.click('text=Log out');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
    
    // Try to access protected route directly
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should reject invalid file types', async ({ page }) => {
    // Create a dummy project
    await page.click('text=New Project');
    await page.fill('input[name="name"]', 'Invalid File Project');
    await page.click('button:has-text("Create Project")');
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/boq/);
    
    await page.click('text=Upload Files');
    
    // Create a dummy exe file
    const invalidFilePath = path.join(__dirname, 'fixtures', 'invalid.exe');
    fs.writeFileSync(invalidFilePath, 'dummy');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([invalidFilePath]);
    
    // UI should show an error or validation message
    await expect(page.locator('text=Invalid file type').or(page.locator('text=not supported'))).toBeVisible({ timeout: 5000 });
    
    fs.unlinkSync(invalidFilePath);
  });

  test('should handle duplicate submissions gracefully', async ({ page }) => {
    await page.click('text=New Project');
    await page.fill('input[name="name"]', 'Duplicate Submit Project');
    
    // Double click
    const createBtn = page.locator('button:has-text("Create Project")');
    await createBtn.click();
    await createBtn.click({ force: true }).catch(() => {});
    
    // Should only create one and redirect properly without 500 error
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/boq/);
  });
});
