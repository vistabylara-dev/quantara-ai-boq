import "dotenv/config";
import { listDatasetDefinitions } from "../src/lib/services/catalogue-dataset-registry";
import { registerAndDryRun, confirmExecution, runJobBatches, listJobsForDataset, cancelJob, CONTINUABLE_STATUSES } from "../src/lib/services/master-catalogue-import-job-service";
import { publishDatasetValidItems, assignDatasetItemsToPackage, activateDatasetPackage, grantPackageAccess } from "../src/lib/services/master-catalogue-activation-service";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";

let owner: PlatformActor = { userId: "", companyId: "", platformRole: "PLATFORM_OWNER", fullName: "Admin", email: "admin@quantara.ai" };

async function activateAll() {
  console.log("Starting full catalogue activation pipeline...");
  const datasets = listDatasetDefinitions();
  const company = await prisma.company.findFirst();
  const user = await prisma.user.findFirst();
  if (company) owner.companyId = company.id;
  if (user) owner.userId = user.id;

  for (const dataset of datasets) {
    console.log(`\n========================================`);
    console.log(`Processing: ${dataset.datasetId}`);
    console.log(`========================================`);

    try {
      const jobs = await listJobsForDataset(owner, dataset.datasetId);
      const latestJob = jobs[0];
      
      let jobId = latestJob?.id;
      let needsRun = true;

      if (latestJob && latestJob.status === "COMPLETED") {
        console.log(`Dataset already completed import (Job ID: ${latestJob.id}). Skipping to publish...`);
        needsRun = false;
      } else if (latestJob && latestJob.status === "COMPLETED_WITH_WARNINGS") {
        console.log(`Dataset already completed import with warnings (Job ID: ${latestJob.id}). Skipping to publish...`);
        needsRun = false;
      } else if (latestJob && latestJob.status === "DRY_RUN_COMPLETE") {
        console.log(`Resuming from confirmed dry run (Job ID: ${latestJob.id})...`);
        await confirmExecution(owner, latestJob.id);
      } else if (latestJob && CONTINUABLE_STATUSES.includes(latestJob.status as any)) {
        console.log(`Resuming existing continuable job (Job ID: ${latestJob.id})...`);
      } else {
        if (latestJob && !["FAILED", "CANCELLED", "ROLLED_BACK"].includes(latestJob.status)) {
             console.log(`Canceling stuck or conflicting job: ${latestJob.id}`);
             try { await cancelJob(owner, latestJob.id); } catch(e) {}
        }
        console.log("Starting new dry run...");
        const job = await registerAndDryRun(owner, dataset.datasetId);
        jobId = job.id;
        console.log(`Dry run complete. Confirming execution... (Job ID: ${job.id})`);
        await confirmExecution(owner, job.id);
      }

      if (needsRun && jobId) {
        console.log("Running batches...");
        let isComplete = false;
        while (!isComplete) {
          const res = await runJobBatches(owner, jobId, 10);
          isComplete = res.isComplete;
          console.log(`  - Batches run, current cursor: ${res.job.processedRows}/${res.job.totalRows} (Status: ${res.job.status})`);
        }
        console.log("Import execution finished.");
      }

      console.log("Publishing valid items...");
      const pubRes = await publishDatasetValidItems(owner, dataset.datasetId);
      console.log(`  - Created ${pubRes.createdVersions}, published ${pubRes.publishedVersions}`);

      console.log("Assigning items to package...");
      const assignRes = await assignDatasetItemsToPackage(owner, dataset.datasetId);
      console.log(`  - Assigned ${assignRes.assignedCount} new items`);

      console.log("Activating package in marketplace...");
      const pkg = await activateDatasetPackage(owner, dataset.datasetId);
      console.log(`  - Package ${pkg.packageKey} is now ${pkg.status}`);

      if (company) {
        console.log(`Setting owner context for company ${company.legalName}...`);
        await grantPackageAccess(owner, pkg.packageId, company.id);
      }

      console.log(`✅ Successfully activated ${dataset.datasetId}`);

    } catch(err) {
      console.error(`❌ Failed to activate ${dataset.datasetId}:`, err);
    }
  }
}

activateAll().catch(console.error).finally(() => process.exit(0));
