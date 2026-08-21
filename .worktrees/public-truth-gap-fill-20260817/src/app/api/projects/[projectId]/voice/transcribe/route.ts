import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { transcribeProjectVoice } from "@/lib/voice/voice-transcription-service";
import { assertVoiceMultipartContentLength } from "@/lib/voice/transcription-provider";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

async function singleAudioFile(request: Request): Promise<File> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new AppError("INVALID_MULTIPART", "The request must contain valid multipart form-data.", 400);
  }

  const entries = Array.from(formData.entries());
  if (entries.length !== 1 || entries[0][0] !== "file" || !(entries[0][1] instanceof File)) {
    throw new AppError(
      "VOICE_AUDIO_REQUIRED",
      "Exactly one voice recording is required under the \"file\" form field.",
      400,
    );
  }
  return entries[0][1];
}

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    // Resolve tenancy before reading any uploaded audio bytes.
    await getProjectRecord(actor.companyId, projectId);
    assertVoiceMultipartContentLength(request.headers.get("content-length"));
    const file = await singleAudioFile(request);
    const data = await transcribeProjectVoice(actor, projectId, file);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
