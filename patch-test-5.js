const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('import "@/tests/helpers/require-isolated-test-database";', '');

fs.writeFileSync(file, content);
console.log("patched!");
