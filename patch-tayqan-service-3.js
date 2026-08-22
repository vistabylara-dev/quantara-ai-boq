const fs = require('fs');
let file = 'src/lib/services/tayqan-work-order-service.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\r\n/g, '\n');

// Patch 1: advanceSourceProcessing
const search1 = `          if (leasedProgress.tayqanMeasurement?.version === TAYQAN_MEASUREMENT_VERSION) {
            await releaseTayqanMeasurementLease(actor, order.id, leaseToken);
            return prepareTayqanAiDraft(actor, projectSlug, leasedOrder);
          }`;
const replace1 = `          if (leasedProgress.tayqanMeasurement?.version === TAYQAN_MEASUREMENT_VERSION) {
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

if (content.includes(search1)) {
  content = content.replace(search1, replace1);
  console.log("Applied patch 1");
} else {
  console.log("Failed patch 1");
}

// Patch 2: prepareTayqanAiDraft safety gate
const search2 = `  ) {
    // PR1 mission 2: real exception gate before Draft handoff`;

const gateEndStr = `      });
    }`;

const gateStart = content.indexOf(search2);
if (gateStart !== -1) {
   const gateEnd = content.indexOf(gateEndStr, gateStart);
   if (gateEnd !== -1) {
      const blockToRemove = content.slice(gateStart + 6, gateEnd + gateEndStr.length);
      content = content.replace(blockToRemove, "");
      console.log("Applied patch 2");
   } else {
      console.log("Failed patch 2 - end not found");
   }
} else {
   console.log("Failed patch 2 - start not found");
}

content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(file, content);
