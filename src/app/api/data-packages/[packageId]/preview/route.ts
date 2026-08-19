import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { NotFoundError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";
import { searchPackageItems } from "@/lib/repositories/industry-package-repository";
import { toMasterItemPreviewDTO } from "@/lib/repositories/master-item-repository";
import { packageIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ packageId: string }> };

/**
 * Locked preview — deliberately does NOT require package access (that's the
 * point: this is what a company without access sees on the marketplace
 * detail page). Every item is always down-shaped through the same
 * toMasterItemPreviewDTO helper the master-data catalogue already uses for
 * locked premium items, so this route can never leak full technical detail
 * regardless of what the client requests. Authenticated + company-scoped
 * like every other route here, but not gated on the package itself.
 */
async function GETHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { packageId } = packageIdParamsSchema.parse(params);

    const pkg = await prisma.industryDataPackage.findUnique({ where: { id: packageId }, select: { id: true, name: true } });
    if (!pkg) throw new NotFoundError("Package not found.");

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
    const search = url.searchParams.get("search") || undefined;

    const { total, items } = await searchPackageItems(pkg.id, { page, pageSize, search });

    return apiSuccess({
      total,
      items: items.map((item) => toMasterItemPreviewDTO(item, [pkg.name])),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
