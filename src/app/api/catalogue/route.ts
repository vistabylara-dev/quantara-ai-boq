import { RateStatus } from "@prisma/client";
import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import {
  createRateCatalogueItem,
  listRateCatalogueItems,
} from "@/lib/repositories/rate-catalogue-repository";
import { rateCatalogueItemSchema } from "@/lib/validation/backend-schemas";

const catalogueQuerySchema = z.object({
  industryId: z.string().trim().min(1).optional(),
  status: z.preprocess(
    (value) => typeof value === "string" ? value.toUpperCase() : value,
    z.nativeEnum(RateStatus),
  ).optional(),
});

type CatalogueCreateRequest = z.output<typeof rateCatalogueItemSchema>;

export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const filters = catalogueQuerySchema.parse({
      industryId: url.searchParams.get("industryId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    const items = await listRateCatalogueItems(actor.companyId, {
      industryEngineId: filters.industryId,
      status: filters.status,
    });
    return apiSuccess(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "catalogue:manage");
    const input = await parseJsonBody<CatalogueCreateRequest>(
      request,
      rateCatalogueItemSchema as unknown as z.ZodSchema<CatalogueCreateRequest>,
    );
    const item = await createRateCatalogueItem(actor.companyId, input);
    return apiSuccess(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
