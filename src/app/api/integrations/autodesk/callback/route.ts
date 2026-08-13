import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { AppError, UnauthorizedError } from "@/lib/errors/app-error";
import {
  completeAutodeskConnection,
  STATE_COOKIE_NAME,
  verifyAutodeskOAuthState,
} from "@/lib/services/autodesk-integration-service";

export const dynamic = "force-dynamic";

/** Completes the APS redirect only after validating the signed, tenant-bound state cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const connectPageUrl = new URL("/integrations/autodesk/connect", url.origin);
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME)?.value ?? null;
  cookieStore.delete(STATE_COOKIE_NAME);

  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    verifyAutodeskOAuthState(actor, url.searchParams.get("state"), stateCookie);

    if (url.searchParams.get("error")) {
      throw new AppError("AUTODESK_AUTH_DENIED", "Autodesk authorization was not granted.", 403);
    }
    const code = url.searchParams.get("code");
    if (!code) {
      throw new AppError("AUTODESK_TOKEN_ERROR", "Autodesk did not return a valid authorization response.", 400);
    }

    await completeAutodeskConnection(actor, code);
    connectPageUrl.searchParams.set("connected", "1");
    return NextResponse.redirect(connectPageUrl);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login?next=/integrations/autodesk/connect", url.origin));
    }
    const allowedCodes = new Set([
      "AUTODESK_NOT_CONFIGURED",
      "AUTODESK_OAUTH_STATE_MISMATCH",
      "AUTODESK_AUTH_DENIED",
      "AUTODESK_TOKEN_ERROR",
      "AUTODESK_NO_REFRESH_TOKEN",
      "AUTODESK_REAUTH_REQUIRED",
    ]);
    const code = error instanceof AppError && allowedCodes.has(error.code)
      ? error.code
      : "AUTODESK_TOKEN_ERROR";
    connectPageUrl.searchParams.set("connectError", code);
    return NextResponse.redirect(connectPageUrl);
  }
}
