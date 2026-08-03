import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getDrawingPageImage } from "@/lib/services/drawing-page-service";
import { drawingPageIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { pageId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { pageId } = drawingPageIdParamsSchema.parse(context.params);
    const { buffer, mimeType } = await getDrawingPageImage(actor, pageId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
