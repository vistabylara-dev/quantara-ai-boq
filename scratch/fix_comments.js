const fs = require('fs');

function replaceInFile(filepath, replacements) {
    let content = fs.readFileSync(filepath, 'utf8');
    for (const [oldText, newText] of replacements) {
        content = content.replace(oldText, newText);
    }
    fs.writeFileSync(filepath, content);
}

// 1. prisma/seed-data/commerce-products.ts
replaceInFile('prisma/seed-data/commerce-products.ts', [
    [/`purchaseMode: "CONTACT_SALES"`, NOT "DIRECT" — Enterprise is sales-led/g, '`purchaseMode: "DIRECT"` — Enterprise is direct-checkout']
]);

// 2. src/app/settings/subscription/page.tsx
replaceInFile('src/app/settings/subscription/page.tsx', [
    [/purchaseMode: "CONTACT_SALES", so they never appear in/g, 'purchaseMode: "DIRECT", so they appear in'],
    [/\/\/ Enterprise is purchaseMode: "CONTACT_SALES" and is deliberately absent/g, '// Enterprise is purchaseMode: "DIRECT"']
]);

// 3. src/lib/repositories/commerce-product-repository.ts
replaceInFile('src/lib/repositories/commerce-product-repository.ts', [
    [/APPROVED\. Enterprise is CONTACT_SALES precisely because the annual amount/g, 'APPROVED. Enterprise is DIRECT now']
]);

// 4. src/lib/services/commerce-checkout-availability-service.ts
replaceInFile('src/lib/services/commerce-checkout-availability-service.ts', [
    [/`purchaseMode: "CONTACT_SALES"` \(see prisma\/seed-data\/commerce-products\.ts\),/g, '`purchaseMode: "DIRECT"` (see prisma/seed-data/commerce-products.ts),']
]);

// 5. src/lib/services/enterprise-sales-checkout-service.ts
replaceInFile('src/lib/services/enterprise-sales-checkout-service.ts', [
    [/Enterprise Core\/Scale\/Authority are `purchaseMode: "CONTACT_SALES"` and are/g, 'Enterprise Core/Scale/Authority are `purchaseMode: "DIRECT"` and are']
]);

// 6. src/lib/services/stripe-live-sync-service.ts
replaceInFile('src/lib/services/stripe-live-sync-service.ts', [
    [/authority\) below\. Those three are genuinely CONTACT_SALES products/g, 'authority) below. Those three are genuinely DIRECT products']
]);

