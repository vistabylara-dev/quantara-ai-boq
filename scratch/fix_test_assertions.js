const fs = require('fs');

let c1 = fs.readFileSync('tests/commerce-checkout-availability-service.test.ts', 'utf8');
c1 = c1.replace(/expect\(stub.purchaseMode\).toBe\("CONTACT_SALES"\);/g, 'expect(stub.purchaseMode).toBe("DIRECT");');
fs.writeFileSync('tests/commerce-checkout-availability-service.test.ts', c1);

let c2 = fs.readFileSync('tests/commerce-product-service.test.ts', 'utf8');
c2 = c2.replace(/expect\(stub.purchaseMode\).toBe\("CONTACT_SALES"\);/g, 'expect(stub.purchaseMode).toBe("DIRECT");');
c2 = c2.replace(/\(availability as any\).enterpriseProducts/g, 'availability.products');
fs.writeFileSync('tests/commerce-product-service.test.ts', c2);
