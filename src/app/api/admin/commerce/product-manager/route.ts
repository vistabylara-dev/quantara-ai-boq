import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import {
  createAdminProductManagerDraft,
  listAdminProductManagerProducts,
} from "@/lib/services/admin-product-manager-service";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { adminProductManagerCreateSchema } from "@/lib/validation/admin-product-manager-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await listAdminProductManagerProducts(actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = await parseJsonBody(request, adminProductManagerCreateSchema);

    return apiSuccess(
      await createAdminProductManagerDraft(
        actor,
        input,
        buildPlatformRequestMetadata(request),
      ),
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}