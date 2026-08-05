/**
 * Static, system-level templates for account verification and password
 * reset. Unlike proposal emails, these are not company-authored/customized
 * — every tenant gets the same wording — so they don't go through the
 * EmailTemplate/renderEmailTemplate machinery used for proposals.
 */

type AuthEmailContent = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapHtml(heading: string, bodyHtml: string, url: string): string {
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#020617;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #1e293b;border-radius:24px;padding:32px;">
            <tr>
              <td style="color:#64748b;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Quantara</td>
            </tr>
            <tr>
              <td style="color:#ffffff;font-size:22px;font-weight:600;padding-top:8px;">${escapeHtml(heading)}</td>
            </tr>
            <tr>
              <td style="color:#cbd5e1;font-size:14px;line-height:1.6;padding-top:16px;">${bodyHtml}</td>
            </tr>
            <tr>
              <td style="padding-top:24px;">
                <a href="${safeUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:16px;">Continue</a>
              </td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:12px;padding-top:20px;word-break:break-all;">${safeUrl}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildVerificationEmail(url: string): AuthEmailContent {
  return {
    subject: "Verify your Quantara account",
    html: wrapHtml(
      "Verify your Quantara account",
      "Confirm your email address to finish setting up your Quantara workspace. This link expires in 24 hours and can only be used once.",
      url,
    ),
    text:
      "Verify your Quantara account\n\n" +
      "Confirm your email address to finish setting up your Quantara workspace.\n" +
      "This link expires in 24 hours and can only be used once.\n\n" +
      `${url}\n`,
  };
}

export function buildPasswordResetEmail(url: string): AuthEmailContent {
  return {
    subject: "Reset your Quantara password",
    html: wrapHtml(
      "Reset your Quantara password",
      "We received a request to reset your Quantara password. This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email.",
      url,
    ),
    text:
      "Reset your Quantara password\n\n" +
      "We received a request to reset your Quantara password.\n" +
      "This link expires in 1 hour and can only be used once.\n" +
      "If you didn't request this, you can safely ignore this email.\n\n" +
      `${url}\n`,
  };
}
