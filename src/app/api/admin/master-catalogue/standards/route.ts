import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createStandardAuthorityAsOwner, listStandardAuthoritiesPublic } from "@/lib/services/standards-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({ name: z.string().min(1).max(255), country: z.string().max(100).optional(), website: z.string().max(255).optional() });

/** Owner-only management route. The public read of the same list is at /api/master-data/standards. */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await listStandardAuthoritiesPublic());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await createStandardAuthorityAsOwner(actor, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
