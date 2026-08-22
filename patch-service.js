const fs = require('fs');
let file = 'src/lib/services/tayqan-work-order-service.ts';
let content = fs.readFileSync(file, 'utf8');

const search = `    const boq = await prisma.bOQ.findFirst({
      where: { id: boqId },
      include: { sections: { include: { items: true } } }
    });
    
    const representedEntityIds = new Set(
      boq!.sections.flatMap(s => s.items)
        .map(i => getAiDraftExtractedEntityId(i.sourceReference))
        .filter(id => id !== null)
    );
  
    const missingEntities = usableEntities.filter(e => !representedEntityIds.has(e.id));
    
    if (missingEntities.length > 0) {
      return block(actor, loaded, "SCOPE_COVERAGE_INCOMPLETE", "tayqan.hire.workflow.scopeCoverageIncomplete", {
        kind: "ERROR",
        i18nKey: "tayqan.hire.workflow.scopeCoverageIncomplete",
        error: {
          code: "SCOPE_COVERAGE_INCOMPLETE",
          reason: \`eligible entity count: \${usableEntities.length}, represented entity count: \${representedEntityIds.size}, missing count: \${missingEntities.length}, missing entity IDs: \${missingEntities.map(e => e.id).join(', ')}\`
        }
      });
    }`;

const replace = `    const boq = await getBOQRecord(actor.companyId, boqId);
    
    const representedEntityIds = new Set(
      boq!.sections.flatMap(s => s.items)
        .map(i => i.quantityProvenance?.extractedEntityId ?? getAiDraftExtractedEntityId(i.sourceReference))
        .filter(id => id !== null)
    );
  
    const missingEntities = usableEntities.filter(e => !representedEntityIds.has(e.id));
    
    if (missingEntities.length > 0) {
      return fail(actor, loaded, "SCOPE_COVERAGE_INCOMPLETE", "tayqan.hire.workflow.scopeCoverageIncomplete", {
        kind: "ACTION",
        i18nKey: "tayqan.hire.workflow.scopeCoverageIncomplete",
      }, new AppError("SCOPE_COVERAGE_INCOMPLETE", \`eligible entity count: \${usableEntities.length}, represented entity count: \${representedEntityIds.size}, missing count: \${missingEntities.length}, missing entity IDs: \${missingEntities.map(e => e.id).join(', ')}\`, 500));
    }`;

content = content.replace(search, replace);

// Fix the progress usage in toState
const toStateSearch = `function toState(order: Awaited<ReturnType<typeof loadOrder>>) {
  return {
    id: order.id,`;

const toStateReplace = `function toState(order: Awaited<ReturnType<typeof loadOrder>>) {
  const progress = parseProgress(order.progressJson);
  return {
    id: order.id,`;

const toStateSearch2 = `    measurementExceptions: measurementExceptionsSummary(parseProgress(order.progressJson)),
    startedAt: order.startedAt.toISOString(),`;

const toStateReplace2 = `    measurementExceptions: measurementExceptionsSummary(progress),
    aiDraft: progress.aiDraft ?? null,
    startedAt: order.startedAt.toISOString(),`;

content = content.replace(toStateSearch, toStateReplace).replace(toStateSearch2, toStateReplace2);

fs.writeFileSync(file, content);
console.log("patched tayqan service");
