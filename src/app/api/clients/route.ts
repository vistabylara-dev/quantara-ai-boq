import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { createClient, listClients } from "@/lib/repositories/client-repository";
import { clientSchema } from "@/lib/validation/backend-schemas";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    return apiSuccess(await listClients(actor.companyId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "clients:manage");
    const input = await parseJsonBody(request, clientSchema);
    const client = await createClient(actor.companyId, input);
    return apiSuccess(client, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
