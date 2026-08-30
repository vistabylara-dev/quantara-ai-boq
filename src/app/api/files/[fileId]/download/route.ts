import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getProjectFileDownloadMeta, getProjectFileForStreamingDownload } from "@/lib/services/project-file-service";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ fileId: string }> };

const INLINE_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  tif: "image/tiff",
  tiff: "image/tiff",
};

function canRenderInline(extension: string, mimeType: string): boolean {
  return INLINE_MIME_BY_EXTENSION[extension.toLowerCase()] === mimeType.toLowerCase();
}

/** Parses a single-range `Range: bytes=start-end` header. Multi-range requests and malformed headers return null (caller falls back to a full 200 response). */
function parseRangeHeader(header: string | null, totalSize: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return null;

  let start: number;
  let end: number;
  if (startStr === "") {
    // Suffix range: last N bytes.
    const suffixLength = Number(endStr);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? totalSize - 1 : Number(endStr);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
  return { start, end };
}

/**
 * The only path that ever streams project-file bytes to a client. Tenant
 * scoping happens before the storage adapter is ever touched, so a
 * cross-company fileId 404s before any file access. Supports HTTP Range
 * requests (206 Partial Content) so large-PDF viewers can seek without
 * downloading the whole file — the object is streamed straight through,
 * never buffered into memory. The file's size is read from the database
 * (already persisted at upload time) to validate any Range header before
 * ever opening a storage stream, so exactly one storage call happens per
 * request regardless of whether a range was requested.
 *
 * `?disposition=inline` renders PDF/image bytes inside an <iframe>/<img> for
 * a genuine browser preview instead of forcing a save-file dialog — same
 * authenticated, tenant-scoped bytes either way, only the response header
 * differs. Default stays "attachment" so every existing caller (the plain
 * project-files "Download" links) is unaffected.
 */
async function GETHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const meta = await getProjectFileDownloadMeta(actor, fileId);
    const wantsInline = new URL(request.url).searchParams.get("disposition") === "inline";
    const disposition = wantsInline && canRenderInline(meta.extension, meta.mimeType)
      ? "inline"
      : "attachment";
    const range = parseRangeHeader(request.headers.get("range"), meta.totalSize);
    const result = await getProjectFileForStreamingDownload(actor, fileId, range ?? undefined);

    const safeFileName = result.fileName.replace(/["\\]/g, "_");
    const baseHeaders: Record<string, string> = {
      "Content-Type": result.mimeType,
      "Content-Disposition": `${disposition}; filename="${safeFileName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
    };

    if (result.servedRange) {
      const { start, end } = result.servedRange;
      return new NextResponse(result.body, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${result.totalSize}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }

    return new NextResponse(result.body, {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(result.totalSize) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
