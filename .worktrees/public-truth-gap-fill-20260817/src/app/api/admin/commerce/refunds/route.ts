import { PlatformRole, type RefundRequestStatus } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listAllRefundRequests } from "@/lib/repositories/refund-request-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUSES = new Set<RefundRequestStatus>(["REQUESTED", "APPROVED", "REJECTED", "PROCESSING", "SUCCEEDED", "FAILED"]);

/** REFUND-11 — owner/admin/support read access, matching the existing platform-wide "read is broader than write" pattern (platform:read is granted to every platform role); only platform:refund gates the actual approve/reject/execute actions in the sibling [id]/approve and [id]/reject routes. */
export async function GET(request: Request) {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER, PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_SUPPORT]);
    const statusParam = new URL(request.url).searchParams.get("status");
    const status = statusParam && VALID_STATUSES.has(statusParam as RefundRequestStatus) ? (statusParam as RefundRequestStatus) : undefined;
    return apiSuccess(await listAllRefundRequests(undefined, status));
  } catch (error) {
    return handleApiError(error);
  }
}
