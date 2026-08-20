import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import {
  publishAdminProductManagerProduct,
  unpublishAdminProductManagerProduct,
} from "@/lib/services/admin-product-manager-service";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { commerceProductIdParamsSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

const actionSchema = z.object({
  action: z.enum(["PUBLISH", "UNPUBLISH"]),
}).strict();

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { productId } = commerceProductIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, actionSchema);

    if (input.action === "PUBLISH") {
      return apiSuccess(
        await publishAdminProductManagerProduct(
          actor,
          productId,
          buildPlatformRequestMetadata(request),
        ),
      );
    }

    return apiSuccess(
      await unpublishAdminProductManagerProduct(
        actor,
        productId,
        buildPlatformRequestMetadata(request),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
