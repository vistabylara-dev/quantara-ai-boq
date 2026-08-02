import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http/api-response";
import { downloadProposalDocument } from "@/lib/services/public-proposal-service";
import { proposalTokenDocumentParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { token: string; documentId: string } };

/**
 * The only path a client ever reads generated-document bytes through.
 * Token validity, proposal state, document-company/project/revision
 * matching, client-facing audience, and the proposal's own
 * allowDocumentDownload setting are all checked inside
 * downloadProposalDocument before the storage adapter is ever touched.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { token, documentId } = proposalTokenDocumentParamsSchema.parse(context.params);
    const { buffer, fileName, mimeType } = await downloadProposalDocument(token, documentId, request);
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
