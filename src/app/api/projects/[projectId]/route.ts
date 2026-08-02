import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { archiveProject, getProject, updateProject } from "@/lib/repositories/project-repository";
import type { ZodSchema } from "zod";
import {
  projectUpdateRequestSchema,
  type ProjectUpdateRequest,
} from "@/app/api/_shared/project-payload";

type RouteContext = {
  params: { projectId: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await getProject(actor.companyId, params.projectId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "projects:update");
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

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "projects:archive");
    const project = await archiveProject(actor.companyId, params.projectId);
    return apiSuccess(project);
  } catch (error) {
    return handleApiError(error);
  }
}
