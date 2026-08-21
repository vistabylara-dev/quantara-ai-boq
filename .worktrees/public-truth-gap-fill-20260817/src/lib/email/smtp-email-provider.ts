import nodemailer, { type Transporter } from "nodemailer";
import type { EmailConfigurationCheck, EmailProvider, SendEmailInput, SendEmailResult } from "./email-provider";

function readSmtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    fromEmail: process.env.SMTP_FROM_EMAIL,
    fromName: process.env.SMTP_FROM_NAME,
  };
}

/** Never logs or returns SMTP_PASSWORD — only pass/fail per field. */
function validateSmtpConfiguration(): EmailConfigurationCheck {
  const config = readSmtpConfig();
  const errors: string[] = [];
  if (!config.host) errors.push("SMTP_HOST is not set.");
  if (!config.port || Number.isNaN(Number(config.port))) errors.push("SMTP_PORT is not set or invalid.");
  if (!config.user) errors.push("SMTP_USER is not set.");
  if (!config.password) errors.push("SMTP_PASSWORD is not set.");
  if (!config.fromEmail) errors.push("SMTP_FROM_EMAIL is not set.");
  return { valid: errors.length === 0, errors };
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  const config = readSmtpConfig();
  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port),
    secure: config.secure === "true",
    auth: { user: config.user, pass: config.password },
  });
  return cachedTransporter;
}

export const smtpEmailProvider: EmailProvider = {
  providerName: "smtp",

  validateConfiguration: validateSmtpConfiguration,

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const check = validateSmtpConfiguration();
    if (!check.valid) {
      return { status: "FAILED", errorCode: "SMTP_NOT_CONFIGURED", errorMessage: check.errors.join(" ") };
    }
    const config = readSmtpConfig();
    try {
      const info = await getTransporter().sendMail({
        from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        replyTo: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { status: "SENT", providerMessageId: info.messageId };
    } catch (error) {
      // Never surface the raw error (which can include connection strings /
      // auth details) — a short, safe summary only.
      const message = error instanceof Error ? error.message : "SMTP send failed.";
      return { status: "FAILED", errorCode: "SMTP_SEND_FAILED", errorMessage: message.slice(0, 300) };
    }
  },
};
