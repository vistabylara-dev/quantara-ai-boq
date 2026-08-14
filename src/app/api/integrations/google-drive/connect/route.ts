import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { AppError, UnauthorizedError } from "@/lib/errors/app-error";
import {
  createGoogleDriveOAuthState,
  initiateGoogleDriveConnection,
  STATE_COOKIE_NAME,
} from "@/lib/services/google-drive-integration-service";

export const dynamic = "force-dynamic";

/**
 * Full-page navigation (not a fetch() call) — the user clicks "Connect" and
 * their browser is redirected to Google's consent screen, so this responds
 * with an HTTP redirect rather than a JSON envelope. On auth failure it
 * sends the user to /login instead of a bare 401, since a real click landed
 * here.
 *
 * Reads projectId/intent/returnTo off the query string (forwarded by the
 * "Connect with Google" link) and signs them into the OAuth state so the
 * callback can restore exactly where the user started — first-time
 * connectors previously lost this context the moment the browser left for
 * Google, unlike the already-connected in-app path.
 */
async function GETHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);

    const url = new URL(request.url);
    const { state, cookieValue } = await createGoogleDriveOAuthState(actor, {
      projectId: url.searchParams.get("projectId"),
      intent: url.searchParams.get("intent"),
      returnTo: url.searchParams.get("returnTo"),
    });
    const authorizationUrl = initiateGoogleDriveConnection(actor, state);

    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes — long enough for the consent screen, short enough to limit CSRF window
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login?next=/integrations/google-drive/connect", request.url));
    }
    const code = error instanceof AppError && error.code === "GOOGLE_DRIVE_NOT_CONFIGURED"
      ? error.code
      : "GOOGLE_DRIVE_CONNECT_FAILED";
    return NextResponse.redirect(new URL(`/integrations/google-drive/connect?connectError=${code}`, request.url));
  }
}

export const GET = withActorRequestContext(GETHandler);
