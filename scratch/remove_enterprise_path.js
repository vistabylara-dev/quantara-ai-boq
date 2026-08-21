const fs = require('fs');
let code = fs.readFileSync('src/lib/services/commerce-checkout-availability-service.ts', 'utf8');

// Remove EnterpriseAnnualPlan types and code
code = code.replace(/\/\*\*[\s\S]*?export type EnterpriseAnnualPlan = \{[\s\S]*?\};\n/, '');
code = code.replace(/\s*enterpriseProducts: EnterpriseAnnualPlan\[\];\n/, '\n');
code = code.replace(/const ENTERPRISE_ANNUAL_PRODUCT_CODES = \["enterprise_core", "enterprise_scale", "enterprise_authority"\] as const;[\s\S]*?async function getEnterpriseAnnualPlans\(\): Promise<EnterpriseAnnualPlan\[\]> \{[\s\S]*?\}\n/, '');

// Remove it from the return of getCheckoutAvailability
code = code.replace(/const enterpriseProducts = await getEnterpriseAnnualPlans\(\);\n/, '');
code = code.replace(/return \{ hasExistingSubscription, products: result, enterpriseProducts \};/, 'return { hasExistingSubscription, products: result };');

fs.writeFileSync('src/lib/services/commerce-checkout-availability-service.ts', code);
