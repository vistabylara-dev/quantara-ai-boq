import { test, expect } from '@playwright/test';
import path from 'path';
import { prisma } from '../../src/lib/db/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

/**
 * The real, current journey: upload a source file → run schedule-table
 * detection on it (src/app/projects/[projectId]/files/page.tsx) → the
 * detected table rows are automatically turned into ExtractedEntity
 * candidates (see generateCandidatesFromStructuredTables, called from
 * table-extraction-handler.ts as part of that same job) → review and
 * confirm candidates on /extractions → import one into the BOQ via the
 * "reviewed" tab of AddItemFromSourceModal → verify it lands in the real
 * BOQ item list. The previous version of this spec asserted UI text
 * ("Upload Complete", "Import to BOQ") that no longer exists anywhere in
 * the app; none of that UI is recreated here — this rewrite drives the
 * actual current screens end to end instead.
 */
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
        legalName: 'Ext Test Company',
        tradeName: 'Ext Test Company',
        email: 'test@example.com'
      }
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        passwordHash: hashedPassword,
        fullName: 'Ext User',
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
    await prisma.client.create({ data: { companyId, name: 'Ext Test Client' } });
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

  test('should extract a schedule table from XLSX, review it, and import it into the BOQ', async ({ page }) => {
    test.setTimeout(120000);

    // Create project
    await page.goto('/projects');
    await page.click('text=New project');
    await page.fill('input[name="name"]', 'Extraction Test Project');
    await page.fill('input[name="reference"]', `EXT-${Date.now()}`);
    await page.click('text=Select or create a client');
    await page.click('text=Ext Test Client');
    await page.fill('input[name="location"]', 'Dubai');
    await page.click('button:has-text("Create project")');
    await expect(page).toHaveURL(/\/projects\/(?!new)[a-zA-Z0-9-]+$/);
    const projectUrl = page.url();
    await page.goto(`${projectUrl}/files`);

    // sample.xlsx contains a real "BOQ" sheet: Item/Description/Qty/Unit/Rate
    // rows for "Concrete Foundation" (50 m3) and "Steel Reinforcement"
    // (10 ton) — a genuine structured schedule table for the extraction
    // pipeline to detect, not a fixture that only satisfies a filename check.
    const xlsxPath = path.resolve(__dirname, 'fixtures', 'sample.xlsx');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([xlsxPath]);
    // setInputFiles() sets input.files correctly but React's onChange
    // listener on this hidden input doesn't reliably fire from that alone
    // in this app — explicitly dispatching a change event gets handleUpload
    // to actually run, matching what a real native file-picker selection
    // does in a browser (see the same pattern in edge-cases.spec.ts). Only
    // "change" is dispatched — React's file-input onChange listens for
    // that specific event, and also dispatching "input" caused a second,
    // duplicate handleUpload call.
    await fileInput.evaluate((el: HTMLInputElement) => {
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('text=sample.xlsx').first()).toBeVisible({ timeout: 20000 });

    // Select the uploaded source and run schedule-table detection on it.
    await page.click('text=sample.xlsx');
    await page.click('button:has-text("Detect Schedule Tables")');

    // The detection job runs and polls to completion client-side; the
    // detected table's real cell values are the actual evidence it worked.
    await expect(page.locator('text=Concrete Foundation')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('text=Steel Reinforcement')).toBeVisible();

    // Detected rows are automatically turned into review candidates (see
    // generateCandidatesFromStructuredTables) — confirm both on the
    // dedicated review workspace.
    await page.goto(`${projectUrl}/extractions`);
    await expect(page.locator('article', { hasText: 'Concrete Foundation' })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('article', { hasText: 'Steel Reinforcement' })).toBeVisible();

    for (const label of ['Concrete Foundation', 'Steel Reinforcement']) {
      const article = page.locator('article', { hasText: label });
      await article.getByRole('button', { name: 'Confirm' }).click();
      await expect(article.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
    }

    // With every candidate reviewed, the workspace links straight into the
    // BOQ with the reviewed tab pre-selected.
    await expect(page.locator('text=Continue to BOQ')).toBeVisible({ timeout: 10000 });
    await page.click('text=Continue to BOQ');
    await expect(page).toHaveURL(/\/boq/, { timeout: 20000 });

    // AddItemFromSourceModal opens on the "reviewed" tab (see
    // ?action=import-reviewed handling in the BOQ page) — select the
    // confirmed Concrete Foundation candidate and add it to the BOQ using
    // its own extracted quantity/unit.
    await page.click('text=Reviewed Extraction');
    await page.click('text=Concrete Foundation');
    await page.click('button:has-text("Add Reviewed Item to BOQ")');

    // The imported line now exists as a real BOQ item.
    await expect(page.locator('text=Concrete Foundation').first()).toBeVisible({ timeout: 15000 });
  });
});
