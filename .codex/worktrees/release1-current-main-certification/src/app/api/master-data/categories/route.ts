import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { getCategoryTree, listCategories } from "@/lib/repositories/master-taxonomy-repository";

export const dynamic = "force-dynamic";

/** ?disciplineId=&parentCategoryId=  (omit parentCategoryId for top-level, or pass tree=1 for the full nested tree) */
export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const disciplineId = url.searchParams.get("disciplineId");
    if (!disciplineId) throw new AppError("DISCIPLINE_ID_REQUIRED", "disciplineId is required.", 400);

    if (url.searchParams.get("tree") === "1") {
      const data = await getCategoryTree(disciplineId);
      return apiSuccess(data);
    }

    const parentCategoryId = url.searchParams.get("parentCategoryId");
    const data = await listCategories(disciplineId, parentCategoryId ?? null);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
