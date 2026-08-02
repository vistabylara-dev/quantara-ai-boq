import type { MasterCategory, MasterDiscipline, TechnicalFieldDefinition } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";

function toDisciplineDTO(row: MasterDiscipline) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    icon: row.icon,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export async function listDisciplines(includeInactive = false) {
  const rows = await prisma.masterDiscipline.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(toDisciplineDTO);
}

export async function getDisciplineByKey(key: string) {
  const row = await prisma.masterDiscipline.findUnique({ where: { key } });
  if (!row) throw new NotFoundError("Discipline not found.");
  return toDisciplineDTO(row);
}

export async function createDiscipline(input: { key: string; name: string; description?: string; icon?: string; sortOrder?: number }) {
  const existing = await prisma.masterDiscipline.findUnique({ where: { key: input.key } });
  if (existing) return toDisciplineDTO(existing);
  const created = await prisma.masterDiscipline.create({
    data: { key: input.key, name: input.name, description: input.description ?? "", icon: input.icon, sortOrder: input.sortOrder ?? 0 },
  });
  return toDisciplineDTO(created);
}

function toCategoryDTO(row: MasterCategory) {
  return {
    id: row.id,
    disciplineId: row.disciplineId,
    parentCategoryId: row.parentCategoryId,
    key: row.key,
    name: row.name,
    description: row.description,
    path: row.path,
    depth: row.depth,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export async function listCategories(disciplineId: string, parentCategoryId?: string | null) {
  const rows = await prisma.masterCategory.findMany({
    where: { disciplineId, parentCategoryId: parentCategoryId === undefined ? undefined : parentCategoryId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(toCategoryDTO);
}

export async function getCategoryTree(disciplineId: string) {
  const rows = await prisma.masterCategory.findMany({
    where: { disciplineId, isActive: true },
    orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  type TreeNode = ReturnType<typeof toCategoryDTO> & { children: TreeNode[] };
  const byId = new Map<string, TreeNode>();
  for (const row of rows) byId.set(row.id, { ...toCategoryDTO(row), children: [] });

  const roots: TreeNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    if (row.parentCategoryId) {
      const parent = byId.get(row.parentCategoryId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function getCategory(categoryId: string) {
  const row = await prisma.masterCategory.findUnique({ where: { id: categoryId } });
  if (!row) throw new NotFoundError("Category not found.");
  return toCategoryDTO(row);
}

/** Seed-time only: computes path/depth and prevents circular parent relationships and duplicate sibling keys. */
export async function createCategory(input: {
  disciplineId: string;
  parentCategoryId?: string | null;
  key: string;
  name: string;
  description?: string;
  sortOrder?: number;
}) {
  let parent: MasterCategory | null = null;
  if (input.parentCategoryId) {
    parent = await prisma.masterCategory.findUnique({ where: { id: input.parentCategoryId } });
    if (!parent) throw new NotFoundError("Parent category not found.");
    if (parent.disciplineId !== input.disciplineId) {
      throw new ConflictError("CATEGORY_DISCIPLINE_MISMATCH", "A category's parent must belong to the same discipline.");
    }
  }

  const sibling = await prisma.masterCategory.findFirst({
    where: { disciplineId: input.disciplineId, parentCategoryId: input.parentCategoryId ?? null, key: input.key },
  });
  if (sibling) return toCategoryDTO(sibling);

  const depth = parent ? parent.depth + 1 : 0;
  const path = parent ? `${parent.path}/${input.key}` : input.key;

  const created = await prisma.masterCategory.create({
    data: {
      disciplineId: input.disciplineId,
      parentCategoryId: input.parentCategoryId ?? null,
      key: input.key,
      name: input.name,
      description: input.description ?? "",
      path,
      depth,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return toCategoryDTO(created);
}

function toFieldDefinitionDTO(row: TechnicalFieldDefinition) {
  return {
    id: row.id,
    disciplineId: row.disciplineId,
    categoryId: row.categoryId,
    key: row.key,
    label: row.label,
    description: row.description,
    fieldType: row.fieldType,
    unit: row.unit,
    optionsJson: row.optionsJson,
    validationJson: row.validationJson,
    isRequired: row.isRequired,
    isSearchable: row.isSearchable,
    isFilterable: row.isFilterable,
    sortOrder: row.sortOrder,
  };
}

/** Discipline-wide fields (categoryId null) plus fields specific to this category. */
export async function listTechnicalFieldDefinitions(disciplineId: string, categoryId?: string | null) {
  const rows = await prisma.technicalFieldDefinition.findMany({
    where: { disciplineId, OR: [{ categoryId: null }, ...(categoryId ? [{ categoryId }] : [])] },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map(toFieldDefinitionDTO);
}

export async function createTechnicalFieldDefinition(input: {
  disciplineId: string;
  categoryId?: string | null;
  key: string;
  label: string;
  description?: string;
  fieldType: TechnicalFieldDefinition["fieldType"];
  unit?: string;
  optionsJson?: unknown;
  validationJson?: unknown;
  isRequired?: boolean;
  isSearchable?: boolean;
  isFilterable?: boolean;
  sortOrder?: number;
}) {
  const existing = await prisma.technicalFieldDefinition.findFirst({
    where: { disciplineId: input.disciplineId, categoryId: input.categoryId ?? null, key: input.key },
  });
  if (existing) return toFieldDefinitionDTO(existing);

  const created = await prisma.technicalFieldDefinition.create({
    data: {
      disciplineId: input.disciplineId,
      categoryId: input.categoryId ?? null,
      key: input.key,
      label: input.label,
      description: input.description ?? "",
      fieldType: input.fieldType,
      unit: input.unit,
      optionsJson: input.optionsJson as never,
      validationJson: input.validationJson as never,
      isRequired: input.isRequired ?? false,
      isSearchable: input.isSearchable ?? false,
      isFilterable: input.isFilterable ?? false,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return toFieldDefinitionDTO(created);
}
