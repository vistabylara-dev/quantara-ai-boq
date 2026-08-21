import { PlatformRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  PermissionDeniedError,
  UnauthorizedError,
} from "@/lib/errors/app-error";
import { getCurrentActor } from "./current-actor";

export type PlatformActor = {
  userId: string;
  companyId: string;
  platformRole: PlatformRole;
  fullName: string;
  email: string;
};

export type PlatformCapability =
  | "platform:read"
  | "platform:operate"
  | "platform:manage-roles"
  | "platform:manage-administrators"
  | "platform:high-risk"
  | "platform:audit:read";

export const PLATFORM_READ_ROLES = [
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.PLATFORM_ADMIN,
  PlatformRole.PLATFORM_SUPPORT,
] as const;

export const PLATFORM_OPERATIONAL_ROLES = [
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.PLATFORM_ADMIN,
] as const;

export const PLATFORM_OWNER_ROLES = [PlatformRole.PLATFORM_OWNER] as const;

const PLATFORM_ROLE_CAPABILITIES: Record<PlatformRole, readonly PlatformCapability[]> = {
  [PlatformRole.PLATFORM_OWNER]: [
    "platform:read",
    "platform:operate",
    "platform:manage-roles",
    "platform:manage-administrators",
    "platform:high-risk",
    "platform:audit:read",
  ],
  [PlatformRole.PLATFORM_ADMIN]: ["platform:read", "platform:operate"],
  [PlatformRole.PLATFORM_SUPPORT]: ["platform:read"],
};

export type PlatformAuthorizationFailure =
  | "EMAIL_NOT_VERIFIED"
  | "PLATFORM_ROLE_REQUIRED"
  | "PLATFORM_ROLE_NOT_ALLOWED";

export class PlatformAuthorizationError extends PermissionDeniedError {
  readonly reason: PlatformAuthorizationFailure;

  constructor(
    message = "This account does not have platform access.",
    reason: PlatformAuthorizationFailure = "PLATFORM_ROLE_REQUIRED",
  ) {
    super(message);
    this.name = "PlatformAuthorizationError";
    this.reason = reason;
  }
}

function denyPlatformAccess(
  message: string,
  reason: PlatformAuthorizationFailure = "PLATFORM_ROLE_NOT_ALLOWED",
): never {
  throw new PlatformAuthorizationError(message, reason);
}

/**
 * Resolves platform access from the existing authenticated database session,
 * then reloads the user with an explicit select. The platform role is never
 * accepted from a cookie, request body, URL, or caller-provided actor.
 *
 * When `allowedRoles` is omitted, every platform role is accepted. Supplying
 * an empty list intentionally denies every platform actor.
 */
export async function requirePlatformActor(
  allowedRoles: readonly PlatformRole[] = PLATFORM_READ_ROLES,
): Promise<PlatformActor> {
  const sessionActor = await getCurrentActor();
  const user = await prisma.user.findUnique({
    where: { id: sessionActor.userId },
    select: {
      id: true,
      companyId: true,
      platformRole: true,
      fullName: true,
      email: true,
      emailVerifiedAt: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("Your session is no longer valid.");
  }

  if (!user.emailVerifiedAt) {
    return denyPlatformAccess(
      "Platform access requires a verified email address.",
      "EMAIL_NOT_VERIFIED",
    );
  }

  if (!user.platformRole) {
    return denyPlatformAccess(
      "This account does not have platform access.",
      "PLATFORM_ROLE_REQUIRED",
    );
  }

  if (!allowedRoles.includes(user.platformRole)) {
    return denyPlatformAccess("Your platform role does not permit this action.");
  }

  return {
    userId: user.id,
    companyId: user.companyId,
    platformRole: user.platformRole,
    fullName: user.fullName,
    email: user.email,
  };
}

/** Convenience alias for call sites that want to state an explicit role gate. */
export async function requirePlatformRole(
  allowedRoles: readonly PlatformRole[],
): Promise<PlatformActor> {
  return requirePlatformActor(allowedRoles);
}

/**
 * Returns false only for expected authentication/authorization denial. A
 * database or programming error is deliberately allowed to surface.
 */
export async function isPlatformActor(): Promise<boolean> {
  try {
    await requirePlatformActor();
    return true;
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof PermissionDeniedError) {
      return false;
    }
    throw error;
  }
}

export function hasPlatformCapability(
  role: PlatformRole,
  capability: PlatformCapability,
): boolean {
  return PLATFORM_ROLE_CAPABILITIES[role].includes(capability);
}

export function requirePlatformCapability(
  actor: PlatformActor,
  capability: PlatformCapability,
): void {
  if (!hasPlatformCapability(actor.platformRole, capability)) {
    denyPlatformAccess(`Your platform role does not include the "${capability}" permission.`);
  }
}
