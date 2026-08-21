const fs = require('fs');
let p = fs.readFileSync('prisma/seed-data/commerce-products.ts', 'utf8');
p = p.replace(/code: "enterprise_core",([^]*?)purchaseMode: "CONTACT_SALES"/, 'code: "enterprise_core",$1purchaseMode: "DIRECT"');
p = p.replace(/code: "enterprise_scale",([^]*?)purchaseMode: "CONTACT_SALES"/, 'code: "enterprise_scale",$1purchaseMode: "DIRECT"');
p = p.replace(/code: "enterprise_authority",([^]*?)purchaseMode: "CONTACT_SALES"/, 'code: "enterprise_authority",$1purchaseMode: "DIRECT"');
fs.writeFileSync('prisma/seed-data/commerce-products.ts', p);
