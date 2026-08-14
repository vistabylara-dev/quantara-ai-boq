import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { addManualPageRow } from "@/lib/services/table-page-recovery-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  projectId: z.string().trim().min(1),
  fileId: z.string().uuid(),
  pageNumber: z.coerce.number().int().min(1),
});

const manualRowSchema = z.object({
  itemCode: z.string().trim().min(1, "Item code is required.").max(100),
  description: z.string().trim().min(1, "Description is required.").max(2000),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
});

type RouteContext = { params: Promise<{ projectId: string; fileId: string; pageNumber: string }> };

/**
 * Saves a manually-typed row for a page the deterministic extraction
 * pipeline couldn't safely reconstruct. SOURCE REVIEW evidence only — this
 * never creates a BOQItem and never auto-imports; a human must still
 * confirm it through the normal extracted-entity review flow.
 */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId, fileId, pageNumber } = paramsSchema.parse(await context.params);
    const input = await parseJsonBody(request, manualRowSchema);
    const data = await addManualPageRow(actor, projectId, fileId, pageNumber, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
