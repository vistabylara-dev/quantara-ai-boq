import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { listEventsForCompany } from "@/lib/services/integration-event-service";

export const dynamic = "force-dynamic";

const VALID_EVENT_TYPES = new Set([
  "CONNECTION_CREATED", "CONNECTION_REFRESHED", "CONNECTION_REAUTH_REQUIRED", "CONNECTION_DISCONNECTED",
  "CONNECTION_ERROR", "PROJECT_LINKED", "PROJECT_UNLINKED", "SYNC_STARTED", "SYNC_COMPLETED", "SYNC_FAILED",
]);

/** Bounded, filterable, paginated — never the full history in one response. */
async function GETHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const eventTypeParam = url.searchParams.get("eventType");
    const data = await listEventsForCompany(actor.companyId, {
      providerId: url.searchParams.get("providerId") ?? undefined,
      eventType: eventTypeParam && VALID_EVENT_TYPES.has(eventTypeParam) ? (eventTypeParam as never) : undefined,
      status: url.searchParams.get("status") ?? undefined,
      externalConnectionId: url.searchParams.get("connectionId") ?? undefined,
      projectId: url.searchParams.get("projectId") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
      pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined,
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
