import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActorOrNull } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActorOrNull();
    if (!actor) {
      return apiSuccess({ authenticated: false });
    }

    const [platformIdentity, activeSimulation] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actor.userId },
        select: {
          isActive: true,
          emailVerifiedAt: true,
          platformRole: true,
        },
      }),
      prisma.platformSimulationSession.findUnique({
        where: { userId: actor.userId },
        select: { id: true },
      }),
    ]);

    return apiSuccess({
      authenticated: true,
      user: {
        id: actor.userId,
        companyId: actor.companyId,
        role: actor.role,
        fullName: actor.fullName,
        email: actor.email,
        platformRole:
          platformIdentity?.isActive &&
          platformIdentity.emailVerifiedAt &&
          !activeSimulation
            ? platformIdentity.platformRole
            : null,
        customerPreviewActive: Boolean(activeSimulation),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
