const fs = require('fs');

// Requires PROD_EVIDENCE_URL/PROD_EVIDENCE_EMAIL/PROD_EVIDENCE_PASSWORD in
// the environment — no hardcoded production credentials or fallback.
async function fetchEvidence() {
  const baseUrl = process.env.PROD_EVIDENCE_URL;
  const email = process.env.PROD_EVIDENCE_EMAIL;
  const password = process.env.PROD_EVIDENCE_PASSWORD;
  if (!baseUrl || !email || !password) {
    console.error("PROD_EVIDENCE_URL, PROD_EVIDENCE_EMAIL, and PROD_EVIDENCE_PASSWORD must be set.");
    process.exit(1);
  }

  console.log("Logging in via API...");
  const loginRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!loginRes.ok) {
    console.error("Login failed:", await loginRes.text());
    process.exit(1);
  }
  
  const cookies = loginRes.headers.get('set-cookie');
  if (!cookies) {
    console.error("No cookies received");
    process.exit(1);
  }
  console.log("Login successful. Fetching evidence...");

  const evidenceRes = await fetch(`${baseUrl}/api/admin/master-catalogue/production-evidence`, {
    headers: { 'Cookie': cookies }
  });
  
  if (!evidenceRes.ok) {
    console.error("Evidence fetch failed:", await evidenceRes.text());
    process.exit(1);
  }
  
  const json = await evidenceRes.json();
  const dest = 'prod_evidence.json';
  fs.writeFileSync(dest, JSON.stringify(json, null, 2));
  console.log(`Saved to ${dest}`);
  
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
}

fetchEvidence().catch(console.error);
