import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { browseGoogleDriveFolder } from "@/lib/services/google-drive-integration-service";

export const dynamic = "force-dynamic";

/** Lists files/folders in a Google Drive folder (root if ?folderId= is omitted) — powers the connect page's file picker. */
async function GETHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const folderId = new URL(request.url).searchParams.get("folderId") ?? undefined;
    const entries = await browseGoogleDriveFolder(actor, folderId);
    return apiSuccess({ entries });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
