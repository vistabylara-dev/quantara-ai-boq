import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getProjectFileForDownload } from "@/lib/services/project-file-service";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ fileId: string }> };

/**
 * The only path that ever streams project-file bytes to a client. Tenant
 * scoping happens in getProjectFileForDownload before the storage adapter
 * is touched, so a cross-company fileId 404s before any file access.
 *
 * `?disposition=inline` renders PDF/image bytes inside an <iframe>/<img> for
 * a genuine browser preview instead of forcing a save-file dialog — same
 * authenticated, tenant-scoped bytes either way, only the response header
 * differs. Default stays "attachment" so every existing caller (the plain
 * project-files "Download" links) is unaffected.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const { buffer, fileName, mimeType } = await getProjectFileForDownload(actor, fileId);
    const wantsInline = new URL(request.url).searchParams.get("disposition") === "inline";
    const disposition = wantsInline ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename="${fileName.replace(/["\\]/g, "_")}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
