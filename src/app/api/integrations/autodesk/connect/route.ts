import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { AppError, UnauthorizedError } from "@/lib/errors/app-error";
import {
  createAutodeskOAuthState,
  initiateAutodeskConnection,
  STATE_COOKIE_NAME,
} from "@/lib/services/autodesk-integration-service";

export const dynamic = "force-dynamic";

/** Starts a full-page APS authorization redirect; never exposes OAuth secrets to the browser. */
export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { state, cookieValue } = createAutodeskOAuthState(actor);
    const authorizationUrl = initiateAutodeskConnection(actor, state);

    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login?next=/integrations/autodesk/connect", request.url));
    }
    const code = error instanceof AppError && error.code === "AUTODESK_NOT_CONFIGURED"
      ? error.code
      : "AUTODESK_CONNECT_FAILED";
    return NextResponse.redirect(new URL(`/integrations/autodesk/connect?connectError=${code}`, request.url));
  }
}
