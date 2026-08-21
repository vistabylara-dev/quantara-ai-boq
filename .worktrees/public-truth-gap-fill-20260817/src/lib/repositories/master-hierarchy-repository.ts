import type { MasterHierarchyNode, MasterHierarchyNodeType, MasterRegionScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";

/**
 * MASTER-BOQ-1A — repository for the new deep classification tree
 * (Industry -> Discipline -> System -> Category -> Subcategory -> Item
 * Family). Deliberately separate from master-taxonomy-repository.ts, which
 * remains the source of truth for the existing MasterDiscipline/MasterCategory
 * tables used by disciplineId/categoryId on MasterItem.
 */

export function toHierarchyNodeDTO(row: MasterHierarchyNode) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    nodeType: row.nodeType,
    parentId: row.parentId,
    regionScope: row.regionScope,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getHierarchyNode(id: string): Promise<MasterHierarchyNode> {
  const row = await prisma.masterHierarchyNode.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Hierarchy node not found.");
  return row;
}

export async function getHierarchyNodeByCode(code: string) {
  return prisma.masterHierarchyNode.findUnique({ where: { code } });
}

export async function listHierarchyNodes(includeInactive = false) {
  const rows = await prisma.masterHierarchyNode.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ nodeType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return rows;
}

/** Builds the full nested tree from a flat node list (bounded — this is taxonomy metadata, not catalogue item data). */
export async function getHierarchyTree(includeInactive = false) {
  const rows = await listHierarchyNodes(includeInactive);
  type TreeNode = ReturnType<typeof toHierarchyNodeDTO> & { children: TreeNode[] };
  const byId = new Map<string, TreeNode>();
  for (const row of rows) byId.set(row.id, { ...toHierarchyNodeDTO(row), children: [] });

  const roots: TreeNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    if (row.parentId) {
      const parent = byId.get(row.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Walks up the ancestor chain from candidateParentId; throws if nodeId would ever be its own ancestor. */
async function assertNoCycle(nodeId: string | null, candidateParentId: string | null): Promise<void> {
  if (!nodeId || !candidateParentId) return;
  if (nodeId === candidateParentId) {
    throw new ConflictError("HIERARCHY_CYCLE", "A hierarchy node cannot be its own parent.");
  }
  let currentId: string | null = candidateParentId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === nodeId) {
      throw new ConflictError("HIERARCHY_CYCLE", "This parent assignment would create a cycle in the hierarchy.");
    }
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const current: { parentId: string | null } | null = await prisma.masterHierarchyNode.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = current?.parentId ?? null;
  }
}

export type CreateHierarchyNodeInput = {
  code: string;
  name: string;
  description?: string;
  nodeType: MasterHierarchyNodeType;
  parentId?: string | null;
  regionScope?: MasterRegionScope | null;
  sortOrder?: number;
};

/** Idempotent on code — safe to call repeatedly from the backfill script or admin UI. */
export async function createHierarchyNode(input: CreateHierarchyNodeInput) {
  const existing = await prisma.masterHierarchyNode.findUnique({ where: { code: input.code } });
  if (existing) return toHierarchyNodeDTO(existing);

  if (input.parentId) {
    const parent = await prisma.masterHierarchyNode.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new NotFoundError("Parent hierarchy node not found.");
  }

  const created = await prisma.masterHierarchyNode.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? "",
      nodeType: input.nodeType,
      parentId: input.parentId ?? null,
      regionScope: input.regionScope ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return toHierarchyNodeDTO(created);
}

export type UpdateHierarchyNodeInput = {
  name?: string;
  description?: string;
  parentId?: string | null;
  regionScope?: MasterRegionScope | null;
  sortOrder?: number;
  isActive?: boolean;
};

export async function updateHierarchyNode(id: string, input: UpdateHierarchyNodeInput) {
  const existing = await getHierarchyNode(id);
  if (input.parentId !== undefined) {
    if (input.parentId) {
      const parent = await prisma.masterHierarchyNode.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundError("Parent hierarchy node not found.");
    }
    await assertNoCycle(existing.id, input.parentId ?? null);
  }

  const updated = await prisma.masterHierarchyNode.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      parentId: input.parentId,
      regionScope: input.regionScope,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
  });
  return toHierarchyNodeDTO(updated);
}

export async function setHierarchyNodeActive(id: string, isActive: boolean) {
  await getHierarchyNode(id);
  const updated = await prisma.masterHierarchyNode.update({ where: { id }, data: { isActive } });
  return toHierarchyNodeDTO(updated);
}

/** Ancestor chain from root to this node (breadcrumb), inclusive of the node itself. */
export async function getHierarchyAncestorChain(nodeId: string) {
  const chain: MasterHierarchyNode[] = [];
  let currentId: string | null = nodeId;
  const visited = new Set<string>();
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const node: MasterHierarchyNode | null = await prisma.masterHierarchyNode.findUnique({ where: { id: currentId } });
    if (!node) break;
    chain.unshift(node);
    currentId = node.parentId;
  }
  return chain.map(toHierarchyNodeDTO);
}

/** The node itself plus every descendant — used to make a filter on a SYSTEM/CATEGORY node also match items linked at a deeper level. */
export async function getDescendantNodeIds(nodeId: string): Promise<string[]> {
  const all = await prisma.masterHierarchyNode.findMany({ select: { id: true, parentId: true } });
  const childrenByParent = new Map<string, string[]>();
  for (const node of all) {
    if (!node.parentId) continue;
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node.id);
    childrenByParent.set(node.parentId, siblings);
  }

  const result: string[] = [nodeId];
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      result.push(childId);
      queue.push(childId);
    }
  }
  return result;
}

export async function assertActiveLeafForItem(hierarchyNodeId: string): Promise<void> {
  const node = await getHierarchyNode(hierarchyNodeId);
  if (!node.isActive) {
    throw new AppError("HIERARCHY_NODE_INACTIVE", "This hierarchy node is inactive and cannot receive new item associations.", 409);
  }
}
