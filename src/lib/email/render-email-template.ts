export type EmailTemplateVariables = {
  clientName: string;
  clientCompany?: string;
  projectName: string;
  projectReference: string;
  boqReference: string;
  revision: string;
  proposalValidityDate: string;
  companyName: string;
  senderName: string;
  senderEmail: string;
  secureReviewUrl: string;
  documentList?: string;
  grandTotal: string;
  currency: string;
};

const REQUIRED_VARIABLE_KEYS: Array<keyof EmailTemplateVariables> = [
  "clientName",
  "projectName",
  "projectReference",
  "boqReference",
  "revision",
  "proposalValidityDate",
  "companyName",
  "senderName",
  "senderEmail",
  "secureReviewUrl",
  "grandTotal",
  "currency",
];

const ALLOWED_VARIABLE_KEYS: ReadonlySet<string> = new Set<keyof EmailTemplateVariables>([
  "clientName",
  "clientCompany",
  "projectName",
  "projectReference",
  "boqReference",
  "revision",
  "proposalValidityDate",
  "companyName",
  "senderName",
  "senderEmail",
  "secureReviewUrl",
  "documentList",
  "grandTotal",
  "currency",
]);

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export class EmailTemplateValidationError extends Error {
  constructor(readonly missingVariables: string[]) {
    super(`Missing required email template variable(s): ${missingVariables.join(", ")}`);
    this.name = "EmailTemplateValidationError";
  }
}

export function validateEmailTemplateVariables(variables: Partial<EmailTemplateVariables>): void {
  const missing = REQUIRED_VARIABLE_KEYS.filter((key) => {
    const value = variables[key];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length > 0) {
    throw new EmailTemplateValidationError(missing);
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
 * Pure `{{name}}` token replacement — never eval, never a Function
 * constructor, never a scripting/templating engine with conditionals,
 * loops, or helper invocation. There is structurally no way for template
 * content to execute code: unrecognized tokens are left untouched as
 * inert literal text (visible in a preview, harmless), never interpreted.
 * The *template's own* HTML is authored by a trusted internal user and is
 * emitted as-is; only the *substituted variable values* are HTML-escaped,
 * matching how every mainstream ESP merge-tag system behaves.
 */
function substitute(source: string, variables: Partial<EmailTemplateVariables>, escapeValues: boolean): { rendered: string; unknownTokens: string[] } {
  const unknownTokens: string[] = [];
  const rendered = source.replace(TOKEN_PATTERN, (fullMatch, name: string) => {
    if (!ALLOWED_VARIABLE_KEYS.has(name)) {
      unknownTokens.push(name);
      return fullMatch;
    }
    const raw = variables[name as keyof EmailTemplateVariables];
    const value = raw === undefined || raw === null ? "" : String(raw);
    return escapeValues ? escapeHtml(value) : value;
  });
  return { rendered, unknownTokens };
}

export type RenderEmailTemplateInput = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: Partial<EmailTemplateVariables>;
};

export type RenderedEmail = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  unknownTokens: string[];
};

/** Throws EmailTemplateValidationError if any required variable is missing/blank. */
export function renderEmailTemplate(input: RenderEmailTemplateInput): RenderedEmail {
  validateEmailTemplateVariables(input.variables);
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
