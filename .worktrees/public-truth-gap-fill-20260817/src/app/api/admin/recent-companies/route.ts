import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import {
  buildPlatformRequestMetadata,
  listPlatformRecentCompanies,
} from "@/lib/services/platform-admin-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor();
    return apiSuccess(await listPlatformRecentCompanies(actor, buildPlatformRequestMetadata(request)));
  } catch (error) {
    return handleApiError(error);
  }
}
