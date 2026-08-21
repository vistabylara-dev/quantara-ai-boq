import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getBrandingForCompany, updateBrandingForCompany } from "@/lib/services/company-branding-service";
import { brandingUpdateSchema } from "@/lib/validation/phase7-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const data = await getBrandingForCompany(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody(request, brandingUpdateSchema);
    const data = await updateBrandingForCompany(actor, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
