import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { grantPackageAccess } from "@/lib/services/master-catalogue-activation-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ packageId: z.string().uuid() });
const bodySchema = z.object({ companyId: z.string().uuid() });

type RouteContext = { params: Promise<{ packageId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { packageId } = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());
    return apiSuccess(await grantPackageAccess(actor, packageId, body.companyId));
  } catch (error) {
    return handleApiError(error);
  }
}
