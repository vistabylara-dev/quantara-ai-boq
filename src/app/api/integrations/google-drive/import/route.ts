import { z } from "zod";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { importGoogleDriveFile } from "@/lib/services/google-drive-integration-service";

export const dynamic = "force-dynamic";

const googleDriveImportSchema = z.object({
  googleFileId: z.string().trim().min(1).max(1024),
  projectId: z.string().trim().min(1).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody(request, googleDriveImportSchema);
    const result = await importGoogleDriveFile(actor, input);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
