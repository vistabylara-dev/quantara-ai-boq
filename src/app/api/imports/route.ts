import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { createImportJob, listImportJobsForCompany } from "@/lib/services/import-service";
import { importJobMetadataSchema } from "@/lib/validation/phase7-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const data = await listImportJobsForCompany(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// Multipart FormData, not a base64 string in a JSON body — see the comment on
// importJobMetadataSchema for why (base64 inflates the payload ~33%, which was tripping the
// platform's request body size cap on moderately large CSVs before this app's own validation ever
// got a chance to run).
export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("FILE_REQUIRED", "A file is required under the \"file\" form field.", 400);
    }

    const metadataResult = importJobMetadataSchema.safeParse({
      projectId: formData.get("projectId") || undefined,
      uploadedFileName: formData.get("uploadedFileName") || file.name,
      sourceType: formData.get("sourceType"),
      destinationType: formData.get("destinationType"),
      mappingTemplateId: formData.get("mappingTemplateId") || undefined,
    });
    if (!metadataResult.success) {
      const flattened = metadataResult.error.flatten().fieldErrors;
      const fieldErrors = Object.fromEntries(
        Object.entries(flattened).filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length)),
      );
      throw new AppError("VALIDATION_ERROR", "The request contains invalid fields.", 400, fieldErrors);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await createImportJob(actor, { ...metadataResult.data, buffer });
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
