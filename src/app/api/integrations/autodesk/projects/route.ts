import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { browseAutodeskProjects } from "@/lib/services/autodesk-integration-service";

export const dynamic = "force-dynamic";

function requiredOpaqueId(value: string | null, name: string): string {
  const id = value?.trim();
  if (!id || id.length > 2048 || /[\u0000-\u001f\u007f]/.test(id)) {
    throw new AppError("AUTODESK_INVALID_RESOURCE_ID", `A valid Autodesk ${name} is required.`, 400);
  }
  return id;
}

/** Lists projects beneath one hub. IDs are kept opaque and encoded by the server-side client. */
export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const hubId = requiredOpaqueId(new URL(request.url).searchParams.get("hubId"), "hub");
    return apiSuccess({ projects: await browseAutodeskProjects(actor, hubId) });
  } catch (error) {
    return handleApiError(error);
  }
}
