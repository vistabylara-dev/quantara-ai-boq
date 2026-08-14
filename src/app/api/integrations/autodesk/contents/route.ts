import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { browseAutodeskContents } from "@/lib/services/autodesk-integration-service";

export const dynamic = "force-dynamic";

function requiredOpaqueId(value: string | null, name: string): string {
  const id = value?.trim();
  if (!id || id.length > 2048 || /[\u0000-\u001f\u007f]/.test(id)) {
    throw new AppError("AUTODESK_INVALID_RESOURCE_ID", `A valid Autodesk ${name} is required.`, 400);
  }
  return id;
}

function optionalOpaqueId(value: string | null): string | undefined {
  if (value === null || value === "") return undefined;
  return requiredOpaqueId(value, "folder");
}

/** Lists top folders when folderId is omitted, otherwise lists that folder's files and subfolders. */
async function GETHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = new URL(request.url).searchParams;
    const hubId = requiredOpaqueId(params.get("hubId"), "hub");
    const projectId = requiredOpaqueId(params.get("projectId"), "project");
    const folderId = optionalOpaqueId(params.get("folderId"));
    return apiSuccess({ entries: await browseAutodeskContents(actor, { hubId, projectId, folderId }) });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
