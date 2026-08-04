import { UserRole } from "@prisma/client";
import { PermissionDeniedError } from "@/lib/errors/app-error";
import type { CurrentActor } from "./current-actor";

/**
 * Capabilities gate mutating actions. Read access within a company is not
 * gated by capability — every authenticated member of a company can view
 * its projects, BOQs, catalogue, etc.; only the roles listed below may
 * change them. This is a pragmatic reading of the section 8 role
 * descriptions (which are stated at a coarse grain) mapped onto the actual
 * mutating routes in this codebase.
 */
export type Capability =
  | "company:manage"
  | "users:manage"
  | "projects:create"
  | "projects:update"
  | "projects:archive"
  | "boq:edit"
  | "boq:lock"
  | "verification:manage"
  | "catalogue:manage"
  | "suppliers:manage"
  | "suppliers:deactivate"
  | "clients:manage"
  | "templates:manage"
  | "proposals:manage"
  | "files:manage"
  | "review:comment"
  | "documents:generate"
  | "documents:generate:internal"
  | "documents:download"
  | "documents:delete"
  | "email-templates:manage"
  | "library:manage"
  | "imports:manage"
  | "entitlements:manage"
  | "report-templates:manage"
  | "technical-reports:generate"
  | "technical-reports:delete"
  | "technical-reports:send"
  | "integrations:connect"
  | "integrations:disconnect"
  | "integrations:sync";

const ALL_CAPABILITIES: Capability[] = [
  "company:manage",
  "users:manage",
  "projects:create",
  "projects:update",
  "projects:archive",
  "boq:edit",
  "boq:lock",
  "verification:manage",
  "catalogue:manage",
  "suppliers:manage",
  "suppliers:deactivate",
  "clients:manage",
  "templates:manage",
  "proposals:manage",
  "files:manage",
  "review:comment",
  "documents:generate",
  "documents:generate:internal",
  "documents:download",
  "documents:delete",
  "email-templates:manage",
  "library:manage",
  "imports:manage",
  "entitlements:manage",
  "report-templates:manage",
  "technical-reports:generate",
  "technical-reports:delete",
  "technical-reports:send",
  "integrations:connect",
  "integrations:disconnect",
  "integrations:sync",
];

const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  COMPANY_OWNER: ALL_CAPABILITIES,
  ADMINISTRATOR: [
    "company:manage",
    "users:manage",
    "projects:create",
    "projects:update",
    "projects:archive",
    "boq:edit",
    "boq:lock",
    "verification:manage",
    "catalogue:manage",
    "suppliers:manage",
    "suppliers:deactivate",
    "clients:manage",
    "templates:manage",
    "documents:generate",
    "documents:generate:internal",
    "documents:download",
    "documents:delete",
    "proposals:manage",
    "email-templates:manage",
    "library:manage",
    "imports:manage",
    "entitlements:manage",
    "report-templates:manage",
    "technical-reports:generate",
    "technical-reports:delete",
    "technical-reports:send",
    "integrations:connect",
    "integrations:disconnect",
    "integrations:sync",
  ],
  // "generate and download" (section 21): full generate access, no delete, no template management.
  // Phase 7 section 31: "search, add to BOQ, create and edit company items, import BOQ items".
  // Technical reports: can generate (fill in and produce a report for a project) but not manage the
  // template library itself — mirrors the documents:generate / templates:manage split above.
  QUANTITY_SURVEYOR: [
    "projects:create",
    "projects:update",
    "boq:edit",
    "boq:lock",
    "verification:manage",
    "documents:generate",
    "documents:generate:internal",
    "documents:download",
    "library:manage",
    "imports:manage",
    "technical-reports:generate",
    "technical-reports:send",
    "integrations:connect",
    "integrations:disconnect",
    "integrations:sync",
  ],
  // "generate internal and approved client outputs where allowed" (section 21): same generate
  // capability as QUANTITY_SURVEYOR — the "where allowed" nuance is the lock-required rule
  // enforced by document-generation-service, not a distinct RBAC capability.
  // Phase 7 section 31: "search, add to BOQ, edit commercial defaults, import rates".
  ESTIMATOR: [
    "projects:create",
    "projects:update",
    "boq:edit",
    "catalogue:manage",
    "suppliers:manage",
    "documents:generate",
    "documents:generate:internal",
    "documents:download",
    "library:manage",
    "imports:manage",
    "technical-reports:generate",
    "technical-reports:send",
    "integrations:connect",
    "integrations:disconnect",
    "integrations:sync",
  ],
  // Phase 7 section 31: "search, create technical items, edit technical specifications" — no import access.
  DESIGNER: ["files:manage", "review:comment", "library:manage"],
  // "download and generate client-facing outputs from approved revisions" (section 21): generate
  // access without the internal-audience capability, so INTERNAL-audience generation is blocked.
  // Phase 7 section 31: "read company library, use approved items where permitted" — no library:manage.
  SALES_USER: ["projects:create", "clients:manage", "proposals:manage", "documents:generate", "documents:download"],
  REVIEWER: ["review:comment", "verification:manage", "documents:download"],
};

export function hasCapability(role: UserRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function requireCapability(actor: CurrentActor, capability: Capability): void {
  if (!hasCapability(actor.role, capability)) {
    throw new PermissionDeniedError(
      `Your role (${actor.role}) does not include the "${capability}" permission.`,
    );
  }
}
