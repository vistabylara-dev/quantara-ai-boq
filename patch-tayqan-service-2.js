const fs = require('fs');
let file = 'src/lib/services/tayqan-work-order-service.ts';
let content = fs.readFileSync(file, 'utf8');

// Normalize newlines
content = content.replace(/\r\n/g, '\n');

const search1 = `        try {
          const leasedOrder = await loadOrder(actor.companyId, order.id);
          const leasedProgress = parseProgress(leasedOrder.progressJson);
          if (leasedProgress.tayqanMeasurement?.version === TAYQAN_MEASUREMENT_VERSION) {
            await releaseTayqanMeasurementLease(actor, order.id, leaseToken);
            return prepareTayqanAiDraft(actor, projectSlug, leasedOrder);
          }`;

const replace1 = `        try {
          const leasedOrder = await loadOrder(actor.companyId, order.id);
          const leasedProgress = parseProgress(leasedOrder.progressJson);
          if (leasedProgress.tayqanMeasurement?.version === TAYQAN_MEASUREMENT_VERSION) {
            await releaseTayqanMeasurementLease(actor, order.id, leaseToken);
            return prepareTayqanAiDraft(actor, projectSlug, leasedOrder);
          }

          const frozenSourceFileIds = sourceFileIdsFromProgress(leasedOrder);
          
          const drawingPagesCount = await prisma.drawingPage.count({
            where: { companyId: actor.companyId, projectFileId: { in: frozenSourceFileIds } },
          });
          
          const extractedEntitiesCount = await prisma.extractedEntity.count({
            where: {
              companyId: actor.companyId,
              projectFileId: { in: frozenSourceFileIds },
              status: { in: ["EXTRACTED", "NEEDS_REVIEW", "CONFIRMED", "CORRECTED"] },
            },
          });
          
          if (drawingPagesCount === 0 && extractedEntitiesCount > 0) {
             await releaseTayqanMeasurementLease(actor, order.id, leaseToken);
             return prepareTayqanAiDraft(actor, projectSlug, leasedOrder);
          }`;

content = content.replace(search1, replace1);

// Now for prepareTayqanAiDraft:
const search2 = `async function prepareTayqanAiDraft(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {
  // PR1 mission 2: real exception gate before Draft handoff — no call path
  // may reach generateAiDraftBoq() while a dangerous-kind TAYQAN measurement
  // exception remains unresolved.
  const gate = unresolvedDangerousMeasurementExceptions(parseProgress(order.progressJson));
  if (gate.blocking) {
    return block(actor, order, "MEASUREMENT_EXCEPTIONS_UNRESOLVED", "tayqan.hire.workflow.measurementExceptionsUnresolved", {
      kind: "MEASUREMENT_EXCEPTIONS",
      i18nKey: "tayqan.hire.workflow.measurementExceptionsUnresolved",
    });
  }`;

const replace2 = `async function prepareTayqanAiDraft(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {`;

content = content.replace(search2, replace2);

// We also need to add the gate check *after* the draft is generated and *after* we check scope coverage.
const search3 = `  const loaded =
    await loadOrder(
      actor.companyId,
      order.id,
    );

  if (
    aiDraft.addedCount === 0`;

const replace3 = `  const loaded =
    await loadOrder(
      actor.companyId,
      order.id,
    );

  // NO SILENT SCOPE OMISSION invariant
  const activeEntities = await prisma.extractedEntity.findMany({
    where: {
      companyId: actor.companyId,
      projectFileId: { in: selectedSourceFileIds },
      status: { in: ["EXTRACTED", "NEEDS_REVIEW", "CONFIRMED", "CORRECTED"] },
    }
  });

  const usableEntities = activeEntities.filter(e => e.label && e.label.trim().length > 0);
  
  const boq = await prisma.bOQ.findFirst({
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
  }

  // DANGEROUS EXCEPTIONS GATE MOVED HERE
  const gate = unresolvedDangerousMeasurementExceptions(parseProgress(loaded.progressJson));
  if (gate.blocking) {
    return block(actor, loaded, "MEASUREMENT_EXCEPTIONS_UNRESOLVED", "tayqan.hire.workflow.measurementExceptionsUnresolved", {
      kind: "MEASUREMENT_EXCEPTIONS",
      i18nKey: "tayqan.hire.workflow.measurementExceptionsUnresolved",
    });
  }

  if (
    aiDraft.addedCount === 0`;

content = content.replace(search3, replace3);

content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(file, content);
console.log('Patched tayqan service 2');
