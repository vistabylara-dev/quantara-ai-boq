import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getDocumentForDownload } from "@/lib/services/document-generation-service";
import { documentIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ documentId: string }> };

/**
 * The only path that ever reads generated-document bytes off disk. Tenant
 * and RBAC checks happen in getDocumentForDownload before the storage
 * adapter is touched, so a cross-company documentId 404s (via
 * getGeneratedDocumentRecord's companyId-scoped lookup) before any file
 * access is attempted.
 */
async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { documentId } = documentIdParamsSchema.parse(params);
    const { buffer, fileName, mimeType } = await getDocumentForDownload(actor, documentId);
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

export const GET = withActorRequestContext(GETHandler);
