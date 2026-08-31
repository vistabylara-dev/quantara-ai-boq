import { getCurrentActor } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  apiFailure,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from "@/lib/http/api-response";
import {
  assertNotRateLimited,
  createInMemoryRateLimiter,
} from "@/lib/security/rate-limiter";
import { getRequestIp } from "@/lib/security/request-ip";
import { z } from "zod";
import {
  bootstrapPlatformOwner,
  normalizePlatformOwnerEmail,
  PlatformOwnerBootstrapError,
} from "../../../../../scripts/bootstrap-platform-owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const recoveryConfirmationSchema = z
  .object({
    confirm: z.literal("BOOTSTRAP_PLATFORM_OWNER"),
  })
  .strict();
// This is the repository-standard, process-local rate-limit layer. The
// serializable role-and-audit invariant in bootstrapPlatformOwner is the
// authoritative duplicate-mutation guard across Vercel instances.
const recoveryIpLimiter = createInMemoryRateLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
});
const recoveryUserLimiter = createInMemoryRateLimiter({
  max: 3,
  windowMs: 15 * 60 * 1000,
});

function assertSafeRecoveryRequest(request: Request): void {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      "The request must use application/json.",
      415,
    );
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new AppError(
      "INVALID_ORIGIN",
      "The request origin is not allowed.",
      403,
    );
  }
}

/**
 * TEMPORARY production recovery endpoint.
 *
 * Security:
 * - requires an existing active, verified Quantara session
 * - signed-in email must exactly match server-side PLATFORM_OWNER_EMAIL
 * - requires an explicit confirmation body and same-origin request
 * - is rate limited by request IP and authenticated user
 * - only runs in Vercel production
 * - bootstrapPlatformOwner refuses a second platform owner
 *
 * Remove immediately after successful recovery.
 */
export async function POST(request: Request) {
  try {
    if (process.env.VERCEL_ENV !== "production") {
      throw new AppError(
        "PLATFORM_OWNER_RECOVERY_PRODUCTION_ONLY",
        "Platform owner recovery is available only in production.",
        403,
      );
    }

    assertSafeRecoveryRequest(request);
    await parseJsonBody(request, recoveryConfirmationSchema);
    assertNotRateLimited(
      recoveryIpLimiter,
      `ip:${getRequestIp(request)}`,
    );

    const actor = await getCurrentActor();
    assertNotRateLimited(recoveryUserLimiter, `user:${actor.userId}`);

    let configuredEmail: string;

    try {
      configuredEmail = normalizePlatformOwnerEmail(
        process.env.PLATFORM_OWNER_EMAIL,
      );
    } catch (error) {
      if (error instanceof PlatformOwnerBootstrapError) {
        return apiFailure(
          "PLATFORM_OWNER_RECOVERY_NOT_CONFIGURED",
          "Platform owner recovery is not configured.",
          503,
        );
      }
      throw error;
    }

    if (actor.email.trim().toLowerCase() !== configuredEmail) {
      throw new AppError(
        "PLATFORM_OWNER_RECOVERY_EMAIL_MISMATCH",
        "This signed-in account is not the configured platform owner.",
        403,
      );
    }

    const account = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: {
        email: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    });

    if (!account || account.email.trim().toLowerCase() !== configuredEmail) {
      throw new AppError(
        "PLATFORM_OWNER_RECOVERY_ACCOUNT_MISMATCH",
        "The authenticated account is not eligible for platform owner recovery.",
        403,
      );
    }

    if (!account.isActive) {
      throw new AppError(
        "PLATFORM_OWNER_RECOVERY_ACCOUNT_INACTIVE",
        "The authenticated account is not active.",
        403,
      );
    }

    if (!account.emailVerifiedAt) {
      throw new AppError(
        "PLATFORM_OWNER_RECOVERY_EMAIL_UNVERIFIED",
        "The authenticated account email is not verified.",
        403,
      );
    }

    const result = await bootstrapPlatformOwner(prisma, configuredEmail, {
      auditSource: "trusted-runtime-recovery",
    });

    return apiSuccess({
      recovered: true,
      roleChanged: result.changed,
      status: result.changed ? "completed" : "already_completed",
    });
  } catch (error) {
    if (error instanceof PlatformOwnerBootstrapError) {
      return apiFailure(
        "PLATFORM_OWNER_RECOVERY_BLOCKED",
        "Platform owner recovery is blocked by the current account state.",
        409,
      );
    }

    return handleApiError(error);
  }
}
