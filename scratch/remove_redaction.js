const fs = require('fs');
let p = fs.readFileSync('src/lib/repositories/commerce-product-repository.ts', 'utf8');
p = p.replace(/const PUBLIC_PRICE_REDACTED_PRODUCT_CODES = new Set\(\["enterprise_core", "enterprise_scale", "enterprise_authority"\]\);/, 'const PUBLIC_PRICE_REDACTED_PRODUCT_CODES = new Set<string>();');
fs.writeFileSync('src/lib/repositories/commerce-product-repository.ts', p);
