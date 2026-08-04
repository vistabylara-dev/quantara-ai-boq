/**
 * Ready-to-use starter content for the two BOQ proposal email styles (attach-and-send /
 * automated-secure-link), installed into a company's own EmailTemplate table on request via
 * POST /api/email-templates/starter/boq. Once installed they are ordinary EmailTemplate rows —
 * fully editable, duplicable, and deactivatable through Settings > Email templates, same as any
 * template a company writes from scratch. Mirrors starter-technical-report-email-templates.ts.
 *
 * Wording adapted from a professional BOQ delivery email brief into this codebase's `{{token}}`
 * merge-field syntax (see render-email-template.ts for the allowed variable list — this is the
 * same renderer/variable set the existing proposal send flow already uses).
 */

function wrapHtml(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:36px;">
            ${bodyHtml}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type StarterEmailTemplateDefinition = {
  code: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

const MANUAL_BODY_HTML = wrapHtml(`
            <tr><td style="color:#0f172a;font-size:15px;line-height:1.7;">
              <p>Dear {{clientName}},</p>
              <p>I hope you are doing well.</p>
              <p>Please find attached the Bill of Quantities (BOQ) for the <strong>{{projectName}}</strong>, prepared based on the drawings, specifications, and information provided.</p>
              <p>The attached BOQ includes:</p>
              <ul style="margin:0 0 16px;padding-left:20px;">
                <li>Item descriptions</li>
                <li>Units of measurement</li>
                <li>Estimated quantities</li>
                <li>Material and work classifications</li>
                <li>Technical specification placeholders (where applicable)</li>
              </ul>
              <p>Please note:</p>
              <ul style="margin:0 0 16px;padding-left:20px;">
                <li>Quantities are based on the latest available drawings and may require adjustment if revised drawings or specifications are issued.</li>
                <li>Final material specifications, brands, and technical requirements should be confirmed before procurement.</li>
                <li>Any additional works, variations, or design changes may affect the final quantities and pricing.</li>
              </ul>
              <p>We kindly request that you review the attached BOQ and let us know if any revisions or clarifications are required.</p>
              <p>Should you need a quotation based on this BOQ, we would be pleased to prepare a detailed commercial proposal.</p>
              <p>Thank you for your time, and we look forward to working with you.</p>
              <p style="margin-top:24px;">
                Kind regards,<br/>
                {{senderName}}<br/>
                {{senderTitle}}<br/>
                {{companyName}}<br/>
                Phone: {{companyPhone}}<br/>
                Email: {{senderEmail}}<br/>
                Website: {{companyWebsite}}
              </p>
            </td></tr>`);

const MANUAL_BODY_TEXT = `Dear {{clientName}},

I hope you are doing well.

Please find attached the Bill of Quantities (BOQ) for the {{projectName}}, prepared based on the drawings, specifications, and information provided.

The attached BOQ includes:
- Item descriptions
- Units of measurement
- Estimated quantities
- Material and work classifications
- Technical specification placeholders (where applicable)

Please note:
- Quantities are based on the latest available drawings and may require adjustment if revised drawings or specifications are issued.
- Final material specifications, brands, and technical requirements should be confirmed before procurement.
- Any additional works, variations, or design changes may affect the final quantities and pricing.

We kindly request that you review the attached BOQ and let us know if any revisions or clarifications are required.

Should you need a quotation based on this BOQ, we would be pleased to prepare a detailed commercial proposal.

Thank you for your time, and we look forward to working with you.

Kind regards,
{{senderName}}
{{senderTitle}}
{{companyName}}
Phone: {{companyPhone}}
Email: {{senderEmail}}
Website: {{companyWebsite}}
`;

const AUTOMATED_BODY_HTML = wrapHtml(`
            <tr><td style="color:#0f172a;font-size:15px;line-height:1.7;">
              <p>Dear {{clientName}},</p>
              <p>Your requested Bill of Quantities (BOQ) has been successfully generated and is ready for review.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;color:#334155;font-size:14px;">
                <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Project:</td><td>{{projectName}}</td></tr>
                <tr><td style="padding:2px 12px 2px 0;font-weight:600;">BOQ Reference:</td><td>{{boqReference}}</td></tr>
                <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Revision:</td><td>{{revision}}</td></tr>
              </table>
              <p>You can access your documents using the link below:</p>
              <p style="margin:20px 0;">
                <a href="{{secureReviewUrl}}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">View &amp; Download BOQ</a>
              </p>
              <p style="color:#64748b;font-size:12px;word-break:break-all;">{{secureReviewUrl}}</p>
              <p>Included in your package:</p>
              <ul style="margin:0 0 16px;padding-left:20px;">
                <li>Detailed BOQ</li>
                <li>Material schedule</li>
                <li>Quantity breakdown</li>
                <li>Trade categorization</li>
                <li>Revision history (if applicable)</li>
              </ul>
              <p>If you have updated drawings or would like us to generate a revised BOQ, simply upload the latest files through your project portal.</p>
              <p>Thank you for choosing {{companyName}}.</p>
              <p style="margin-top:24px;">
                Best regards,<br/>
                {{companyName}}<br/>
                {{companyWebsite}} | {{senderEmail}} | {{companyPhone}}
              </p>
            </td></tr>`);

const AUTOMATED_BODY_TEXT = `Dear {{clientName}},

Your requested Bill of Quantities (BOQ) has been successfully generated and is ready for review.

Project: {{projectName}}
BOQ Reference: {{boqReference}}
Revision: {{revision}}

You can access your documents using the link below:

View & Download BOQ:
{{secureReviewUrl}}

Included in your package:
- Detailed BOQ
- Material schedule
- Quantity breakdown
- Trade categorization
- Revision history (if applicable)

If you have updated drawings or would like us to generate a revised BOQ, simply upload the latest files through your project portal.

Thank you for choosing {{companyName}}.

Best regards,
{{companyName}}
{{companyWebsite}} | {{senderEmail}} | {{companyPhone}}
`;

export const BOQ_STARTER_EMAIL_TEMPLATES: StarterEmailTemplateDefinition[] = [
  {
    code: "boq-proposal-manual",
    name: "BOQ Proposal — Attached",
    subject: "Bill of Quantities (BOQ) Submission – {{projectName}}",
    bodyHtml: MANUAL_BODY_HTML,
    bodyText: MANUAL_BODY_TEXT,
  },
  {
    code: "boq-proposal-automated",
    name: "BOQ Proposal — Secure Link (Ready)",
    subject: "Your BOQ is Ready – {{projectName}}",
    bodyHtml: AUTOMATED_BODY_HTML,
    bodyText: AUTOMATED_BODY_TEXT,
  },
];
