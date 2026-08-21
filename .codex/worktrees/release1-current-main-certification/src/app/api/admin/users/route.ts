import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import {
  buildPlatformRequestMetadata,
  listPlatformUsers,
} from "@/lib/services/platform-admin-service";
import { platformUserListQuerySchema } from "@/lib/validation/platform-admin-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor();
    const query = platformUserListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return apiSuccess(
      await listPlatformUsers(actor, query, buildPlatformRequestMetadata(request)),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
