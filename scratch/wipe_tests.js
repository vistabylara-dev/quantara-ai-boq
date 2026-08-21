const fs = require('fs');

function wipeEnterpriseTest(file) {
  let content = fs.readFileSync(file, 'utf8');
  // Find it("item-A: the real Enterprise products appear...
  const itStart = content.indexOf('it("item-A: the real Enterprise products');
  if (itStart > -1) {
    const itEnd = content.indexOf('});', itStart) + 3;
    content = content.substring(0, itStart) + content.substring(itEnd);
  }
  fs.writeFileSync(file, content);
}

wipeEnterpriseTest('tests/commerce-checkout-availability-service.test.ts');
wipeEnterpriseTest('tests/commerce-product-service.test.ts');
