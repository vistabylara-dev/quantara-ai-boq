import type { EmailProvider } from "./email-provider";
import { developmentEmailProvider } from "./development-email-provider";
import { smtpEmailProvider } from "./smtp-email-provider";

/** EMAIL_PROVIDER=smtp opts in to real delivery; anything else (including unset) stays in development mode. */
export function getEmailProvider(): EmailProvider {
  return process.env.EMAIL_PROVIDER === "smtp" ? smtpEmailProvider : developmentEmailProvider;
}
