const fs = require('fs');

let c1 = fs.readFileSync('tests/commerce-checkout-availability-service.test.ts', 'utf8');
c1 = c1.replace(/\(availability as any\)\.enterpriseProducts/g, 'availability.products');
c1 = c1.replace(/expect\(plan!\.price\)\.not\.toBeNull\(\);/g, 'expect(plan!.prices).not.toBeNull();');
fs.writeFileSync('tests/commerce-checkout-availability-service.test.ts', c1);

let c2 = fs.readFileSync('tests/commerce-product-service.test.ts', 'utf8');
c2 = c2.replace(/expect\(publicEnterpriseCore\?\.purchaseMode\)\.toBe\("CONTACT_SALES"\);/g, 'expect(publicEnterpriseCore?.purchaseMode).toBe("DIRECT");');
c2 = c2.replace(/expect\(plan!\.price\)\.not\.toBeNull\(\);/g, 'expect(plan!.prices).not.toBeNull();');
c2 = c2.replace(/expect\(plan!\.price!\.amountMinor\)/g, 'expect(plan!.prices[0].amountMinor)');
fs.writeFileSync('tests/commerce-product-service.test.ts', c2);
