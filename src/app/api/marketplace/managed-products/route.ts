import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listPublishedManagedProducts } from "@/lib/services/managed-product-public-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return apiSuccess(await listPublishedManagedProducts());
  } catch (error) {
    return handleApiError(error);
  }
}
