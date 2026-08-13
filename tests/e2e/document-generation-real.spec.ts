import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { UserRole, BOQStatus } from '@prisma/client';
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
        email: 'docgen@example.com',
        // CLIENT-audience generation on a locked BOQ requires a complete
        // company profile (see assertCompanyProfileComplete in
        // document-generation-service.ts) — address and tax registration
        // number specifically, beyond the fields already set above.
        address: '123 Test Street, Dubai, UAE',
        taxRegistrationNumber: 'TRN-TEST-0001',
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
      data: { companyId, projectId, title: 'Doc Gen BOQ', isLocked: true, lockedAt: new Date(), status: BOQStatus.LOCKED },
    });

    // generateDocument() refuses to generate from a locked BOQ with zero
    // items (BOQ_REVISION_EMPTY), and separately re-verifies a locked BOQ's
    // live totals against its immutable snapshot (assertMatchesLockedSnapshot
    // in document-generation-service.ts) — a snapshot must exist with the
    // real section/item shape the live BOQ has, or generation 500s. Seeding
    // one real section/item, then re-reading the BOQ with the exact same
    // include shape the real lock transition uses (see snapshotValue in
    // boq-repository.ts) keeps the snapshot's totals identical to the live
    // BOQ's by construction, rather than trying to hand-compute a match.
    const section = await prisma.bOQSection.create({
      data: { companyId, boqId: boq.id, code: 'A', title: 'General', sortOrder: 1 },
    });
    await prisma.bOQItem.create({
      data: {
        companyId,
        sectionId: section.id,
        itemNumber: 1,
        itemCode: 'ITM-001',
        category: 'General',
        description: 'Test Item',
        quantity: 1,
        unit: 'nr',
        unitCost: 100,
        sellingRate: 100,
        totalAmount: 100,
        sortOrder: 1,
      },
    });
    const boqWithSections = await prisma.bOQ.findUniqueOrThrow({
      where: { id: boq.id },
      include: { sections: { include: { items: true } } },
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
            snapshotJson: JSON.parse(JSON.stringify(boqWithSections)),
        }
    });

    // The Proposals wizard's BOQ_REVISION source step only lists documents
    // that are already COMPLETED with audience CLIENT for the selected BOQ
    // (see loadDocuments in proposals/page.tsx) — seeded directly so test 2
    // does not depend on test 1 having generated one first.
    const template = await prisma.documentTemplate.findFirstOrThrow({ where: { companyId } });
    await prisma.generatedDocument.create({
      data: {
        companyId,
        projectId,
        boqId: boq.id,
        templateId: template.id,
        revisionNumber: 1,
        type: 'PDF',
        audience: 'CLIENT',
        status: 'COMPLETED',
        fileName: 'doc-gen-proposal-source.pdf',
        generatedByName: 'Test User',
        completedAt: new Date(),
      },
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

    const downloadLinks = page.locator('a:has-text("Download")');
    // Wait for the fixture GeneratedDocument row's own Download link to
    // actually render before taking any row-count baseline — the
    // "Generation history" heading (a static JSX node) can paint in an
    // earlier commit than the fetched table rows, so waiting on it alone
    // still let countBefore read 0 and made the fixture row's later,
    // unrelated appearance look like proof this iteration's click had
    // produced a fresh row, when "Generate document" had produced nothing.
    await expect(downloadLinks).toHaveCount(1, { timeout: 20000 });

    for (const format of ['PDF', 'CSV', 'XLSX'] as const) {
      // A fixture GeneratedDocument row (seeded in beforeAll, for the
      // proposals test) already renders its own Download link on this same
      // project's history table, so "a Download link is visible" is true
      // even before this iteration's click does anything — asserting on
      // row-count growth (rather than mere visibility) is what actually
      // proves *this* generation produced the newest row before it's opened.
      const countBefore = await downloadLinks.count();
      await page.getByLabel('Format').selectOption(format);
      await page.click('button:has-text("Generate document")');
      await expect(downloadLinks).toHaveCount(countBefore + 1, { timeout: 30000 });

      const downloadLink = downloadLinks.first();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadLink.click(),
      ]);
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();
    }
  });
  
  test('should create a client proposal from a locked BOQ revision', async ({ page }) => {
    test.setTimeout(90000);

    // Current wizard: Type -> Source -> Access -> Review (see
    // src/app/projects/[projectId]/proposals/page.tsx). Only the BOQ_REVISION
    // path is exercised here — it only needs a locked BOQ and a COMPLETED
    // CLIENT-audience document, both seeded in beforeAll. The
    // TECHNICAL_REPORT_REVISION path requires a full report-generation run
    // and is not covered by this spec.
    await page.goto('/projects/doc-gen-project/proposals');
    await page.click('button:has-text("Create client proposal")');
    await page.click('text=Create BOQ Proposal');

    await page.click('text=R01 · locked');
    await page.click('text=PDF — doc-gen-proposal-source.pdf');
    await page.click('button:has-text("Continue")');

    await page.getByLabel('Recipient name').fill('Test Client Recipient');
    await page.getByLabel('Recipient email').fill('recipient@example.com');
    await page.click('button:has-text("Continue")');

    await page.click('button:has-text("Create Proposal")');
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+\/proposals\/[a-zA-Z0-9-]+$/, { timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Test Client Recipient' })).toBeVisible({ timeout: 20000 });
  });
});
