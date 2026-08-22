import { getCurrentActor } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  apiFailure,
  apiSuccess,
  handleApiError,
} from "@/lib/http/api-response";
import {
  bootstrapPlatformOwner,
  normalizePlatformOwnerEmail,
  PlatformOwnerBootstrapError,
} from "../../../../../scripts/bootstrap-platform-owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * TEMPORARY production recovery endpoint.
 *
 * Security:
 * - requires an existing authenticated Quantara session
 * - signed-in email must exactly match server-side PLATFORM_OWNER_EMAIL
 * - only runs in Vercel production
 * - bootstrapPlatformOwner refuses a second platform owner
 *
 * Remove immediately after successful recovery.
 */
export async function POST() {
  try {
    if (process.env.VERCEL_ENV !== "production") {
      throw new AppError(
        "PLATFORM_OWNER_RECOVERY_PRODUCTION_ONLY",
        "Platform owner recovery is available only in production.",
        403,
      );
    }

    const actor = await getCurrentActor();

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

    const result = await bootstrapPlatformOwner(
      prisma,
      configuredEmail,
    );

    return apiSuccess({
      recovered: true,
      roleChanged: result.changed,
    });
  } catch (error) {
    if (error instanceof PlatformOwnerBootstrapError) {
      return apiFailure(
        "PLATFORM_OWNER_RECOVERY_BLOCKED",
        error.message,
        409,
      );
    }

    return handleApiError(error);
  }
}
