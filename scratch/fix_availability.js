const fs = require('fs');
let code = fs.readFileSync('src/lib/services/commerce-checkout-availability-service.ts', 'utf8');

code = code.replace(/enterpriseProducts: EnterpriseAnnualPlan\[\];/g, '');

fs.writeFileSync('src/lib/services/commerce-checkout-availability-service.ts', code);
