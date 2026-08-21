const fs = require('fs');
let c1 = fs.readFileSync('tests/stripe-live-sync-service.test.ts', 'utf8');
c1 = c1.replace(/expect\(stub\.purchaseMode\)\.toBe\("CONTACT_SALES"\);/g, 'expect(stub.purchaseMode).toBe("DIRECT");');
fs.writeFileSync('tests/stripe-live-sync-service.test.ts', c1);

let c2 = fs.readFileSync('tests/commerce-product-routes.test.ts', 'utf8');
c2 = c2.replace(/expect\(enterpriseStub\.purchaseMode\)\.toBe\("CONTACT_SALES"\);/g, 'expect(enterpriseStub.purchaseMode).toBe("DIRECT");');
c2 = c2.replace(/expect\(enterpriseCore\.purchaseMode\)\.toBe\("CONTACT_SALES"\);/g, 'expect(enterpriseCore.purchaseMode).toBe("DIRECT");');
fs.writeFileSync('tests/commerce-product-routes.test.ts', c2);

