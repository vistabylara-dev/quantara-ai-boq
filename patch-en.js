const fs = require('fs');
let file = 'src/lib/i18n/dictionaries/en.ts';
let content = fs.readFileSync(file, 'utf8');

const search = `          aiDraftSkippedItemsHint: "Still pending: {items}. Open each item above and enter its real quantity, then save.",`;
const replace = `          scopeCoverageIncomplete: "TAYQAN could not safely represent every extracted scope item in the review BOQ. The generated draft has been preserved for technical review.",\n          aiDraftSkippedItemsHint: "Still pending: {items}. Open each item above and enter its real quantity, then save.",`;

content = content.replace(search, replace);
fs.writeFileSync(file, content);
console.log("patched en!");
