const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');

// Fix beforeEach creating existing company
content = content.replace(`    await prisma.company.create({ data: { id: actor.companyId, legalName: "Test LLC", tradeName: "Test", email: actor.email } });\n    await prisma.user.create({ data: { id: actor.userId, companyId: actor.companyId, email: actor.email, fullName: actor.fullName, passwordHash: "test" } });`, ``);

// Fix project creation missing client
content = content.replace(`        company: { connect: { id: actor.companyId } },\n        createdByUser: { connect: { id: actor.userId } },\n      }\n    });`, `        company: { connect: { id: actor.companyId } },\n        createdByUser: { connect: { id: actor.userId } },\n        client: { create: { id: randomUUID(), companyId: actor.companyId, name: "Test Client" } }\n      }\n    });`);

fs.writeFileSync(file, content);
console.log("patched test 4");
