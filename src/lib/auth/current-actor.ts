import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { readSessionTokenFromCookies } from "./session";
import { hashToken } from "./tokens";

export type CurrentActor = {
  userId: string;
  companyId: string;
  role: UserRole;
  fullName: string;
  email: string;
};

async function resolveActorFromCookie(): Promise<CurrentActor | null> {
  const rawToken = await readSessionTokenFromCookies();
  if (!rawToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (!session.user.isActive) {
    return null;
  }

  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    role: session.user.role,
    fullName: session.user.fullName,
    email: session.user.email,
  };
}

/**
 * Resolves the authenticated actor for the current request. Throws
 * UnauthorizedError (401) when there is no valid session, so route handlers
 * can call this once and let handleApiError translate the failure.
 *
 * IMPORTANT: this does NOT assign the audit actor itself. Route handlers are
 * wrapped with `withActorRequestContext()` and must call
 * `setActorContext(actor)` immediately after awaiting this so every downstream
 * audit write sees the authenticated actor:
 *
 *   const actor = await getCurrentActor();
 *   setActorContext(actor);
 */
export async function getCurrentActor(): Promise<CurrentActor> {
  const actor = await resolveActorFromCookie();
  if (!actor) {
    throw new UnauthorizedError();
  }
  return actor;
}

export async function getCurrentActorOrNull(): Promise<CurrentActor | null> {
  return resolveActorFromCookie();
}
