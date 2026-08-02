import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { listProjectFilesForProject, uploadProjectFile } from "@/lib/services/project-file-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: { projectId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(context.params);
    const data = await listProjectFilesForProject(actor, projectId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(context.params);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("FILE_REQUIRED", "A file is required under the \"file\" form field.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadProjectFile(actor, projectId, {
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
