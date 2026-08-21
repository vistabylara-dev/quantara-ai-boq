const fs = require('fs');

// checkout URL
let chk = fs.readFileSync('src/lib/services/commerce-checkout-service.ts', 'utf8');
chk = chk.replace('return { checkoutSessionId: session.id, checkoutUrl: session.url };', 'return { checkoutSessionId: session.id, checkoutUrl: session.url! };');
fs.writeFileSync('src/lib/services/commerce-checkout-service.ts', chk);

// tests edge cases
let edge = fs.readFileSync('tests/e2e/edge-cases.spec.ts', 'utf8');
edge = edge.replace(/name: 'Test Company'/g, "legalName: 'Test Company', tradeName: 'Test Company', email: 'test@example.com'");
edge = edge.replace(/name: 'Test User'/g, "fullName: 'Test User'");
fs.writeFileSync('tests/e2e/edge-cases.spec.ts', edge);

// extraction real
let ext = fs.readFileSync('tests/e2e/extraction-real.spec.ts', 'utf8');
ext = ext.replace(/name: 'Test Company'/g, "legalName: 'Test Company', tradeName: 'Test Company', email: 'test@example.com'");
ext = ext.replace(/name: 'Test User'/g, "fullName: 'Test User'");
fs.writeFileSync('tests/e2e/extraction-real.spec.ts', ext);

// workspace
let ws = fs.readFileSync('tests/e2e/workspace.spec.ts', 'utf8');
ws = ws.replace(/title: 'Section 1'/g, "title: 'Section 1', companyId: companyAId, code: 'SEC1'");
ws = ws.replace(/isActive: true, isActive: true/g, "isActive: true");
ws = ws.replace(/boqId: boqAId,/g, "boqId: boqAId, companyId: companyAId, code: 'ITM1',");
ws = ws.replace(/revisionNumber: 1,/g, "revisionNumber: 1, projectId: projectAId, createdByName: 'Workspace User',");
fs.writeFileSync('tests/e2e/workspace.spec.ts', ws);

console.log("Fixes applied!");
