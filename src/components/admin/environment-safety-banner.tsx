import { AlertTriangle } from "lucide-react";
import type { getPlatformEnvironmentBanner } from "@/lib/services/platform-admin-service";

export type EnvironmentSafetyBannerProps = ReturnType<typeof getPlatformEnvironmentBanner>;

/**
 * EMAIL-SAFETY-GUARD — persistent, always-on-top banner visible on every
 * admin page (wired into the (protected) layout above {children}), not just
 * the dashboard tab's StatusPill/HealthRow. Renders nothing — not a hidden
 * element — in every state except production+development, matching
 * admin-dashboard.tsx's existing warning-tone palette so this reads as the
 * same visual system, not a second one.
 */
export function EnvironmentSafetyBanner({ applicationEnvironment, emailProvider }: EnvironmentSafetyBannerProps) {
  if (applicationEnvironment !== "production" || emailProvider !== "development") {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-[#D98A16]/30 bg-[#D98A16]/10 px-4 py-2.5 text-sm text-[#8A5A0F] dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 sm:px-6"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">Emails are not being delivered.</span>{" "}
        This is a production environment, but EMAIL_PROVIDER is not set to &quot;smtp&quot; — verification, password-reset,
        and notification emails are only being logged, not sent.
      </p>
    </div>
  );
}

export default EnvironmentSafetyBanner;
