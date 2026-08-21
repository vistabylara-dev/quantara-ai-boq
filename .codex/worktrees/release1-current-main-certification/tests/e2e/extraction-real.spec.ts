import { test, expect } from '@playwright/test';
import path from 'path';
import { prisma } from '../../src/lib/db/prisma';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

test.describe('Real File Extraction', () => {
  let companyId: string;
  let userId: string;
  let userEmail: string;

  test.beforeAll(async () => {
    companyId = randomUUID();
    userId = randomUUID();
    userEmail = `extraction-${Date.now()}@quantara.local`;

    await prisma.company.create({
      data: {
        id: companyId,
        name: 'Extraction Test Company',
        domain: 'quantara.local',
      }
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        password: hashedPassword,
        name: 'Extraction User',
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

  test('should process text PDF, scanned PDF, and XLSX correctly', async ({ page }) => {
    test.setTimeout(120000); // 2 mins for extraction

    // Create project
    await page.click('text=New Project');
    await page.fill('input[name="name"]', 'Extraction Test Project');
    await page.click('button:has-text("Create Project")');
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/boq/);
    
    // Upload files
    await page.click('text=Upload Files');
    
    // Path to fixtures
    const fixturesDir = path.resolve(__dirname, 'fixtures');
    const textPdfPath = path.join(fixturesDir, 'sample-text.pdf');
    const scannedPdfPath = path.join(fixturesDir, 'sample-scanned.pdf');
    const xlsxPath = path.join(fixturesDir, 'sample.xlsx');

    const fileInput = page.locator('input[type="file"]');
    
    // Upload text PDF
    await fileInput.setInputFiles([textPdfPath]);
    await expect(page.locator('text=Upload Complete').first()).toBeVisible({ timeout: 15000 });
    
    // Upload scanned PDF
    await fileInput.setInputFiles([scannedPdfPath]);
    await expect(page.locator('text=Upload Complete').nth(1)).toBeVisible({ timeout: 15000 });
    
    // Upload XLSX
    await fileInput.setInputFiles([xlsxPath]);
    await expect(page.locator('text=Upload Complete').nth(2)).toBeVisible({ timeout: 15000 });
    
    // Close upload modal
    await page.keyboard.press('Escape');

    // Wait for processing to complete on all files
    // In UI, we expect "Review Required" or "Completed" status. 
    // We will wait until there are no "Processing" labels.
    await expect(page.locator('text=Processing')).toHaveCount(0, { timeout: 60000 });
    
    // The scanned PDF should require review or show a warning because it has no text layer.
    // The XLSX should process fine and find items.
    
    // Let's verify the XLSX extraction by going to Review
    await page.click('text=Review');
    
    // Expect to see extracted items from the XLSX
    await expect(page.locator('text=Concrete Foundation')).toBeVisible();
    await expect(page.locator('text=Steel Reinforcement')).toBeVisible();
    
    // Confirm import
    await page.click('text=Import to BOQ');
    await expect(page.locator('text=successfully imported')).toBeVisible();
  });
});
