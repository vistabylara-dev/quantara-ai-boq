const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/name: "Test",/g, 'name: "Test",\n        title: "Test",');
content = content.replace(/name: "TAYQAN BOQ",/g, 'name: "TAYQAN BOQ",\n        title: "TAYQAN BOQ",');
content = content.replace(/fileName: "test.xlsx",/g, 'fileName: "test.xlsx",\n        originalName: "test.xlsx",');

fs.writeFileSync(file, content);
console.log("patched!");
