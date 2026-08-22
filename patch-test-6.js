const fs = require('fs');
let file = 'tests/tayqan-full-boq-deliverable.test.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace createTestProject entirely
content = content.replace(/async function createTestProject\(\) \{[\s\S]*?\}\n/, `  async function createTestProject() {\n    return prisma.project.findFirst({ where: { companyId: actor.companyId } });\n  }\n`);

fs.writeFileSync(file, content);
console.log("patched!");
