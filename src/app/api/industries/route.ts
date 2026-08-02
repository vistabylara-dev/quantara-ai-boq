import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listIndustryEngines } from "@/lib/repositories/industry-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await listIndustryEngines(actor.companyId));
  } catch (error) {
    return handleApiError(error);
  }
}
