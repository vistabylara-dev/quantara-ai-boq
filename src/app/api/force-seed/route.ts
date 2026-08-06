import { NextResponse } from "next/server";
import { listDatasetDefinitions } from "@/lib/services/catalogue-dataset-registry";
import { registerAndDryRun, confirmExecution, runJobBatches, listJobsForDataset, cancelJob, CONTINUABLE_STATUSES } from "@/lib/services/master-catalogue-import-job-service";
import { publishDatasetValidItems, assignDatasetItemsToPackage, activateDatasetPackage, grantPackageAccess } from "@/lib/services/master-catalogue-activation-service";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    let owner: PlatformActor = { userId: "SYSTEM", companyId: "SYSTEM", platformRole: "PLATFORM_OWNER", userRole: "ADMIN" };
    const company = await prisma.company.findFirst();
    const user = await prisma.user.findFirst();
    if (company) owner.companyId = company.id;
    if (user) owner.userId = user.id;

    const datasets = listDatasetDefinitions();
    const results = [];

    for (const dataset of datasets) {
      try {
        const jobs = await listJobsForDataset(owner, dataset.datasetId);
        const latestJob = jobs[0];
        let jobId = latestJob?.id;
        let needsRun = true;

        if (latestJob && (latestJob.status === "COMPLETED" || latestJob.status === "COMPLETED_WITH_WARNINGS")) {
          needsRun = false;
        } else if (latestJob && latestJob.status === "DRY_RUN_COMPLETE") {
          await confirmExecution(owner, latestJob.id);
        } else if (latestJob && CONTINUABLE_STATUSES.includes(latestJob.status as any)) {
          // continue
        } else {
          if (latestJob && !["FAILED", "CANCELLED", "ROLLED_BACK"].includes(latestJob.status)) {
             try { await cancelJob(owner, latestJob.id); } catch(e) {}
          }
          const job = await registerAndDryRun(owner, dataset.datasetId);
          jobId = job.id;
          await confirmExecution(owner, job.id);
        }

        if (needsRun && jobId) {
          let isComplete = false;
          let safeLoop = 0;
          while (!isComplete && safeLoop < 50) {
            const res = await runJobBatches(owner, jobId, 50); // Larger batch
            isComplete = res.isComplete;
            safeLoop++;
          }
        }

        const pubRes = await publishDatasetValidItems(owner, dataset.datasetId);
        const assignRes = await assignDatasetItemsToPackage(owner, dataset.datasetId);
        const pkg = await activateDatasetPackage(owner, dataset.datasetId);
        if (company) {
          await grantPackageAccess(owner, pkg.packageId, company.id);
        }
        results.push({ datasetId: dataset.datasetId, status: "SUCCESS" });
      } catch (err: any) {
        results.push({ datasetId: dataset.datasetId, status: "FAILED", error: err.message });
      }
    }
    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
