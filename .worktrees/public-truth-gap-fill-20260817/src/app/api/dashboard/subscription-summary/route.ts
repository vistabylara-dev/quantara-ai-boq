import { getCurrentActor } from "@/lib/auth/current-actor";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getSubscriptionSummary } from "@/lib/services/company-dashboard-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    return apiSuccess(await getSubscriptionSummary(actor));
  } catch (error) {
    return handleApiError(error);
  }
}
