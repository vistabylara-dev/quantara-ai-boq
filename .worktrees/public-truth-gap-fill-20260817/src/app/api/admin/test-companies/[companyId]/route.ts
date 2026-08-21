import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { archiveTestCompany } from "@/lib/services/platform-test-company-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ companyId: z.string().uuid() });

type RouteContext = { params: Promise<{ companyId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { companyId } = paramsSchema.parse(await context.params);
    return apiSuccess(await archiveTestCompany(actor, companyId));
  } catch (error) {
    return handleApiError(error);
  }
}
