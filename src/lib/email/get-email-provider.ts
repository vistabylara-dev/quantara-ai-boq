import type { EmailProvider } from "./email-provider";
import { developmentEmailProvider } from "./development-email-provider";
import { smtpEmailProvider } from "./smtp-email-provider";
import { applicationEnvironment } from "@/lib/runtime/application-environment";

/**
 * EMAIL-SAFETY-GUARD — logged once per server process lifetime (this module-level flag, not a
 * rate limiter) so real production email volume never floods logs with a repeated warning. Never
 * throws and never changes which provider is returned — visibility only.
 */
let hasLoggedProductionDevelopmentProviderWarning = false;

/** EMAIL_PROVIDER=smtp opts in to real delivery; anything else (including unset) stays in development mode. */
export function getEmailProvider(): EmailProvider {
  if (process.env.EMAIL_PROVIDER === "smtp") {
    return smtpEmailProvider;
  }

  if (!hasLoggedProductionDevelopmentProviderWarning && applicationEnvironment() === "production") {
    hasLoggedProductionDevelopmentProviderWarning = true;
    console.error(
      "[EMAIL-SAFETY] EMAIL_PROVIDER is not set to \"smtp\" in a PRODUCTION environment. All " +
        "verification, password-reset, and notification emails are being logged, not delivered. " +
        "Set EMAIL_PROVIDER=smtp with real SMTP_* credentials to fix this.",
    );
  }

  return developmentEmailProvider;
}
