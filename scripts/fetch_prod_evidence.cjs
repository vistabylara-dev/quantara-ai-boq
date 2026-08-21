const { chromium } = require('@playwright/test');
const fs = require('fs');

(async () => {
  console.log("Launching browser to fetch production evidence...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const liveUrl = process.env.PROD_EVIDENCE_URL;
    const email = process.env.PROD_EVIDENCE_EMAIL;
    const password = process.env.PROD_EVIDENCE_PASSWORD;
    if (!liveUrl || !email || !password) {
      console.error("PROD_EVIDENCE_URL, PROD_EVIDENCE_EMAIL, and PROD_EVIDENCE_PASSWORD must be set.");
      process.exit(1);
    }
    console.log(`Navigating to ${liveUrl}...`);

    // 1. Go to Home / Login
    await page.goto(liveUrl);

    // 2. Login
    console.log("Logging in...");
    await page.waitForSelector('a[href="/auth/sign-in"]', { timeout: 10000 }).then(el => el.click());

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    console.log("Login successful. Fetching evidence API...");

    // 3. Hit the API endpoint
    const response = await page.goto(`${liveUrl}/api/admin/master-catalogue/production-evidence`);
    
    if (response) {
      const json = await response.json();
      fs.writeFileSync('prod_evidence.json', JSON.stringify(json, null, 2));
      console.log("Successfully saved production evidence to prod_evidence.json");
      console.log("Response summary:");
      if (json.data) {
        console.table(json.data.map(d => ({
           id: d.id,
           status: d.status,
           itemCount: d.itemCount,
           assignmentMatch: d.assignmentMatch
        })));
      } else {
        console.log(json);
      }
    } else {
      console.log("Failed to get response");
    }

  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
