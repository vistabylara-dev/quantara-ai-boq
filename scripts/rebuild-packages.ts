import { prisma } from "@/lib/db/prisma";
import { listDatasetDefinitions } from "@/lib/services/catalogue-dataset-registry";
import { getDatasetItemIds } from "@/lib/services/industry-package-activation-service";
import { IndustryPackageStatus } from "@prisma/client";

async function main() {
  console.log("Starting Phase 4 Database Recovery: Rebuilding Packages...");
  const datasets = listDatasetDefinitions();
  
  for (const dataset of datasets) {
    console.log(`\nProcessing dataset: ${dataset.datasetId} (Target Package: ${dataset.targetPackageCode})`);
    
    // 0. FIX SOURCE BATCH ID
    const disciplineKey = dataset.disciplineAliases?.[dataset.disciplineKey] ?? dataset.disciplineKey;
    const discipline = await prisma.masterDiscipline.findUnique({ where: { key: disciplineKey }});
    const job = await prisma.masterCatalogueImportJob.findFirst({ where: { datasetId: dataset.datasetId } });
    
    if (discipline && job?.legacyBatchId) {
      const updated = await prisma.masterItem.updateMany({
        where: { disciplineId: discipline.id, sourceBatchId: null },
        data: { sourceBatchId: job.legacyBatchId }
      });
      if (updated.count > 0) {
        console.log(`  [FIX] Assigned sourceBatchId ${job.legacyBatchId} to ${updated.count} MasterItems in discipline ${disciplineKey}.`);
      }
    }

    // 1. Compute canonical items
    const canonicalItemIds = await getDatasetItemIds(dataset.datasetId);
    
    // 2. Verify package exists and canonical IDs are non-empty
    const pkg = await prisma.industryDataPackage.findUnique({
      where: { key: dataset.targetPackageCode }
    });
    
    if (!pkg) {
      console.log(`  [SKIPPED] Package ${dataset.targetPackageCode} does not exist yet.`);
      continue;
    }
    
    if (canonicalItemIds.length === 0) {
      console.log(`  [SKIPPED] No canonical items found for dataset ${dataset.datasetId}.`);
      continue;
    }
    
    console.log(`  Found ${canonicalItemIds.length} canonical items. Package ID: ${pkg.id}`);
    
    // 3. Atomically delete old assignments and insert canonical ones, update itemCount and set ACTIVE
    try {
      await prisma.$transaction(async (tx) => {
        // Delete old assignments
        const deleted = await tx.industryDataPackageItem.deleteMany({
          where: { packageId: pkg.id }
        });
        console.log(`  Deleted ${deleted.count} old assignments.`);
        
        // Insert canonical ones
        const toCreate = canonicalItemIds.map((itemId, idx) => ({
          packageId: pkg.id,
          masterItemId: itemId,
          sortOrder: idx
        }));
        
        const created = await tx.industryDataPackageItem.createMany({
          data: toCreate,
          skipDuplicates: true
        });
        console.log(`  Inserted ${created.count} canonical assignments.`);
        
        // Update itemCount and set package status to ACTIVE
        await tx.industryDataPackage.update({
          where: { id: pkg.id },
          data: {
            itemCount: created.count,
            status: IndustryPackageStatus.ACTIVE
          }
        });
        console.log(`  Updated package ${pkg.key} itemCount to ${created.count} and status to ACTIVE.`);
      }, { timeout: 120000 });
      
      console.log(`  [SUCCESS] Successfully recovered package ${dataset.targetPackageCode}.`);
    } catch (err) {
      console.error(`  [ERROR] Failed to recover package ${dataset.targetPackageCode}:`, err);
    }
  }
  
  console.log("\nFinished Database Recovery.");
}

main().catch(console.error);
