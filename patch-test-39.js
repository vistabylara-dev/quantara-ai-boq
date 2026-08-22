const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `name: "Test", legalName: "Test LLC"`,
  `legalName: "Test LLC"`
);
fs.writeFileSync(file, content);
