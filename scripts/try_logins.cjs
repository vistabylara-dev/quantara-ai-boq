const fs = require('fs');

// Requires PROD_EVIDENCE_URL/PROD_EVIDENCE_EMAIL/PROD_EVIDENCE_PASSWORD in
// the environment — no hardcoded production credentials, and no
// multi-credential guessing against a live login endpoint.
async function tryLogin(baseUrl, email, password) {
  const loginRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (loginRes.ok) {
    console.log("SUCCESS!");
    const cookies = loginRes.headers.get('set-cookie');
    const evidenceRes = await fetch(`${baseUrl}/api/admin/master-catalogue/production-evidence`, {
      headers: { 'Cookie': cookies }
    });
    if (evidenceRes.ok) {
      const json = await evidenceRes.json();
      fs.writeFileSync('prod_evidence.json', JSON.stringify(json, null, 2));
      console.log("Evidence fetched!");
      process.exit(0);
    } else {
      console.log("Auth succeeded but evidence fetch failed:", await evidenceRes.text());
    }
  } else {
    console.log("Failed:", await loginRes.text());
  }
}

async function main() {
  const baseUrl = process.env.PROD_EVIDENCE_URL;
  const email = process.env.PROD_EVIDENCE_EMAIL;
  const password = process.env.PROD_EVIDENCE_PASSWORD;
  if (!baseUrl || !email || !password) {
    console.error("PROD_EVIDENCE_URL, PROD_EVIDENCE_EMAIL, and PROD_EVIDENCE_PASSWORD must be set.");
    process.exit(1);
  }
  await tryLogin(baseUrl, email, password);
}

main();
