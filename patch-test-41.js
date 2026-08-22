const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `await prisma.company.create({ data: { id: actor.companyId, legalName: "Test LLC" } });`,
  `await prisma.company.create({ data: { id: actor.companyId, legalName: "Test LLC", tradeName: "Test", email: "test@test.com" } });`
);
fs.writeFileSync(file, content);
