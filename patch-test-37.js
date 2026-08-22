const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `tradeName: String`, // Just adding tradeName to company
  ``
);
content = content.replace(
  `companySize: "1", roleInConstruction: "Consultant" } });`,
  `companySize: "1", roleInConstruction: "Consultant", tradeName: "Test LLC" } });`
);
fs.writeFileSync(file, content);
