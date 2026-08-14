import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db/prisma";
import { RateStatus } from "@prisma/client";
import { refreshCatalogueStatuses } from "@/lib/repositories/rate-catalogue-repository";

export const dynamic = "force-dynamic";

async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const companyId = actor.companyId;

    await refreshCatalogueStatuses(companyId);

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [activeCatalogueItems, expiredRates, totalSuppliers, expiringWithin30Days, belowMinimumRows] =
      await Promise.all([
        prisma.rateCatalogueItem.count({ where: { companyId, status: RateStatus.ACTIVE } }),
        prisma.rateCatalogueItem.count({ where: { companyId, status: RateStatus.EXPIRED } }),
        prisma.supplier.count({ where: { companyId, isActive: true } }),
        prisma.rateCatalogueItem.count({
          where: { companyId, status: RateStatus.ACTIVE, expiryDate: { not: null, lte: in30Days, gte: now } },
        }),
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) AS count FROM "RateCatalogueItem"
          WHERE "companyId" = ${companyId}::uuid
            AND status = 'ACTIVE'
            AND "minimumSellingRate" IS NOT NULL
            AND "sellingRate" < "minimumSellingRate"
        `,
      ]);

    const itemsBelowMinimum = Number(belowMinimumRows[0]?.count ?? 0);

    return apiSuccess({
      activeCatalogueItems,
      expiredRates,
      totalSuppliers,
      expiringWithin30Days,
      itemsBelowMinimum,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
