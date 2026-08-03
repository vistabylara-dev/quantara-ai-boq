import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import {
  deactivateSupplierForCompany,
  getSupplierForCompany,
  updateSupplierForCompany,
} from "@/lib/services/supplier-service";
import { supplierUpdateSchema } from "@/lib/validation/supplier-schema";
import { z } from "zod";

const supplierIdParamsSchema = z.object({ supplierId: z.string().uuid("A valid supplier ID is required.") });

type RouteContext = {
  params: Promise<{ supplierId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { supplierId } = supplierIdParamsSchema.parse(params);
    return apiSuccess(await getSupplierForCompany(actor, supplierId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { supplierId } = supplierIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, supplierUpdateSchema);
    const supplier = await updateSupplierForCompany(actor, supplierId, input);
    return apiSuccess(supplier);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { supplierId } = supplierIdParamsSchema.parse(params);
    const supplier = await deactivateSupplierForCompany(actor, supplierId);
    return apiSuccess(supplier);
  } catch (error) {
    return handleApiError(error);
  }
}
