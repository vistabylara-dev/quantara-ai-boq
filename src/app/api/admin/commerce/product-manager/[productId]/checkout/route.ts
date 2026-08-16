import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import {
  activateManagedProductCheckout,
  previewManagedProductCheckoutActivation,
} from "@/lib/services/admin-product-manager-checkout-service";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { commerceProductIdParamsSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

const actionSchema = z
  .object({
    action: z.enum(["PREFLIGHT", "ACTIVATE"]),
  })
  .strict();

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { productId } = commerceProductIdParamsSchema.parse(
      await context.params,
    );
    const input = await parseJsonBody(request, actionSchema);

    if (input.action === "PREFLIGHT") {
      return apiSuccess(
        await previewManagedProductCheckoutActivation(actor, productId),
      );
    }

    return apiSuccess(
      await activateManagedProductCheckout(
        actor,
        productId,
        buildPlatformRequestMetadata(request),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
