import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { canUsePremiumItem } from "@/lib/entitlements/entitlement-service";
import { getMasterItemRecord, toMasterItemDTO, toMasterItemPreviewDTO } from "@/lib/repositories/master-item-repository";
import { masterItemIdParamsSchema } from "@/lib/validation/route-params";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

/**
 * Server-side entitlement gate — full technical data (fullDescription,
 * technicalFieldsJson, synonyms, document labels) is only ever returned
 * when canUsePremiumItem allows it. Otherwise a locked preview is returned
 * instead; the client never receives the full record to hide client-side.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = masterItemIdParamsSchema.parse(params);
    const row = await getMasterItemRecord(itemId);

    if (!row.isPremium) {
      return apiSuccess({ ...toMasterItemDTO(row), locked: false });
    }

    const check = await canUsePremiumItem(actor.companyId, itemId);
    if (check.allowed) {
      return apiSuccess({ ...toMasterItemDTO(row), locked: false });
    }

    const packageLinks = await prisma.industryDataPackageItem.findMany({ where: { masterItemId: itemId }, include: { package: { select: { name: true } } } });
    return apiSuccess(toMasterItemPreviewDTO(row, packageLinks.map((link) => link.package.name)));
  } catch (error) {
    return handleApiError(error);
  }
}
