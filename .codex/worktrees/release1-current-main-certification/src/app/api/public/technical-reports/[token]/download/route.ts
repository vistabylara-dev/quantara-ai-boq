import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http/api-response";
import { downloadPublicTechnicalReport } from "@/lib/services/public-technical-report-service";
import { technicalReportTokenParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

/** The only path a client reads generated-technical-report bytes through without a session. Token
 *  validity, revocation, and expiry are all checked inside downloadPublicTechnicalReport before
 *  the storage adapter is ever touched, mirroring /api/public/proposals/[token]/documents/[id]. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const { token } = technicalReportTokenParamsSchema.parse(params);
    const { buffer, fileName, mimeType } = await downloadPublicTechnicalReport(token);
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
