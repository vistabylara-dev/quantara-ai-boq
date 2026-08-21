import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import {
  buildPlatformRequestMetadata,
  listPlatformSoftwareSubscriptions,
} from "@/lib/services/platform-admin-service";
import { platformSubscriptionListQuerySchema } from "@/lib/validation/platform-admin-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor();
    const query = platformSubscriptionListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return apiSuccess(
      await listPlatformSoftwareSubscriptions(
        actor,
        query,
        buildPlatformRequestMetadata(request),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
