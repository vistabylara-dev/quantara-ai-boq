import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { getProject, updateProject } from "@/lib/repositories/project-repository";
import { deleteUnusedProject } from "@/lib/services/project-deletion-service";
import type { ZodSchema } from "zod";
import {
  projectUpdateRequestSchema,
  type ProjectUpdateRequest,
} from "@/app/api/_shared/project-payload";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    return apiSuccess(await getProject(actor.companyId, params.projectId));
  } catch (error) {
    return handleApiError(error);
  }
}

async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "projects:update");
    const params = await context.params;
    const input = await parseJsonBody<ProjectUpdateRequest>(
      request,
      projectUpdateRequestSchema as unknown as ZodSchema<ProjectUpdateRequest>,
    );
    const project = await updateProject(actor.companyId, params.projectId, input);
    return apiSuccess(project);
  } catch (error) {
    return handleApiError(error);
  }
}

async function DELETEHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const project = await deleteUnusedProject(actor, params.projectId);
    return apiSuccess(project);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const PUT = withActorRequestContext(PUTHandler);
export const DELETE = withActorRequestContext(DELETEHandler);
