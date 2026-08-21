import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getLibraryItemForOwner } from "@/lib/services/company-library-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid() });

type RouteContext = { params: Promise<{ itemId: string }> };

/** ADMIN-DATA-ACCESS-1 — owner-only cross-tenant read of a company's library item, for support/QA/import validation. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    return apiSuccess(await getLibraryItemForOwner(actor, itemId));
  } catch (error) {
    return handleApiError(error);
  }
}
