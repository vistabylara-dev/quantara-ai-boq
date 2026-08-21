import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getReportForDownload } from "@/lib/services/technical-report-service";
import { technicalReportIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reportId: string }> };

/**
 * The only path that reads generated-technical-report bytes off disk. Tenant and RBAC checks
 * happen in getReportForDownload before the storage adapter is touched, mirroring
 * /api/documents/[documentId]/download.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { reportId } = technicalReportIdParamsSchema.parse(params);
    const { buffer, fileName, mimeType } = await getReportForDownload(actor, reportId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${fileName.replace(/["\\]/g, "_")}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
