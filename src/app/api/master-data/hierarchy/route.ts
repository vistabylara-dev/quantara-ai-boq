import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getPublicHierarchyTree } from "@/lib/services/master-hierarchy-service";

export const dynamic = "force-dynamic";

/** Authenticated, bounded taxonomy tree (active nodes only) for building industry/discipline/system/category filters. */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const data = await getPublicHierarchyTree();
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
