const fs = require('fs');
let file = 'src/lib/services/tayqan-work-order-service.ts';
let content = fs.readFileSync(file, 'utf8');

// Patch 1: advanceSourceProcessing
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

// Patch 2: prepareTayqanAiDraft safety gate
const search2 = `async function prepareTayqanAiDraft(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {
  // PR1 mission 2: real exception gate before Draft handoff ?" no call path
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
) {
`;

// Wait, I will just rewrite prepareTayqanAiDraft completely.

content = content.replace(search2, replace2);
fs.writeFileSync(file, content);
console.log('patched advanceSourceProcessing');
