const fs = require('fs');
let code = fs.readFileSync('src/app/settings/subscription/page.tsx', 'utf8');

const regex = /const enterpriseProducts = ENTERPRISE_PRODUCT_ORDER\.map\(\(productCode\) =>[\s\S]*?checkoutAvailability\?\.enterpriseProducts\?\.find\(\(product\) => product\.productCode === productCode\),[\s\S]*?\)\.filter\(\(product\): product is EnterpriseAnnualPlan => Boolean\(\w+\)\);/;

const toConstruct = `const enterpriseProducts = ENTERPRISE_PRODUCT_ORDER.map((productCode) =>
    checkoutAvailability?.products.find((product) => product.productCode === productCode),
  ).filter((product): product is CheckoutOptionProduct => Boolean(product));`;

code = code.replace(regex, toConstruct);

fs.writeFileSync('src/app/settings/subscription/page.tsx', code);
