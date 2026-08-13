import { test, expect } from '@playwright/test';
import path from 'path';
import { prisma } from '../../src/lib/db/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import { SESSION_COOKIE_NAME } from '../../src/lib/auth/session-cookie-name';

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
    const response = await page.request.post('/api/auth/login', {
      data: { email: userEmail, password: 'Password123!' },
    });
    expect(response.status()).toBe(200);
    expect((await page.context().cookies()).some((cookie) => cookie.name === SESSION_COOKIE_NAME)).toBe(true);
  });

  test('should handle sign-out properly', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    // Assuming a user menu on the top right
    await page.click('button:has(svg.lucide-user), button:has(img[alt="User"])');
    // Click Sign Out
    await page.click('text=Sign out');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    
    // Try to access protected route directly
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should reject invalid file types', async ({ page }) => {
    test.setTimeout(60_000);
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
    await expect(page.getByRole('heading', { name: 'Invalid File Project', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.goto(`${page.url()}/files`);
    await expect(page.getByText(/No project sources are available yet/)).toBeVisible({ timeout: 20_000 });

    // Create a dummy exe file
    const invalidFilePath = path.join(os.tmpdir(), `quantara-invalid-${randomUUID()}.exe`);
    fs.writeFileSync(invalidFilePath, 'dummy');

    try {
      const fileInput = page.locator('input[type="file"]');
      const [uploadRes] = await Promise.all([
        page.waitForResponse((response) => /\/api\/projects\/[^/]+\/files$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST'),
        fileInput.setInputFiles([invalidFilePath]),
      ]);

      // Server-side rejects the unsupported type; UI must surface it clearly.
      expect(uploadRes.status()).toBeGreaterThanOrEqual(400);
      await expect(page.locator('text=Invalid file type').or(page.locator('text=not supported'))).toBeVisible({ timeout: 5000 });
    } finally {
      // Windows can briefly hold the file handle open after the multipart
      // upload request resolves, so retry cleanup without masking assertions.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          fs.unlinkSync(invalidFilePath);
          break;
        } catch (error) {
          if (attempt === 4) throw error;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }
  });

  test('should handle duplicate submissions gracefully', async ({ page }) => {
    // A UI double-click doesn't exercise a real race here: the form's
    // `disabled={isSubmitting}` guard plus `router.push` on success means
    // the "Create project" button is gone from the DOM (page already
    // navigated) well before a second Playwright-driven click could ever
    // land — confirmed by instrumenting the real click sequence, which
    // showed a single 201 and full navigation before the second click even
    // started. The actual race — two submissions reaching the server at
    // the same instant — is only reproducible by racing the API directly,
    // and that's also the deterministic way to verify server-side
    // idempotency without relying on UI/browser timing (see
    // createProjectWithDefaultBoq's projectReferenceExists pre-check +
    // the DB's @@unique([companyId, reference]) constraint, whose P2002 is
    // mapped to a clean 409 UNIQUE_CONSTRAINT in handleApiError).
    // A no-subscription company's real entitlements cap it at exactly one
    // project (see canCreateProject in entitlement-service.ts); the shared
    // fixture company already has one from "should reject invalid file
    // types", which would make every concurrent create here hit that 403
    // plan limit instead of the reference-uniqueness race this test is
    // actually about. Racing from a company with zero projects keeps both
    // requests under the limit, isolating the intended race to
    // createProjectWithDefaultBoq's projectReferenceExists pre-check + the
    // DB's @@unique([companyId, reference]) constraint, whose P2002 is
    // mapped to a clean 409 UNIQUE_CONSTRAINT in handleApiError.
    const dupCompanyId = randomUUID();
    const dupUserId = randomUUID();
    const dupEmail = `edge-dup-${Date.now()}@quantara.local`;
    await prisma.company.create({
      data: { id: dupCompanyId, legalName: 'Edge Dup Company', tradeName: 'Edge Dup Company', email: 'edge-dup@example.com' },
    });
    await prisma.user.create({
      data: {
        id: dupUserId,
        email: dupEmail,
        passwordHash: await bcrypt.hash('Password123!', 10),
        fullName: 'Edge Dup User',
        companyId: dupCompanyId,
        role: UserRole.COMPANY_OWNER,
        emailVerifiedAt: new Date(),
      },
    });
    const dupIndustry = await prisma.industryEngine.findFirstOrThrow();
    await prisma.companyIndustryEngine.create({ data: { companyId: dupCompanyId, industryEngineId: dupIndustry.id, enabled: true } });
    const dupClient = await prisma.client.create({ data: { companyId: dupCompanyId, name: 'Edge Dup Client' } });

    try {
      // Replace the shared fixture session with the dedicated duplicate-race
      // fixture user before exercising the concurrent API requests.
      await page.context().clearCookies();
      const response = await page.request.post('/api/auth/login', {
        data: { email: dupEmail, password: 'Password123!' },
      });
      expect(response.status()).toBe(200);
      expect((await page.context().cookies()).some((cookie) => cookie.name === SESSION_COOKIE_NAME)).toBe(true);

      const reference = `DUP-${Date.now()}`;
      const body = {
        name: 'Duplicate Submit Project',
        reference,
        clientId: dupClient.id,
        industryId: dupIndustry.id,
        location: 'Dubai',
      };

      const [res1, res2] = await Promise.all([
        page.request.post('/api/projects', { data: body }),
        page.request.post('/api/projects', { data: body }),
      ]);
      const statuses = [res1.status(), res2.status()].sort();

      // Exactly one request wins (201) and the other is rejected cleanly —
      // never two 201s (duplicate row) and never a raw 500.
      expect(statuses).toEqual([201, 409]);

      const created = await prisma.project.findMany({ where: { companyId: dupCompanyId, reference } });
      expect(created).toHaveLength(1);
    } finally {
      await prisma.project.deleteMany({ where: { companyId: dupCompanyId } });
      await prisma.user.delete({ where: { id: dupUserId } });
      await prisma.company.delete({ where: { id: dupCompanyId } });
    }
  });
});
