import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import {
  assertBufferedDrawingUploadAllowed,
  listProjectDrawings,
  uploadProjectDrawing,
} from "@/lib/services/drawing-service";
import { drawingMetadataSchema } from "@/lib/validation/drawing-schema";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { projectId } = projectIdParamsSchema.parse(params);
    const data = await listProjectDrawings(actor, projectId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Metadata fields ride alongside the file in the same multipart form — one round trip, matching the existing project-files upload route's pattern. */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { projectId } = projectIdParamsSchema.parse(params);

    // Reject this local-only route before reading multipart bytes. Production
    // clients must authorize, upload directly to private Blob, then finalize.
    assertBufferedDrawingUploadAllowed();

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("FILE_REQUIRED", "A file is required under the \"file\" form field.", 400);
    }

    const metadata = drawingMetadataSchema.parse({
      discipline: formData.get("discipline") || undefined,
      drawingType: formData.get("drawingType") || undefined,
      drawingNumber: formData.get("drawingNumber") || undefined,
      title: formData.get("title") || undefined,
      revision: formData.get("revision") || undefined,
      issueDate: formData.get("issueDate") || undefined,
      scale: formData.get("scale") || undefined,
      sheetNumber: formData.get("sheetNumber") || undefined,
      preparedBy: formData.get("preparedBy") || undefined,
      checkedBy: formData.get("checkedBy") || undefined,
      approvedBy: formData.get("approvedBy") || undefined,
      notes: formData.get("notes") || undefined,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadProjectDrawing(actor, projectId, {
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
      metadata,
    });
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
