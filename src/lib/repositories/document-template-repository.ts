import { DocumentTemplateType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import {
  mergeContentConfig,
  mergeStyleConfig,
  type DocumentTemplateContentConfig,
  type DocumentTemplateStyleConfig,
  type PartialDocumentTemplateContentConfig,
} from "@/lib/documents/template-config";

export type DocumentTemplateWriteInput = {
  industryEngineId?: string | null;
  name: string;
  code: string;
  type: DocumentTemplateType;
  description?: string;
  styleConfig?: Partial<DocumentTemplateStyleConfig>;
  contentConfig?: PartialDocumentTemplateContentConfig;
  isActive?: boolean;
};

export type DocumentTemplateListFilters = {
  industryEngineId?: string;
  type?: DocumentTemplateType;
  includeInactive?: boolean;
};

const templateInclude = { industryEngine: true } satisfies Prisma.DocumentTemplateInclude;
type TemplateRecord = Prisma.DocumentTemplateGetPayload<{ include: typeof templateInclude }>;

export function toTemplateDTO(row: TemplateRecord) {
  return {
    id: row.id,
    companyId: row.companyId,
    industryEngineId: row.industryEngineId,
    industryKey: row.industryEngine?.key ?? null,
    industryName: row.industryEngine?.name ?? null,
    name: row.name,
    code: row.code,
    type: row.type,
    description: row.description,
    styleConfig: mergeStyleConfig(row.styleConfigJson as Partial<DocumentTemplateStyleConfig> | null),
    contentConfig: mergeContentConfig(row.contentConfigJson as Partial<DocumentTemplateContentConfig> | null),
    isDefault: row.isDefault,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getTemplateRecord(companyId: string, templateId: string): Promise<TemplateRecord> {
  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, companyId },
    include: templateInclude,
  });
  if (!template) throw new NotFoundError("Document template not found.");
  return template;
}

export async function getTemplate(companyId: string, templateId: string) {
  return toTemplateDTO(await getTemplateRecord(companyId, templateId));
}

export async function listTemplates(companyId: string, filters: DocumentTemplateListFilters = {}) {
  const templates = await prisma.documentTemplate.findMany({
    where: {
      companyId,
      ...(filters.includeInactive ? {} : { isActive: true }),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.industryEngineId ? { OR: [{ industryEngineId: filters.industryEngineId }, { industryEngineId: null }] } : {}),
    },
    include: templateInclude,
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return templates.map(toTemplateDTO);
}

export async function createTemplate(companyId: string, input: DocumentTemplateWriteInput) {
  const existing = await prisma.documentTemplate.findFirst({ where: { companyId, code: input.code } });
  if (existing) throw new ConflictError("TEMPLATE_CODE_EXISTS", "A template with this code already exists.");

  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.documentTemplate.create({
      data: {
        companyId,
        industryEngineId: input.industryEngineId ?? null,
        name: input.name,
        code: input.code,
        type: input.type,
        description: input.description ?? "",
        styleConfigJson: mergeStyleConfig(input.styleConfig) as unknown as Prisma.InputJsonValue,
        contentConfigJson: mergeContentConfig(input.contentConfig) as unknown as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
      include: templateInclude,
    });
    await createAuditLog(companyId, {
      entityType: "DocumentTemplate",
      entityId: created.id,
      action: "TEMPLATE_CREATED",
      payload: { name: created.name, code: created.code, type: created.type },
    }, tx);
    return created;
  });
  return toTemplateDTO(template);
}

export async function updateTemplate(companyId: string, templateId: string, input: Partial<DocumentTemplateWriteInput>) {
  const current = await getTemplateRecord(companyId, templateId);
  if (input.code !== undefined && input.code !== current.code) {
    const duplicate = await prisma.documentTemplate.findFirst({ where: { companyId, code: input.code } });
    if (duplicate) throw new ConflictError("TEMPLATE_CODE_EXISTS", "A template with this code already exists.");
  }

  // Merge onto the *current* (already fully-defaulted) config rather than
  // the library defaults, so a partial update — including a partial
  // `columns` object — only touches the fields it names and never resets
  // previously-customized sibling fields back to their defaults.
  const currentStyle = mergeStyleConfig(current.styleConfigJson as Partial<DocumentTemplateStyleConfig> | null);
  const currentContent = mergeContentConfig(current.contentConfigJson as PartialDocumentTemplateContentConfig | null);

  const nextStyle = input.styleConfig !== undefined
    ? { ...currentStyle, ...input.styleConfig }
    : undefined;
  const nextContent = input.contentConfig !== undefined
    ? {
        ...currentContent,
        ...input.contentConfig,
        columns: { ...currentContent.columns, ...(input.contentConfig.columns ?? {}) },
      }
    : undefined;

  const template = await prisma.$transaction(async (tx) => {
    const updated = await tx.documentTemplate.update({
      where: { id: current.id, companyId },
      data: {
        ...(input.industryEngineId !== undefined ? { industryEngineId: input.industryEngineId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(nextStyle !== undefined ? { styleConfigJson: nextStyle as unknown as Prisma.InputJsonValue } : {}),
        ...(nextContent !== undefined ? { contentConfigJson: nextContent as unknown as Prisma.InputJsonValue } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: templateInclude,
    });
    await createAuditLog(companyId, {
      entityType: "DocumentTemplate",
      entityId: updated.id,
      action: "TEMPLATE_UPDATED",
      payload: { name: updated.name, code: updated.code },
    }, tx);
    return updated;
  });
  return toTemplateDTO(template);
}

export async function setTemplateActive(companyId: string, templateId: string, isActive: boolean) {
  const current = await getTemplateRecord(companyId, templateId);
  const template = await prisma.$transaction(async (tx) => {
    const updated = await tx.documentTemplate.update({
      where: { id: current.id, companyId },
      data: { isActive },
      include: templateInclude,
    });
    await createAuditLog(companyId, {
      entityType: "DocumentTemplate",
      entityId: updated.id,
      action: isActive ? "TEMPLATE_ACTIVATED" : "TEMPLATE_DEACTIVATED",
      payload: { name: updated.name, code: updated.code },
    }, tx);
    return updated;
  });
  return toTemplateDTO(template);
}

/** Unsets `isDefault` on every other template of the same document type for this company. */
export async function setTemplateDefault(companyId: string, templateId: string) {
  const current = await getTemplateRecord(companyId, templateId);
  const template = await prisma.$transaction(async (tx) => {
    await tx.documentTemplate.updateMany({
      where: { companyId, type: current.type, isDefault: true, id: { not: current.id } },
      data: { isDefault: false },
    });
    const updated = await tx.documentTemplate.update({
      where: { id: current.id, companyId },
      data: { isDefault: true },
      include: templateInclude,
    });
    await createAuditLog(companyId, {
      entityType: "DocumentTemplate",
      entityId: updated.id,
      action: "TEMPLATE_UPDATED",
      payload: { name: updated.name, code: updated.code, setDefault: true },
    }, tx);
    return updated;
  });
  return toTemplateDTO(template);
}

export async function duplicateTemplate(companyId: string, templateId: string) {
  const current = await getTemplateRecord(companyId, templateId);
  let code = `${current.code}-COPY`;
  let suffix = 2;
  while (await prisma.documentTemplate.findFirst({ where: { companyId, code } })) {
    code = `${current.code}-COPY-${suffix}`;
    suffix += 1;
  }
  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.documentTemplate.create({
      data: {
        companyId,
        industryEngineId: current.industryEngineId,
        name: `${current.name} (Copy)`,
        code,
        type: current.type,
        description: current.description,
        styleConfigJson: current.styleConfigJson as Prisma.InputJsonValue,
        contentConfigJson: current.contentConfigJson as Prisma.InputJsonValue,
        isDefault: false,
        isActive: true,
      },
      include: templateInclude,
    });
    await createAuditLog(companyId, {
      entityType: "DocumentTemplate",
      entityId: created.id,
      action: "TEMPLATE_CREATED",
      payload: { name: created.name, code: created.code, duplicatedFrom: current.id },
    }, tx);
    return created;
  });
  return toTemplateDTO(template);
}
