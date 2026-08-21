import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { PermissionDeniedError } from "@/lib/errors/app-error";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import {
  createHierarchyNode,
  getHierarchyAncestorChain,
  getHierarchyTree,
  setHierarchyNodeActive as setHierarchyNodeActiveRepo,
  updateHierarchyNode,
  type CreateHierarchyNodeInput,
  type UpdateHierarchyNodeInput,
} from "@/lib/repositories/master-hierarchy-repository";

/**
 * MASTER-BOQ-1A — hierarchy tree is taxonomy metadata (Industry/Discipline/
 * System/Category/Subcategory/Item Family names and codes), not proprietary
 * catalogue data, so any authenticated user can browse the active tree to
 * build filters. Only the platform owner may create/edit/deactivate nodes.
 */

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Master hierarchy administration is restricted to the platform owner.");
  }
}

/** Authenticated (non-owner) callers only ever see active nodes. */
export async function getPublicHierarchyTree() {
  return getHierarchyTree(false);
}

export async function getAdminHierarchyTree(owner: PlatformActor) {
  requireOwner(owner);
  return getHierarchyTree(true);
}

export async function getItemHierarchyBreadcrumb(hierarchyNodeId: string) {
  return getHierarchyAncestorChain(hierarchyNodeId);
}

export async function createOrUpdateHierarchyNode(owner: PlatformActor, input: CreateHierarchyNodeInput) {
  requireOwner(owner);
  const node = await createHierarchyNode(input);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_HIERARCHY_NODE_CREATED",
    targetType: "MasterHierarchyNode",
    targetId: node.id,
    metadata: { code: node.code, nodeType: node.nodeType, parentId: node.parentId },
  });
  return node;
}

export async function updateHierarchyNodeAsOwner(owner: PlatformActor, id: string, input: UpdateHierarchyNodeInput) {
  requireOwner(owner);
  const node = await updateHierarchyNode(id, input);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_HIERARCHY_NODE_UPDATED",
    targetType: "MasterHierarchyNode",
    targetId: node.id,
    metadata: { code: node.code },
  });
  return node;
}

export async function setHierarchyNodeActive(owner: PlatformActor, id: string, isActive: boolean) {
  requireOwner(owner);
  const node = await setHierarchyNodeActiveRepo(id, isActive);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: isActive ? "MASTER_HIERARCHY_NODE_ACTIVATED" : "MASTER_HIERARCHY_NODE_DEACTIVATED",
    targetType: "MasterHierarchyNode",
    targetId: node.id,
    metadata: { code: node.code },
  });
  return node;
}
