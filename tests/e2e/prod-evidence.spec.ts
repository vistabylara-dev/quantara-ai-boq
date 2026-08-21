import { test, expect } from '@playwright/test';
import * as fs from 'fs';

/**
 * Live-production evidence gathering — intentionally NOT part of the normal
 * local/CI suite. Requires PROD_EVIDENCE_URL, PROD_EVIDENCE_EMAIL, and
 * PROD_EVIDENCE_PASSWORD to be supplied via the environment; there is no
 * fallback credential, and the test skips safely (does not fail the run)
 * when they are absent, so it can never accidentally execute against
 * production during a normal test pass.
 */
test('Fetch production evidence', async ({ page }) => {
  const liveUrl = process.env.PROD_EVIDENCE_URL;
  const email = process.env.PROD_EVIDENCE_EMAIL;
  const password = process.env.PROD_EVIDENCE_PASSWORD;
  test.skip(!liveUrl || !email || !password, 'PROD_EVIDENCE_URL/PROD_EVIDENCE_EMAIL/PROD_EVIDENCE_PASSWORD not set — skipping live production evidence gathering.');

  test.setTimeout(120000);
  console.log(`Navigating to ${liveUrl}...`);

  await page.goto(`${liveUrl}/auth/sign-in`);
  console.log("Logging in...");

  await page.fill('input[name="email"]', email!);
  await page.fill('input[name="password"]', password!);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  console.log("Login successful. Fetching evidence API...");

  const response = await page.goto(`${liveUrl}/api/admin/master-catalogue/production-evidence`);
  expect(response).toBeTruthy();
  if (response) {
    const json = await response.json();
    fs.writeFileSync('prod_evidence.json', JSON.stringify(json, null, 2));
    console.log("Successfully saved production evidence to prod_evidence.json");
    if (json.data) {
      console.table(json.data.map((d: any) => ({
         id: d.id,
         status: d.status,
         itemCount: d.itemCount,
         assignmentMatch: d.assignmentMatch
      })));
    } else {
      console.log(json);
    }
  }
});
