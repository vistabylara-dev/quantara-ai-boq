import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listProjects } from "@/lib/repositories/project-repository";
import { createProjectWithDefaultBoq } from "@/lib/services/project-service";
import type { ZodSchema } from "zod";
import {
  projectCreateRequestSchema,
  type ProjectCreateRequest,
} from "@/app/api/_shared/project-payload";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await listProjects(actor.companyId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody<ProjectCreateRequest>(
      request,
      projectCreateRequestSchema as unknown as ZodSchema<ProjectCreateRequest>,
    );
    const result = await createProjectWithDefaultBoq(actor, input);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
