import { randomUUID } from "node:crypto";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./email-provider";

/**
 * No network call is ever made. This must never be mistaken for real
 * delivery — status is always DEVELOPMENT_CAPTURED, never SENT, so callers
 * (and the UI) can never conflate a captured preview with a real dispatch.
 * Mirrors the existing dev-mailer.ts console-log convention used for
 * verification/reset emails.
 */
export const developmentEmailProvider: EmailProvider = {
  providerName: "development",

  validateConfiguration() {
    return { valid: true, errors: [] };
  },

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    console.log(
      `\n[DEV EMAIL - NOT SENT] ${input.subject}\n  To: ${input.to}\n` +
        (input.cc?.length ? `  Cc: ${input.cc.join(", ")}\n` : "") +
        `  (development provider — no real delivery attempted)\n\n${input.text}\n`,
    );
    return {
      status: "DEVELOPMENT_CAPTURED",
      providerMessageId: `dev-${randomUUID()}`,
    };
  },
};
