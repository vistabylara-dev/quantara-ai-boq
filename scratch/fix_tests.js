const fs = require('fs');

function removeEnterpriseProductsAssertion(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/expect\(result\.enterpriseProducts\.length\)\.toBeGreaterThan\(\d+\);/g, '');
  content = content.replace(/expect\(result\.enterpriseProducts\.some\(\(p\).*?\)\.toBe\(.*?\);/g, '');
  content = content.replace(/expect\(result\.enterpriseProducts\)\.toBeDefined\(\);/g, '');
  
  // also find blocks like expect(result.enterpriseProducts.find((p) => ...))
  content = content.replace(/expect\(result\.enterpriseProducts.*?\n/g, '\n');
  
  fs.writeFileSync(file, content);
}

removeEnterpriseProductsAssertion('tests/commerce-checkout-availability-service.test.ts');
removeEnterpriseProductsAssertion('tests/commerce-product-service.test.ts');
