import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { generateOAuthState, initiateGoogleDriveConnection, STATE_COOKIE_NAME } from "@/lib/services/google-drive-integration-service";

export const dynamic = "force-dynamic";

/**
 * Full-page navigation (not a fetch() call) — the user clicks "Connect" and
 * their browser is redirected to Google's consent screen, so this responds
 * with an HTTP redirect rather than a JSON envelope. On auth failure it
 * sends the user to /login instead of a bare 401, since a real click landed
 * here.
 */
export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);

    const state = generateOAuthState();
    const authorizationUrl = initiateGoogleDriveConnection(actor, state);

    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes — long enough for the consent screen, short enough to limit CSRF window
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login?next=/integrations/google-drive", request.url));
    }
    const message = error instanceof Error ? error.message : "Could not start the Google Drive connection.";
    return NextResponse.redirect(new URL(`/integrations/google-drive?connectError=${encodeURIComponent(message)}`, request.url));
  }
}
