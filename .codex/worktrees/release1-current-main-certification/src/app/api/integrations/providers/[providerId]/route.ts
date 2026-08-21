import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getProviderDetailForCompany } from "@/lib/services/integration-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ providerId: z.string().min(1).max(100) });

type RouteContext = { params: Promise<{ providerId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { providerId } = paramsSchema.parse(await context.params);
    const data = await getProviderDetailForCompany(actor, providerId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
