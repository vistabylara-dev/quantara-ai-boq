import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getWorkerRunForCompany } from "@/lib/services/worker-runner-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ runId: z.string().uuid() });

async function GETHandler(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { runId } = paramsSchema.parse(await context.params);
    return apiSuccess(await getWorkerRunForCompany(actor.companyId, runId));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
