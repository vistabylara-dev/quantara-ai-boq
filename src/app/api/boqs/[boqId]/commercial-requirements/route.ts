import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { getBOQRecord } from "@/lib/repositories/boq-repository";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { resolveBoqCommercialRequirementsEffective } from "@/lib/commercial/commercial-requirement-service";
import { isTestCommercialSimulatorRequest, buildSimulatedAllowDecision, buildSimulatedUnlockDecision } from "@/lib/commercial/test-commercial-adapter";

export const dynamic = "force-dynamic";

/**
 * CANVA-MODEL-1 — read-only. Tells the working BOQ journey exactly what
 * this project needs to unlock a clean final export, derived entirely from
 * server-side BOQ/entitlement state — the client never constructs this.
 */
async function GETHandler(request: Request, context: { params: Promise<{ boqId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const { boqId } = boqIdParamsSchema.parse(await context.params);
    await getBOQRecord(actor.companyId, boqId); // 404s / tenant-scopes before proceeding

    const simulatedOutcome = isTestCommercialSimulatorRequest(request.headers);
    if (simulatedOutcome === "COMMERCIAL_UNLOCK_REQUIRED") return apiSuccess(buildSimulatedUnlockDecision());
    if (simulatedOutcome === "ALLOW") return apiSuccess(buildSimulatedAllowDecision());

    const decision = await resolveBoqCommercialRequirementsEffective(actor, boqId);
    return apiSuccess(decision);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
