import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";
import { PROVIDER_REGISTRY } from "@/lib/integrations/provider-registry";

export const dynamic = "force-dynamic";

/** Owner-only registry view: the code-side registry entry plus its DB row (isActive, real connection count) side by side. */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const [dbRows, connectionCounts] = await Promise.all([
      prisma.integrationProvider.findMany(),
      prisma.externalConnection.groupBy({ by: ["providerId", "status"], _count: { _all: true } }),
    ]);
    const dbById = new Map(dbRows.map((row) => [row.id, row]));

    const providers = PROVIDER_REGISTRY.map((provider) => {
      const dbRow = dbById.get(provider.id);
      const counts = connectionCounts.filter((c) => c.providerId === provider.id);
      return {
        ...provider,
        seeded: Boolean(dbRow),
        isActive: dbRow?.isActive ?? true,
        connectionCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      };
    });

    return apiSuccess({ providers, totalConnections: connectionCounts.reduce((sum, c) => sum + c._count._all, 0) });
  } catch (error) {
    return handleApiError(error);
  }
}
