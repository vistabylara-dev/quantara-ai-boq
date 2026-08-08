import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { AppError, UnauthorizedError } from "@/lib/errors/app-error";
import {
  completeGoogleDriveConnection,
  STATE_COOKIE_NAME,
  verifyGoogleDriveOAuthState,
} from "@/lib/services/google-drive-integration-service";

export const dynamic = "force-dynamic";

/** Google redirects the user's browser here after consent. Full-page navigation, not a fetch() — responds with a redirect back into the app, success or failure either way. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const connectPageUrl = new URL("/integrations/google-drive/connect", url.origin);

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME)?.value ?? null;
  cookieStore.delete(STATE_COOKIE_NAME);

  try {
    const actor = await getCurrentActor();
    setActorContext(actor);

    verifyGoogleDriveOAuthState(
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
    connectPageUrl.searchParams.set("connectError", code);
    return NextResponse.redirect(connectPageUrl);
  }
}
