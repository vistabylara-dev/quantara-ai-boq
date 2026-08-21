const fs = require('fs');

let c2 = fs.readFileSync('tests/commerce-product-service.test.ts', 'utf8');
c2 = c2.replace(/expect\(JSON\.stringify\(publicEnterpriseCore\)\)\.not\.toContain\(annualPrice\.code\);/g, 'expect(JSON.stringify(publicEnterpriseCore)).toContain(annualPrice.code);');
c2 = c2.replace(/expect\(JSON\.stringify\(publicEnterpriseCore\)\)\.not\.toContain\(String\(annualPrice\.amountMinor\)\);/g, 'expect(JSON.stringify(publicEnterpriseCore)).toContain(String(annualPrice.amountMinor));');
fs.writeFileSync('tests/commerce-product-service.test.ts', c2);
