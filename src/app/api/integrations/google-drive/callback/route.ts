import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { completeGoogleDriveConnection, STATE_COOKIE_NAME } from "@/lib/services/google-drive-integration-service";

export const dynamic = "force-dynamic";

/** Google redirects the user's browser here after consent. Full-page navigation, not a fetch() — responds with a redirect back into the app, success or failure either way. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerPageUrl = new URL("/integrations/google-drive", url.origin);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE_NAME)?.value;
  cookieStore.delete(STATE_COOKIE_NAME);

  const error = url.searchParams.get("error");
  if (error) {
    providerPageUrl.searchParams.set("connectError", error === "access_denied" ? "You declined the Google Drive permission request." : error);
    return NextResponse.redirect(providerPageUrl);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !expectedState || state !== expectedState) {
    providerPageUrl.searchParams.set("connectError", "The connection request could not be verified. Please try connecting again.");
    return NextResponse.redirect(providerPageUrl);
  }

  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    await completeGoogleDriveConnection(actor, code);
    providerPageUrl.searchParams.set("connected", "1");
    return NextResponse.redirect(providerPageUrl);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login?next=/integrations/google-drive", url.origin));
    }
    const message = err instanceof Error ? err.message : "Could not complete the Google Drive connection.";
    providerPageUrl.searchParams.set("connectError", message);
    return NextResponse.redirect(providerPageUrl);
  }
}
