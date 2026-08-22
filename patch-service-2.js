const fs = require('fs');
let file = 'src/lib/services/tayqan-work-order-service.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const boq = await prisma\.bOQ\.findFirst\(\{\s+where: \{ id: boqId \},\s+include: \{ sections: \{ include: \{ items: true \} \} \}\s+\}\);/, 'const boq = await getBOQRecord(actor.companyId, boqId);');

content = content.replace(/\.map\(i => getAiDraftExtractedEntityId\(i\.sourceReference\)\)/, '.map(i => i.quantityProvenance?.extractedEntityId ?? getAiDraftExtractedEntityId(i.sourceReference))');

content = content.replace(/return block\(actor, loaded, "SCOPE_COVERAGE_INCOMPLETE", "tayqan\.hire\.workflow\.scopeCoverageIncomplete", \{\s+kind: "ERROR",\s+i18nKey: "tayqan\.hire\.workflow\.scopeCoverageIncomplete",\s+error: \{\s+code: "SCOPE_COVERAGE_INCOMPLETE",\s+reason: `eligible entity count: \$\{usableEntities\.length\}, represented entity count: \$\{representedEntityIds\.size\}, missing count: \$\{missingEntities\.length\}, missing entity IDs: \$\{missingEntities\.map\(e => e\.id\)\.join\(\', \'\)\}`\s+\}\s+\}\);/, 'return fail(actor, loaded, "SCOPE_COVERAGE_INCOMPLETE", "tayqan.hire.workflow.scopeCoverageIncomplete", {\n      kind: "ACTION",\n      i18nKey: "tayqan.hire.workflow.scopeCoverageIncomplete",\n    }, new AppError("SCOPE_COVERAGE_INCOMPLETE", `eligible entity count: ${usableEntities.length}, represented entity count: ${representedEntityIds.size}, missing count: ${missingEntities.length}, missing entity IDs: ${missingEntities.map(e => e.id).join(\', \')}`, 500));');

fs.writeFileSync(file, content);
console.log("patched!");
