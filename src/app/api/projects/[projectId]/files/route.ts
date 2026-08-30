import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { preflightProjectSourceRequest, validateStructuredSourceUpload } from "@/lib/files/structured-source-upload";
import { listProjectFilesForProject, uploadProjectFile } from "@/lib/services/project-file-service";
import { uploadStructuredProjectSource } from "@/lib/services/structured-source-upload-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { projectId } = projectIdParamsSchema.parse(params);
    const data = await listProjectFilesForProject(actor, projectId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { projectId } = projectIdParamsSchema.parse(params);
    const isProduction = process.env.NODE_ENV === "production";
    const uploadMetadata = preflightProjectSourceRequest(request.headers, isProduction);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("FILE_REQUIRED", "A file is required under the \"file\" form field.", 400);
    }

    const mimeType = file.type || "application/octet-stream";
    if (!isProduction) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadProjectFile(actor, projectId, {
        originalName: file.name,
        mimeType,
        buffer,
      });
      return apiSuccess(result, 201);
    }

    validateStructuredSourceUpload(file.name, mimeType, file.size);
    if (uploadMetadata && (file.name !== uploadMetadata.originalName || file.size !== uploadMetadata.declaredByteSize)) {
      throw new AppError("UPLOAD_METADATA_MISMATCH", "The uploaded file does not match its request metadata.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (uploadMetadata && buffer.byteLength !== uploadMetadata.declaredByteSize) {
      throw new AppError("UPLOAD_SIZE_MISMATCH", "The uploaded file size changed during transfer.", 400);
    }

    const result = await uploadStructuredProjectSource(actor, projectId, {
      originalName: file.name,
      mimeType,
      buffer,
    });
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
