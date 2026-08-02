import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getCategory, listCategories, listTechnicalFieldDefinitions } from "@/lib/repositories/master-taxonomy-repository";
import { categoryIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { categoryId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { categoryId } = categoryIdParamsSchema.parse(context.params);
    const category = await getCategory(categoryId);
    const [children, fieldDefinitions] = await Promise.all([
      listCategories(category.disciplineId, categoryId),
      listTechnicalFieldDefinitions(category.disciplineId, categoryId),
    ]);
    return apiSuccess({ category, children, fieldDefinitions });
  } catch (error) {
    return handleApiError(error);
  }
}
