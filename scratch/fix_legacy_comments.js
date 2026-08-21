const fs = require('fs');

const filepath = 'src/lib/services/enterprise-sales-checkout-service.ts';
let content = fs.readFileSync(filepath, 'utf8');

const oldComment = ` * WHY THIS EXISTS (the gap it closes)
 * -----------------------------------
 * Enterprise Core/Scale/Authority are \`purchaseMode: "DIRECT"\` and are
 * therefore, correctly, rejected by self-serve checkout
 * (commerce-checkout-service.ts's loadEligibleCommercePrice ->
 * PRODUCT_NOT_DIRECT_PURCHASE).`;

const newComment = ` * WHY THIS EXISTS (the gap it closes)
 * -----------------------------------
 * LEGACY/DEPRECATED: Enterprise Core/Scale/Authority are now \`purchaseMode: "DIRECT"\`
 * and MUST use normal self-serve checkout. This legacy operator sales service now
 * intentionally fails closed for those three DIRECT products via PRODUCT_NOT_SALES_LED.`;

content = content.replace(oldComment, newComment);

const oldComment2 = ` *  4. Self-serve \`/api/commerce/checkout\` is untouched and still rejects all
 *     three Enterprise products via PRODUCT_NOT_DIRECT_PURCHASE.`;
const newComment2 = ` *  4. Self-serve \`/api/commerce/checkout\` now processes these since they are DIRECT.`;
content = content.replace(oldComment2, newComment2);

fs.writeFileSync(filepath, content);
