const fs = require('fs');
let c = fs.readFileSync('src/lib/services/enterprise-self-checkout-readiness-service.ts', 'utf8');
c = c.replace(/priceMapping = await tx\.commerceProviderMapping\.create\(\{ data: \{  provider: "STRIPE", environment, commercePriceId: price\.id, providerPriceId: stripePrice\.id, providerObjectType: "PRICE"  \} \}\);/, 'priceMapping = await tx.commerceProviderMapping.create({ data: {  provider: "STRIPE", environment, commerceProductId: product.id, commercePriceId: price.id, providerProductId: productMapping.providerProductId, providerPriceId: stripePrice.id, providerObjectType: "PRICE"  } });');
fs.writeFileSync('src/lib/services/enterprise-self-checkout-readiness-service.ts', c);
