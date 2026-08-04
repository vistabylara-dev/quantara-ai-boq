import { PlatformRole } from "@prisma/client";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getMasterItemViewAccessEffective } from "@/lib/entitlements/effective-entitlement-service";
import { getMasterItemRecord, getMasterItemCustomerDetail, toMasterItemPreviewDTO } from "@/lib/repositories/master-item-repository";
import { buildMasterItemAdminDetail } from "@/lib/services/master-item-governance-service";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import { masterItemIdParamsSchema } from "@/lib/validation/route-params";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

/**
 * ADMIN-DATA-ACCESS-1 — server-side view-access gate, resolved through the
 * single centralized policy (getMasterItemViewAccessEffective) rather than
 * the plain company-scoped entitlement check this route used before, which
 * treated a platform owner exactly like an ordinary company user with no
 * package for the item (the production bug: the owner override this app
 * already has elsewhere — the sibling list route, the BOQ-add flow — was
 * simply never reused here). A real (non-simulating) platform owner gets
 * `isOwnerView: true` and the same administrative detail the admin catalogue
 * page shows (versions, classifications, source batch, completeness inputs)
 * layered onto the customer-safe detail; everyone else gets exactly what
 * they got before — full detail if entitled, a locked preview otherwise.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = masterItemIdParamsSchema.parse(params);
    const row = await getMasterItemRecord(itemId);

    const access = await getMasterItemViewAccessEffective(actor, itemId);

    if (!access.allowed) {
      const packageLinks = await prisma.industryDataPackageItem.findMany({ where: { masterItemId: itemId }, include: { package: { select: { name: true } } } });
      const preview = toMasterItemPreviewDTO(row, packageLinks.map((link) => link.package.name));
      // Simulation must still surface here, or a simulating owner sees a silent, unexplained lock (spec: "never silently deny the owner without explanation").
      return apiSuccess({ ...preview, isOwnerView: false, simulationMode: access.source === "simulation" ? access.simulationMode : null });
    }

    const detail = await getMasterItemCustomerDetail(itemId);

    if (access.isOwnerView) {
      const adminDetail = await buildMasterItemAdminDetail(itemId);
      await recordPlatformActionAudit({
        actorUserId: actor.userId,
        actorPlatformRole: PlatformRole.PLATFORM_OWNER,
        action: "ADMIN_ITEM_VIEWED",
        targetType: "MasterItem",
        targetId: itemId,
        metadata: { simulationActive: false },
      });
      return apiSuccess({
        ...detail,
        locked: false,
        isOwnerView: true,
        simulationMode: null,
        admin: {
          status: adminDetail.item.status,
          isPremium: adminDetail.item.isPremium,
          sourceBatchId: adminDetail.item.sourceBatchId,
          version: adminDetail.item.version,
          // Full version history including DRAFT/REVIEW/RETIRED, and every classification
          // (not just published/current) — this is exactly the extra visibility a customer's
          // detail response never includes.
          versions: adminDetail.versions,
          classifications: adminDetail.classifications,
          drawingProfile: adminDetail.drawingProfile,
          attributeValues: adminDetail.attributeValues,
          hierarchyBreadcrumb: adminDetail.hierarchyBreadcrumb,
        },
      });
    }

    return apiSuccess({ ...detail, locked: false, isOwnerView: false, simulationMode: access.source === "simulation" ? access.simulationMode : null });
  } catch (error) {
    return handleApiError(error);
  }
}
