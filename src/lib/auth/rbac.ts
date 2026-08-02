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
  | "clients:manage"
  | "templates:manage"
  | "proposals:manage"
  | "files:manage"
  | "review:comment";

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
  "clients:manage",
  "templates:manage",
  "proposals:manage",
  "files:manage",
  "review:comment",
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
    "clients:manage",
    "templates:manage",
  ],
  QUANTITY_SURVEYOR: ["projects:create", "projects:update", "boq:edit", "boq:lock", "verification:manage"],
  ESTIMATOR: ["projects:create", "projects:update", "boq:edit", "catalogue:manage"],
  DESIGNER: ["files:manage", "review:comment"],
  SALES_USER: ["projects:create", "clients:manage", "proposals:manage"],
  REVIEWER: ["review:comment", "verification:manage"],
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
