const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `await prisma.company.create({ data: { id: actor.companyId, legalName: "Test LLC", planType: "FREE", registrationNumber: "123", taxNumber: "123", industry: "Other", companySize: "1", roleInConstruction: "Consultant", tradeName: "Test LLC", email: "test@test.com" } });`,
  `await prisma.company.create({ data: { id: actor.companyId, legalName: "Test LLC" } });`
);
fs.writeFileSync(file, content);
