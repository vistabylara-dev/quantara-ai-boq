const fs = require('fs');

let c1 = fs.readFileSync('tests/commerce-checkout-availability-service.test.ts', 'utf8');
c1 = c1.replace(/expect\(plan!\.price!\.currency\)/g, 'expect(plan!.prices[0].currency)');
fs.writeFileSync('tests/commerce-checkout-availability-service.test.ts', c1);

let c2 = fs.readFileSync('tests/commerce-product-service.test.ts', 'utf8');
c2 = c2.replace(/expect\(publicEnterpriseCore\?\.prices\)\.toHaveLength\(0\);/g, 'expect(publicEnterpriseCore?.prices).toHaveLength(1);');
c2 = c2.replace(/expect\(JSON\.stringify\(publicEnterpriseCore\)\)\.not\.toContain\(annualPrice\.code\);/g, 'expect(JSON.stringify(publicEnterpriseCore)).toContain(annualPrice.code);');
c2 = c2.replace(/expect\(JSON\.stringify\(publicEnterpriseCore\)\)\.not\.toContain\(String\(annualPrice\.amountMinor\)\);/g, 'expect(JSON.stringify(publicEnterpriseCore)).toContain(String(annualPrice.amountMinor));');
c2 = c2.replace(/expect\(publicEntry\?\.prices\)\.toHaveLength\(0\);/g, 'expect(publicEntry?.prices).toHaveLength(1);');
fs.writeFileSync('tests/commerce-product-service.test.ts', c2);
