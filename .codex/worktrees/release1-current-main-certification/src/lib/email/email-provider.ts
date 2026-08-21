export type SendEmailInput = {
  to: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailStatus = "SENT" | "DEVELOPMENT_CAPTURED" | "FAILED";

export type SendEmailResult = {
  status: SendEmailStatus;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type EmailConfigurationCheck = {
  valid: boolean;
  errors: string[];
};

/**
 * Providers are pure: they never touch the database. The caller (email
 * service) creates/updates the EmailDispatch row using this result — that
 * keeps "did we successfully hand this to a transport" (provider concern)
 * separate from "what did we record happened" (service/persistence concern).
 */
export type EmailProvider = {
  readonly providerName: string;
  validateConfiguration(): EmailConfigurationCheck;
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
};
