const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `name: "Test Proj", slug: \`test-\${RUN_ID}\`, createdByUserId: actor.userId`,
  `name: "Test Proj", slug: \`test-\${RUN_ID}\`, createdByUserId: actor.userId, reference: "PROJ-1"`
);
fs.writeFileSync(file, content);
