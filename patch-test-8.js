const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/name: "Test",/g, '');
content = content.replace(/name: "TAYQAN BOQ",/g, '');
content = content.replace(/originalName: "test.xlsx",/g, 'originalName: "test.xlsx",\n        safeFileName: "test.xlsx",');

fs.writeFileSync(file, content);
console.log("patched!");
