import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { AppError, UnauthorizedError } from "@/lib/errors/app-error";
import {
  completeGoogleDriveConnection,
  STATE_COOKIE_NAME,
  verifyGoogleDriveOAuthState,
} from "@/lib/services/google-drive-integration-service";

export const dynamic = "force-dynamic";

/**
 * Google redirects the user's browser here after consent. Full-page
 * navigation, not a fetch() — responds with a redirect back into the app,
 * success or failure either way.
 *
 * Restores the first-OAuth context (projectId/intent/returnTo) carried in
 * the verified state, so a first-time connector lands back on the exact
 * project/source-import journey they started from instead of a generic
 * integrations page — matching the already-connected in-app path. The
 * context comes from verifyGoogleDriveOAuthState, which re-validates
 * project ownership; it is never trusted from an unsigned query param.
 */
async function GETHandler(request: Request) {
  const url = new URL(request.url);
  const connectPageUrl = new URL("/integrations/google-drive/connect", url.origin);

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME)?.value ?? null;
  cookieStore.delete(STATE_COOKIE_NAME);

  let restoredContext: { projectId: string | null; intent: string | null; returnTo: string | null } = {
    projectId: null,
    intent: null,
    returnTo: null,
  };

  try {
    const actor = await getCurrentActor();
    setActorContext(actor);

    restoredContext = await verifyGoogleDriveOAuthState(
      actor,
      url.searchParams.get("state"),
      stateCookie,
    );

    const providerError = url.searchParams.get("error");
    if (providerError) {
      throw new AppError(
        "GOOGLE_DRIVE_AUTH_DENIED",
        "Google Drive authorization was not granted.",
        403,
      );
    }

    const code = url.searchParams.get("code");
    if (!code) {
      throw new AppError(
        "GOOGLE_DRIVE_TOKEN_ERROR",
        "Google Drive did not return a valid authorization response.",
        400,
      );
    }
    await completeGoogleDriveConnection(actor, code);

    // Land back on the connect panel itself (not straight past it to
    // returnTo) — the panel is where the user actually browses/selects
    // files to import, exactly like the already-connected path. returnTo is
    // restored so the panel's "back to project without importing" escape
    // hatch and post-import redirect both work, matching that same path.
    if (restoredContext.projectId) connectPageUrl.searchParams.set("projectId", restoredContext.projectId);
    if (restoredContext.intent) connectPageUrl.searchParams.set("intent", restoredContext.intent);
    if (restoredContext.returnTo) connectPageUrl.searchParams.set("returnTo", restoredContext.returnTo);
    connectPageUrl.searchParams.set("connected", "1");
    return NextResponse.redirect(connectPageUrl);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login?next=/integrations/google-drive/connect", url.origin));
    }
    const allowedCodes = new Set([
      "GOOGLE_DRIVE_NOT_CONFIGURED",
      "GOOGLE_DRIVE_OAUTH_STATE_MISMATCH",
      "GOOGLE_DRIVE_AUTH_DENIED",
      "GOOGLE_DRIVE_TOKEN_ERROR",
      "GOOGLE_DRIVE_NO_REFRESH_TOKEN",
      "GOOGLE_DRIVE_REAUTH_REQUIRED",
    ]);
    const code = err instanceof AppError && allowedCodes.has(err.code)
      ? err.code
      : "GOOGLE_DRIVE_TOKEN_ERROR";
    // Restore project context on failure too, so the connect panel can still
    // offer "back to project" instead of stranding the user on a blank
    // generic page — the whole point of restoring first-OAuth context.
    if (restoredContext.projectId) connectPageUrl.searchParams.set("projectId", restoredContext.projectId);
    if (restoredContext.intent) connectPageUrl.searchParams.set("intent", restoredContext.intent);
    if (restoredContext.returnTo) connectPageUrl.searchParams.set("returnTo", restoredContext.returnTo);
    connectPageUrl.searchParams.set("connectError", code);
    return NextResponse.redirect(connectPageUrl);
  }
}

export const GET = withActorRequestContext(GETHandler);
