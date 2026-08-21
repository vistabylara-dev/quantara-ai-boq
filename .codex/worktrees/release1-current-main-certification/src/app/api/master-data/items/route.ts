import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { canUsePremiumItemEffective } from "@/lib/entitlements/effective-entitlement-service";
import { listMasterItems, toMasterItemPreviewDTO } from "@/lib/repositories/master-item-repository";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Paginated list, capped at 50/page — never a full-package payload. Locked
 * premium items are down-shaped to a preview (name/category/short
 * description/package name only) server-side, never sent in full, before
 * the response leaves this route (spec Phase 7 section 7/8).
 */
export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const { items, total, page, pageSize } = await listMasterItems({
      disciplineId: url.searchParams.get("disciplineId") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      hierarchyNodeId: url.searchParams.get("hierarchyNodeId") ?? undefined,
      manufacturerId: url.searchParams.get("manufacturerId") ?? undefined,
      regionScope: (url.searchParams.get("regionScope") as never) ?? undefined,
      isPremium: url.searchParams.get("isPremium") === null ? undefined : url.searchParams.get("isPremium") === "true",
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
      pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined,
    });

    const shaped = await Promise.all(
      items.map(async (item) => {
        if (!item.isPremium) return { ...item, locked: false };
        const check = await canUsePremiumItemEffective(actor, item.id);
        if (check.allowed) return { ...item, locked: false };
        const packageLinks = await prisma.industryDataPackageItem.findMany({ where: { masterItemId: item.id }, include: { package: { select: { name: true } } } });
        const row = await prisma.masterItem.findUniqueOrThrow({ where: { id: item.id } });
        return toMasterItemPreviewDTO(row, packageLinks.map((link) => link.package.name));
      }),
    );

    return apiSuccess({ items: shaped, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}
