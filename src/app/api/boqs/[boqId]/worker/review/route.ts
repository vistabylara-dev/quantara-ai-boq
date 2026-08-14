import { WorkerAssignmentType } from "@prisma/client";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { enqueueWorkerReview, getLatestWorkerRunForBoq } from "@/lib/services/worker-runner-service";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { workerHireBriefSchema } from "@/lib/validation/worker-route-schemas";

export const dynamic = "force-dynamic";

async function POSTHandler(request: Request, context: { params: Promise<{ boqId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { boqId } = boqIdParamsSchema.parse(await context.params);
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      throw new AppError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required for durable worker reviews.", 400);
    }

    // TAYQAN-1 — the hire brief is optional and additive: an empty/absent
    // body keeps the existing plain "enqueue a review" behavior identical.
    let brief: { assignmentObjective?: string; specialInstructions?: string } = {};
    const rawBody = await request.text();
    if (rawBody.trim()) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawBody);
      } catch {
        throw new AppError("INVALID_JSON", "The request body must contain valid JSON.", 400);
      }
      brief = workerHireBriefSchema.parse(parsedJson);
    }

    return apiSuccess(await enqueueWorkerReview(actor, boqId, idempotencyKey, process.env, brief), 202);
  } catch (error) {
    return handleApiError(error);
  }
}

async function GETHandler(_request: Request, context: { params: Promise<{ boqId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { boqId } = boqIdParamsSchema.parse(await context.params);
    const latest = await getLatestWorkerRunForBoq(actor.companyId, boqId, WorkerAssignmentType.REVIEW_EXISTING_BOQ);
    return apiSuccess(latest);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
export const GET = withActorRequestContext(GETHandler);
