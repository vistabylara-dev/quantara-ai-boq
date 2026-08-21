/**
 * Email service 1B — ready-to-use starter content for the two technical-report email styles
 * (attach-and-send / automated-secure-link), installed into a company's own EmailTemplate table
 * on request via POST /api/email-templates/starter/technical-report. Once installed they are
 * ordinary EmailTemplate rows: fully editable, duplicable, and deactivatable through the existing
 * Settings > Email Templates UI, exactly like a company's BOQ proposal templates.
 *
 * Wording is adapted from a professional technical-report email brief (consultant-style — matches
 * the tone used by AECOM/WSP/Jacobs/Arup-style engineering firms) into this codebase's `{{token}}`
 * merge-field syntax (see render-technical-report-email-template.ts for the allowed variable list).
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
              <p>I hope this email finds you well.</p>
              <p>Please find attached the Technical Assessment Report for <strong>{{projectName}}</strong>, prepared following our engineering review of the available drawings, specifications, and project information.</p>
              <p>The report includes:</p>
              <ul style="margin:0 0 16px;padding-left:20px;">
                <li>Executive summary</li>
                <li>Scope of assessment</li>
                <li>Technical observations</li>
                <li>Identified issues and potential risks</li>
                <li>Engineering recommendations</li>
                <li>Compliance review (where applicable)</li>
                <li>Supporting drawings and references</li>
                <li>Conclusion and recommended next steps</li>
              </ul>
              <p>Please note that this report is based on the documentation and information available at the time of assessment. Any revisions to the design, specifications, site conditions, or applicable standards may require an updated technical review.</p>
              <p>We kindly invite you to review the attached report and share any comments or questions. Should you require further clarification, design optimization, value engineering, or implementation support, our engineering team will be pleased to assist.</p>
              <p>Thank you for the opportunity to support your project. We look forward to your feedback.</p>
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

I hope this email finds you well.

Please find attached the Technical Assessment Report for {{projectName}}, prepared following our engineering review of the available drawings, specifications, and project information.

The report includes:
- Executive summary
- Scope of assessment
- Technical observations
- Identified issues and potential risks
- Engineering recommendations
- Compliance review (where applicable)
- Supporting drawings and references
- Conclusion and recommended next steps

Please note that this report is based on the documentation and information available at the time of assessment. Any revisions to the design, specifications, site conditions, or applicable standards may require an updated technical review.

We kindly invite you to review the attached report and share any comments or questions. Should you require further clarification, design optimization, value engineering, or implementation support, our engineering team will be pleased to assist.

Thank you for the opportunity to support your project. We look forward to your feedback.

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
              <p>Your Technical Assessment Report has been successfully completed and is now available.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;color:#334155;font-size:14px;">
                <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Project:</td><td>{{projectName}}</td></tr>
                <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Report Reference:</td><td>{{reportReference}}</td></tr>
                <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Revision:</td><td>{{revision}}</td></tr>
                <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Issue Date:</td><td>{{issueDate}}</td></tr>
              </table>
              <p>You can securely access your report using the link below:</p>
              <p style="margin:20px 0;">
                <a href="{{secureReportUrl}}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">View &amp; Download Technical Report</a>
              </p>
              <p style="color:#64748b;font-size:12px;word-break:break-all;">{{secureReportUrl}}</p>
              <p>The report includes:</p>
              <ul style="margin:0 0 16px;padding-left:20px;">
                <li>Executive Summary</li>
                <li>Engineering Analysis</li>
                <li>Technical Findings</li>
                <li>Compliance Review</li>
                <li>Risk Assessment</li>
                <li>Recommendations</li>
                <li>Supporting Documents</li>
              </ul>
              <p>If updated drawings or project information become available, you may upload them through your project portal to generate a revised report.</p>
              <p>Thank you for choosing {{companyName}}. We appreciate the opportunity to support your project.</p>
              <p style="margin-top:24px;">
                Best regards,<br/>
                {{companyName}}<br/>
                {{companyWebsite}} | {{senderEmail}} | {{companyPhone}}
              </p>
            </td></tr>`);

const AUTOMATED_BODY_TEXT = `Dear {{clientName}},

Your Technical Assessment Report has been successfully completed and is now available.

Project: {{projectName}}
Report Reference: {{reportReference}}
Revision: {{revision}}
Issue Date: {{issueDate}}

You can securely access your report using the link below:

View & Download Technical Report
{{secureReportUrl}}

The report includes:
- Executive Summary
- Engineering Analysis
- Technical Findings
- Compliance Review
- Risk Assessment
- Recommendations
- Supporting Documents

If updated drawings or project information become available, you may upload them through your project portal to generate a revised report.

Thank you for choosing {{companyName}}. We appreciate the opportunity to support your project.

Best regards,
{{companyName}}
{{companyWebsite}} | {{senderEmail}} | {{companyPhone}}
`;

export const TECHNICAL_REPORT_STARTER_EMAIL_TEMPLATES: StarterEmailTemplateDefinition[] = [
  {
    code: "technical-report-manual",
    name: "Technical Report — Attached",
    subject: "Technical Assessment Report – {{projectName}}",
    bodyHtml: MANUAL_BODY_HTML,
    bodyText: MANUAL_BODY_TEXT,
  },
  {
    code: "technical-report-automated",
    name: "Technical Report — Secure Link (Ready)",
    subject: "Your Technical Report is Ready – {{projectName}}",
    bodyHtml: AUTOMATED_BODY_HTML,
    bodyText: AUTOMATED_BODY_TEXT,
  },
];
