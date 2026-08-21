import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { getCompany, updateCompany } from "@/lib/repositories/company-repository";
import { companyUpdateSchema } from "@/lib/validation/backend-schemas";

export const dynamic = "force-dynamic";

function toCompanyDTO(company: Awaited<ReturnType<typeof getCompany>>) {
  return {
    ...company,
    vatRate: company.vatRate.toNumber(),
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const company = await getCompany(actor.companyId);
    return apiSuccess(toCompanyDTO(company));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "company:manage");
    const input = await parseJsonBody(request, companyUpdateSchema);
    const company = await updateCompany(actor.companyId, input);
    return apiSuccess(toCompanyDTO(company));
  } catch (error) {
    return handleApiError(error);
  }
}
