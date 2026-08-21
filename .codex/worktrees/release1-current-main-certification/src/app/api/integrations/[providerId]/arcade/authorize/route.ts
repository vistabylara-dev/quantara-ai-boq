import { z } from "zod";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getArcadeRuntime } from "@/lib/integrations/arcade/arcade-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const paramsSchema = z.object({
  providerId: z.string().trim().min(1).max(100),
}).strict();

const capabilitySchema = z.string().trim().min(1).max(100).regex(/^[A-Z][A-Z0-9_]*$/);

const startAuthorizationSchema = z.object({
  // A Quantara capability identifier, never an Arcade tool name. The runtime
  // resolves the exact tool exclusively from its server-side configuration.
  capability: capabilitySchema,
}).strict();

const checkAuthorizationSchema = z.object({
  capability: capabilitySchema,
  authorizationId: z.string().trim().min(1).max(200),
  authorizationTransactionToken: z.string()
    .trim()
    .min(1)
    .max(1024)
    .regex(/^[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{43}$/),
}).strict();

const requestSchema = z.union([
  checkAuthorizationSchema,
  startAuthorizationSchema,
]);

type RouteContext = { params: Promise<{ providerId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "integrations:connect");

    const { providerId } = paramsSchema.parse(await context.params);
    const input = await parseJsonBody(request, requestSchema);
    const arcadeRuntime = getArcadeRuntime();
    const result = "authorizationId" in input
      ? await arcadeRuntime.checkAuthorization({
          actor,
          providerId,
          capability: input.capability,
          authorizationId: input.authorizationId,
          authorizationTransactionToken: input.authorizationTransactionToken,
        })
      : await arcadeRuntime.authorize({
          actor,
          providerId,
          capability: input.capability,
        });

    return apiSuccess({
      providerId,
      runtime: "arcade" as const,
      capability: input.capability,
      ...result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
