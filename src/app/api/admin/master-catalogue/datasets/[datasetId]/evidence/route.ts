import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listJobsForDataset } from "@/lib/services/master-catalogue-import-job-service";
import { createOrReuseDatasetPackage } from "@/lib/services/master-catalogue-activation-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ datasetId: z.string().min(1).max(128) });

type RouteContext = { params: Promise<{ datasetId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { datasetId } = paramsSchema.parse(await context.params);

    const jobs = await listJobsForDataset(actor, datasetId);
    const latest = jobs[0] ?? null;
    const pkg = await createOrReuseDatasetPackage(actor, datasetId);

    return apiSuccess({
      datasetId,
      latestJob: latest,
      package: pkg,
      summary: latest
        ? {
            totalRows: latest.totalRows,
            processedRows: latest.processedRows,
            inserted: latest.insertedCount,
            updated: latest.updatedCount,
            unchanged: latest.unchangedCount,
            rejected: latest.rejectedCount,
            warnings: latest.warningCount,
            status: latest.status,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
