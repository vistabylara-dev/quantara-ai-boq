import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { NotFoundError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ providerId: z.string().min(1).max(100) });
const bodySchema = z.object({ isActive: z.boolean() });

type RouteContext = { params: Promise<{ providerId: string }> };

/** Owner-only. Toggles a seeded IntegrationProvider row's active state — does not remove it from the code registry, only hides/disables it operationally. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { providerId } = paramsSchema.parse(await context.params);
    const { isActive } = bodySchema.parse(await request.json());

    const existing = await prisma.integrationProvider.findUnique({ where: { id: providerId } });
    if (!existing) throw new NotFoundError("Provider not found — run the seed script first.");

    const updated = await prisma.integrationProvider.update({ where: { id: providerId }, data: { isActive } });

    await recordPlatformActionAudit({
      actorUserId: actor.userId,
      actorPlatformRole: actor.platformRole,
      action: isActive ? "INTEGRATION_PROVIDER_ACTIVATED" : "INTEGRATION_PROVIDER_DEACTIVATED",
      targetType: "IntegrationProvider",
      targetId: providerId,
      metadata: { displayName: existing.displayName },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
