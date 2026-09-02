import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { listIndustryEngines } from "@/lib/repositories/industry-repository";
import { ensureCompanyIndustryEngines } from "@/lib/services/industry-bootstrap-service";
import { resolveAutonomousIndustry } from "@/lib/autonomous-boq/industry-policy";

export const dynamic = "force-dynamic";

async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    await ensureCompanyIndustryEngines(actor.companyId);
    const industries = await listIndustryEngines(actor.companyId);
    return apiSuccess(industries.map((industry) => {
      const resolution = resolveAutonomousIndustry(industry.key);
      const autonomousAvailability = resolution.status === "SUPPORTED"
        ? resolution.context.policy.assemblyMode === "SPECIALIZED_JOINERY"
          ? "SPECIALIZED_AUTONOMOUS"
          : "AUTONOMOUS_VERIFIED"
        : "UNAVAILABLE";
      return { ...industry, autonomousAvailability };
    }));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
