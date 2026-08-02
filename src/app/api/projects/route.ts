import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { createProject, listProjects } from "@/lib/repositories/project-repository";
import type { ZodSchema } from "zod";
import {
  projectCreateRequestSchema,
  type ProjectCreateRequest,
} from "@/app/api/_shared/project-payload";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    return apiSuccess(await listProjects(actor.companyId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "projects:manage");
    const input = await parseJsonBody<ProjectCreateRequest>(
      request,
      projectCreateRequestSchema as unknown as ZodSchema<ProjectCreateRequest>,
    );
    const project = await createProject(actor.companyId, input);
    return apiSuccess(project, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
