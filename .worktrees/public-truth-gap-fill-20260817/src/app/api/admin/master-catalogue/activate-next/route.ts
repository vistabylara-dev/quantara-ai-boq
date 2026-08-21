import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import {
  listJobsForDataset,
  listRegisteredDatasetsSummary,
  processNextBatch,
  registerAndDryRun,
  confirmExecution,
} from "@/lib/services/master-catalogue-import-job-service";
import {
  activateDatasetPackage,
  assignDatasetItemsToPackage,
  publishDatasetValidItems,
} from "@/lib/services/master-catalogue-activation-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const datasets = await listRegisteredDatasetsSummary(actor);
    const target = datasets.find((d) => d.latestJob?.status !== "COMPLETED" && d.latestJob?.status !== "COMPLETED_WITH_WARNINGS") ?? datasets[0];

    if (!target) {
      return apiSuccess({ datasetId: null, stageExecuted: "none", reason: "no-datasets-registered" });
    }

    const datasetId = target.datasetId;
    const jobs = await listJobsForDataset(actor, datasetId);
    const latest = jobs[0];

    if (!latest) {
      const dryRun = await registerAndDryRun(actor, datasetId);
      return apiSuccess({ datasetId, stageExecuted: "dry-run", result: dryRun });
    }

    if (
      latest.status === "DRY_RUN_COMPLETE" ||
      latest.status === "AWAITING_CONFIRMATION" ||
      latest.status === "VALIDATING" ||
      latest.status === "IMPORT_RUNNING"
    ) {
      const confirmed = await confirmExecution(actor, latest.id);
      const batch = await processNextBatch(actor, confirmed.id);
      return apiSuccess({ datasetId, stageExecuted: "execute-batch", result: batch });
    }

    if (latest.status === "COMPLETED" || latest.status === "COMPLETED_WITH_WARNINGS") {
      const publish = await publishDatasetValidItems(actor, datasetId);
      const assign = await assignDatasetItemsToPackage(actor, datasetId);
      const activate = await activateDatasetPackage(actor, datasetId);
      return apiSuccess({
        datasetId,
        stageExecuted: "publish-assign-activate",
        result: { publish, assign, activate },
      });
    }

    const dryRun = await registerAndDryRun(actor, datasetId);
    return apiSuccess({ datasetId, stageExecuted: "dry-run", result: dryRun });
  } catch (error) {
    return handleApiError(error);
  }
}
