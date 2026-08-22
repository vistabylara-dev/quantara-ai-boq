const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `tradeName: "Test LLC" } });`,
  `tradeName: "Test LLC", email: "test@test.com" } });`
);
fs.writeFileSync(file, content);
