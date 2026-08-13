import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { UserRole } from '@prisma/client';
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
        legalName: 'Doc Gen Test Company',
        tradeName: 'Doc Gen Test Company',
        email: 'docgen@example.com'
      }
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        passwordHash: hashedPassword,
        fullName: 'Doc Gen User',
        companyId,
        role: UserRole.COMPANY_OWNER,
        emailVerifiedAt: new Date(),
      }
    });
    
    // Create base data to generate from. Project.clientId/industryEngineId
    // are real foreign keys — they must reference actual Client/IndustryEngine
    // rows, not the company's own id, and a BOQRevisionSnapshot.boqId must
    // reference a real BOQ row (none of this existed in the original fixture).
    const client = await prisma.client.create({ data: { companyId, name: 'Doc Gen Test Client' } });
    const industry = await prisma.industryEngine.findFirst() ?? (await prisma.industryEngine.create({
      data: { name: 'Construction', key: 'construction', description: 'Construction', configJson: {} }
    }));
    await prisma.companyIndustryEngine.upsert({
      where: { companyId_industryEngineId: { companyId, industryEngineId: industry.id } },
      update: { enabled: true },
      create: { companyId, industryEngineId: industry.id, enabled: true },
    });

    // The "Generate document" button stays disabled until a template is
    // selected, and the Template select has nothing to select without at
    // least one DocumentTemplate for the company.
    await prisma.documentTemplate.create({
      data: {
        companyId,
        name: 'Doc Gen Test Template',
        code: 'DOC_GEN_TEST_TMPL',
        type: 'CORPORATE_TECHNICAL',
        isActive: true,
        styleConfigJson: {},
        contentConfigJson: {},
      },
    });

    const projectId = randomUUID();
    await prisma.project.create({
        data: {
            id: projectId,
            name: 'Doc Gen Project',
            companyId,
            reference: 'DOC-1',
            slug: 'doc-gen-project',
            clientId: client.id,
            industryEngineId: industry.id
        }
    });

    // PDF/XLSX/DOCX generation requires a locked revision (see
    // FINAL_ONLY_TYPES / computeDocumentReadiness) — seeded locked directly
    // since this is a fixture, not exercising the lock transition itself.
    const boq = await prisma.bOQ.create({
      data: { companyId, projectId, title: 'Doc Gen BOQ', isLocked: true, lockedAt: new Date() },
    });

    const snapshotId = randomUUID();
    await prisma.bOQRevisionSnapshot.create({
        data: {
            id: snapshotId,
            boqId: boq.id,
            projectId,
            companyId,
            revisionNumber: 1,
            createdByName: 'Test User',
            snapshotJson: {
                summaryJson: {},
                sectionsJson: []
            }
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
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should generate and download PDF, XLSX, and CSV', async ({ page }) => {
    test.setTimeout(90000);

    // Current documents page: pick Format from a select, click "Generate
    // document", then click "Download" on the newly completed history row
    // (see src/app/projects/[projectId]/documents/page.tsx) — there is no
    // per-format "Export as X" button.
    await page.goto('/projects/doc-gen-project/documents');

    for (const format of ['PDF', 'CSV', 'XLSX'] as const) {
      await page.getByLabel('Format').selectOption(format);
      await page.click('button:has-text("Generate document")');
      const downloadLink = page.locator('a:has-text("Download")').first();
      await expect(downloadLink).toBeVisible({ timeout: 30000 });
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadLink.click(),
      ]);
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();
    }
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
