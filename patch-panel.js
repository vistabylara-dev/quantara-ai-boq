const fs = require('fs');
let file = 'src/components/tayqan/tayqan-work-order-panel.tsx';
let content = fs.readFileSync(file, 'utf8');

const search = `{state.boqId && state.aiDraft !== null && (state.aiDraft.addedCount > 0 || state.aiDraft.alreadyPresentCount > 0) && (`

const replace = `{state.boqId && state.aiDraft && (state.aiDraft.addedCount > 0 || state.aiDraft.alreadyPresentCount > 0) && (`

content = content.replace(search, replace);
fs.writeFileSync(file, content);
console.log("patched panel");
