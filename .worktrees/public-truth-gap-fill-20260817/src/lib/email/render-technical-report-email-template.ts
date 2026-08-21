/**
 * Email service 1B — a dedicated render module for technical-report emails, parallel to (but
 * intentionally not sharing a variable schema with) render-email-template.ts. BOQ/proposal emails
 * require grandTotal/currency/boqReference; a technical report has none of those and may be sent
 * either as an attachment (no link at all) or with a secure link, so secureReportUrl is optional
 * here rather than required. Keeping this as its own module means the existing proposal email
 * flow's required-variable list is never touched by this change.
 */
export type TechnicalReportEmailVariables = {
  clientName: string;
  clientCompany?: string;
  projectName: string;
  projectReference: string;
  companyName: string;
  companyPhone?: string;
  companyWebsite?: string;
  senderName: string;
  senderEmail: string;
  senderTitle?: string;
  reportReference: string;
  revision: string;
  issueDate: string;
  secureReportUrl?: string;
  sectionList?: string;
};

const REQUIRED_VARIABLE_KEYS: Array<keyof TechnicalReportEmailVariables> = [
  "clientName",
  "projectName",
  "companyName",
  "senderName",
  "senderEmail",
];

const ALLOWED_VARIABLE_KEYS: ReadonlySet<string> = new Set<keyof TechnicalReportEmailVariables>([
  "clientName",
  "clientCompany",
  "projectName",
  "projectReference",
  "companyName",
  "companyPhone",
  "companyWebsite",
  "senderName",
  "senderEmail",
  "senderTitle",
  "reportReference",
  "revision",
  "issueDate",
  "secureReportUrl",
  "sectionList",
]);

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export class TechnicalReportEmailTemplateValidationError extends Error {
  constructor(readonly missingVariables: string[]) {
    super(`Missing required technical report email template variable(s): ${missingVariables.join(", ")}`);
    this.name = "TechnicalReportEmailTemplateValidationError";
  }
}

export function validateTechnicalReportEmailVariables(variables: Partial<TechnicalReportEmailVariables>): void {
  const missing = REQUIRED_VARIABLE_KEYS.filter((key) => {
    const value = variables[key];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length > 0) {
    throw new TechnicalReportEmailTemplateValidationError(missing);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Pure `{{name}}` token replacement — same inert-token discipline as render-email-template.ts (no
 * eval, no Function constructor, no conditionals/loops/helpers). Unrecognized tokens are left
 * untouched as literal text rather than interpreted.
 */
function substitute(source: string, variables: Partial<TechnicalReportEmailVariables>, escapeValues: boolean): { rendered: string; unknownTokens: string[] } {
  const unknownTokens: string[] = [];
  const rendered = source.replace(TOKEN_PATTERN, (fullMatch, name: string) => {
    if (!ALLOWED_VARIABLE_KEYS.has(name)) {
      unknownTokens.push(name);
      return fullMatch;
    }
    const raw = variables[name as keyof TechnicalReportEmailVariables];
    const value = raw === undefined || raw === null ? "" : String(raw);
    return escapeValues ? escapeHtml(value) : value;
  });
  return { rendered, unknownTokens };
}

export type RenderTechnicalReportEmailTemplateInput = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: Partial<TechnicalReportEmailVariables>;
};

export type RenderedTechnicalReportEmail = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  unknownTokens: string[];
};

/** Throws TechnicalReportEmailTemplateValidationError if any required variable is missing/blank. */
export function renderTechnicalReportEmailTemplate(input: RenderTechnicalReportEmailTemplateInput): RenderedTechnicalReportEmail {
  validateTechnicalReportEmailVariables(input.variables);
  const subject = substitute(input.subject, input.variables, false);
  const bodyHtml = substitute(input.bodyHtml, input.variables, true);
  const bodyText = substitute(input.bodyText, input.variables, false);
  return {
    subject: subject.rendered,
    bodyHtml: bodyHtml.rendered,
    bodyText: bodyText.rendered,
    unknownTokens: [...new Set([...subject.unknownTokens, ...bodyHtml.unknownTokens, ...bodyText.unknownTokens])],
  };
}
