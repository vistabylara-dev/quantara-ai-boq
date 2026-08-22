const fs = require('fs');
let file = 'src/lib/services/tayqan-work-order-service.ts';
let content = fs.readFileSync(file, 'utf8');

const s1 = content.indexOf('if (leasedProgress.tayqanMeasurement?.version');
console.log(content.slice(s1, s1 + 300));

const s2 = content.indexOf('async function prepareTayqanAiDraft(');
console.log(content.slice(s2, s2 + 600));

