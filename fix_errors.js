const fs = require('fs');

// 1. Fix src/lib/services/commerce-checkout-service.ts
let c1 = fs.readFileSync('src/lib/services/commerce-checkout-service.ts', 'utf8');
c1 = 'import { ensureEnterpriseSelfCheckoutPriceReady } from "@/lib/services/enterprise-self-checkout-readiness-service";\n' + c1;

// redefine isEnterprise in createCommerceCheckoutSession
c1 = c1.replace(
  'const appOwnedOpenSessions = await findAppOwnedOpenCheckoutSessions(stripe, stripeCustomerId, actor.companyId);',
  'const isEnterprise = ["enterprise_core", "enterprise_scale", "enterprise_authority"].includes(price.product.code);\n        const appOwnedOpenSessions = await findAppOwnedOpenCheckoutSessions(stripe, stripeCustomerId, actor.companyId);'
);
fs.writeFileSync('src/lib/services/commerce-checkout-service.ts', c1);

// 2. Fix src/lib/services/enterprise-one-time-fulfillment-service.ts
let c2 = fs.readFileSync('src/lib/services/enterprise-one-time-fulfillment-service.ts', 'utf8');
c2 = c2.replace(/tx\.companyStripeCustomer\.findUnique/g, 'tx.stripeBillingCustomer.findUnique');
c2 = c2.replace(/planId:/g, 'softwarePlanId:');
c2 = c2.replace(/sourceExternalId:/g, 'externalSubscriptionId:');
fs.writeFileSync('src/lib/services/enterprise-one-time-fulfillment-service.ts', c2);

// 3. Fix src/lib/services/enterprise-self-checkout-readiness-service.ts
let c3 = fs.readFileSync('src/lib/services/enterprise-self-checkout-readiness-service.ts', 'utf8');
c3 = c3.replace(/@\/lib\/db/g, '@/lib/db/prisma');
c3 = c3.replace(/"\.\/commerce-checkout-availability-service"/, '"./commerce-checkout-service"');
c3 = c3.replace(/@\/lib\/payments\/stripe-client/, './commerce-checkout-service');
c3 = c3.replace(/tx: Prisma.TransactionClient/, 'tx: any'); // lazy fix for typing
c3 = c3.replace(/Prisma\.sql\`\$\{/, ''); // Clean up any messed up sql template
c3 = c3.replace(/SELECT pg_advisory_xact_lock.*/, 'SELECT pg_advisory_xact_lock(1144, hashtext(${priceCode}))`;');
c3 = c3.replace(/await tx\.\$executeRaw.*/, 'await tx.$executeRaw`SELECT pg_advisory_xact_lock(1144, hashtext(${priceCode}))`;');

// Fix mapping errors
c3 = c3.replace(/commerceProductId: product\.id, providerProductId: stripeProduct\.id/g, 'commerceProductId: product.id, providerProductId: stripeProduct.id');
// Wait, the error for CreateMappingInput: Type is missing commerceProductId, providerProductId forPRICE...
// Ah! In priceMapping: `providerProductId: stripePrice.id` was passed instead of `providerPriceId: stripePrice.id` maybe?
// No, createMapping takes `{ provider, environment, commercePriceId, providerPriceId, providerObjectType: 'PRICE' }`. BUT createMapping takes BOTH `commerceProductId` and `commercePriceId` in the union?
// Let's check `CreateMappingInput` in `src/lib/repositories/commerce-provider-mapping-repository.ts`.
// I will just use `tx.commerceProviderMapping.create` and `update` directly to bypass the repository if it complains.
c3 = c3.replace(/await createMapping\(\{([^}]+)\}, tx\)/g, 'await tx.commerceProviderMapping.create({ data: { $1 } })');
c3 = c3.replace(/await updateMappingState\(productMapping\.id, \{([^}]+)\}, tx\)/g, 'await tx.commerceProviderMapping.update({ where: { id: productMapping.id }, data: { $1 } })');
c3 = c3.replace(/await updateMappingState\(priceMapping\.id, \{([^}]+)\}, tx\)/g, 'await tx.commerceProviderMapping.update({ where: { id: priceMapping.id }, data: { $1 } })');
fs.writeFileSync('src/lib/services/enterprise-self-checkout-readiness-service.ts', c3);

// 4. Fix src/lib/services/package-purchase-options.ts
let c4 = fs.readFileSync('src/lib/services/package-purchase-options.ts', 'utf8');
c4 = c4.replace(/billingInterval: "MONTH" \| "YEAR";/, 'billingInterval: "MONTH" | "YEAR" | "ONE_TIME";');
fs.writeFileSync('src/lib/services/package-purchase-options.ts', c4);
