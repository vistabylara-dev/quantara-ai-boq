import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

test.describe('Document Generation Validation', () => {
  let companyId: string;
  let userId: string;
  let userEmail: string;

  test.beforeAll(async () => {
    companyId = randomUUID();
    userId = randomUUID();
    userEmail = `docgen-${Date.now()}@quantara.local`;

    await prisma.company.create({
      data: {
        id: companyId,
        name: 'Doc Gen Test Company',
        domain: 'quantara.local',
      }
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        password: hashedPassword,
        name: 'Doc Gen User',
        companyId,
        emailVerified: new Date(),
        approvalStatus: 'APPROVED'
      }
    });
    
    // Create base data to generate from
    const projectId = randomUUID();
    await prisma.project.create({
        data: {
            id: projectId,
            name: 'Doc Gen Project',
            companyId,
            boqSettingsJson: {}
        }
    });
    
    const snapshotId = randomUUID();
    await prisma.boqRevisionSnapshot.create({
        data: {
            id: snapshotId,
            projectId,
            revisionNumber: 1,
            createdById: userId,
            summaryJson: {},
            sectionsJson: [
                {
                    id: randomUUID(),
                    key: 'SEC-1',
                    name: 'Generated Section',
                    orderIndex: 0,
                    items: [
                        {
                            id: randomUUID(),
                            key: 'ITM-1',
                            name: 'Generated Item',
                            quantity: 10,
                            unit: 'm2',
                            orderIndex: 0,
                            options: []
                        }
                    ]
                }
            ]
        }
    });
    
    // Set the latest snapshot
    await prisma.project.update({
        where: { id: projectId },
        data: { latestSnapshotId: snapshotId }
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

  test('should generate and download PDF, XLSX, and CSV', async ({ page }) => {
    test.setTimeout(90000);
    
    await page.click('text=Doc Gen Project');
    await page.click('text=Export');
    
    // PDF
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Export as PDF')
    ]);
    const pdfPath = await pdfDownload.path();
    expect(pdfPath).toBeTruthy();
    
    // CSV
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Export as CSV')
    ]);
    const csvPath = await csvDownload.path();
    expect(csvPath).toBeTruthy();

    // XLSX
    const [xlsxDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Export as Excel')
    ]);
    const xlsxPath = await xlsxDownload.path();
    expect(xlsxPath).toBeTruthy();
  });
  
  test('should generate Proposal and Technical Report', async ({ page }) => {
    test.setTimeout(90000);
    await page.click('text=Doc Gen Project');
    
    // Proposal
    await page.click('text=Proposals');
    await page.click('text=New Proposal');
    await page.fill('input[name="clientName"]', 'Test Client');
    await page.click('button:has-text("Create Proposal")');
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/proposals\/[a-zA-Z0-9-]+/);
    await expect(page.locator('text=Generated Item')).toBeVisible();

    // Technical Report
    await page.goto('/projects');
    await page.click('text=Doc Gen Project');
    await page.click('text=Reports');
    await page.click('text=New Report');
    await page.fill('input[name="title"]', 'Test Report');
    await page.click('button:has-text("Create Report")');
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/technical-reports\/[a-zA-Z0-9-]+/);
    await expect(page.locator('text=Test Report')).toBeVisible();
  });
});
