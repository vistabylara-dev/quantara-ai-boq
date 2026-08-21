import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { PermissionDeniedError } from "@/lib/errors/app-error";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import {
  addStandardApplicability,
  createStandardAuthority,
  listApplicabilitiesForItem,
  listStandardAuthorities,
  type AddStandardApplicabilityInput,
} from "@/lib/repositories/standards-repository";

/**
 * MASTER-SCALE-1A — standards/authority lookup is read-freely by any
 * authenticated user (it's a reference list, not proprietary catalogue
 * data — the same reasoning already applied to the hierarchy tree in
 * MASTER-BOQ-1A). Only the owner may create authorities or assert an item's
 * standard applicability.
 */

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Standards administration is restricted to the platform owner.");
  }
}

export async function listStandardAuthoritiesPublic() {
  return listStandardAuthorities();
}

export async function createStandardAuthorityAsOwner(owner: PlatformActor, input: { name: string; country?: string; website?: string }) {
  requireOwner(owner);
  const authority = await createStandardAuthority(input);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "STANDARD_AUTHORITY_CREATED",
    targetType: "StandardAuthority",
    targetId: authority.id,
    metadata: { name: input.name },
  });
  return authority;
}

export async function addStandardApplicabilityAsOwner(owner: PlatformActor, input: AddStandardApplicabilityInput) {
  requireOwner(owner);
  const applicability = await addStandardApplicability(input);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_ITEM_STANDARD_APPLICABILITY_SET",
    targetType: "MasterItem",
    targetId: input.masterItemId,
    metadata: { standardAuthorityId: input.standardAuthorityId, applicabilityType: input.applicabilityType ?? "ADVISORY" },
  });
  return applicability;
}

export async function listApplicabilitiesForItemAsOwner(owner: PlatformActor, masterItemId: string) {
  requireOwner(owner);
  return listApplicabilitiesForItem(masterItemId);
}
