import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  createTemplate,
  duplicateTemplate,
  getTemplate,
  listTemplates,
  setTemplateActive,
  setTemplateDefault,
  updateTemplate,
  type DocumentTemplateListFilters,
  type DocumentTemplateWriteInput,
} from "@/lib/repositories/document-template-repository";

export async function listTemplatesForCompany(actor: CurrentActor, filters: DocumentTemplateListFilters) {
  return listTemplates(actor.companyId, filters);
}

export async function getTemplateForCompany(actor: CurrentActor, templateId: string) {
  return getTemplate(actor.companyId, templateId);
}

export async function createTemplateForCompany(actor: CurrentActor, input: DocumentTemplateWriteInput) {
  requireCapability(actor, "templates:manage");
  return createTemplate(actor.companyId, input);
}

export async function updateTemplateForCompany(
  actor: CurrentActor,
  templateId: string,
  input: Partial<DocumentTemplateWriteInput>,
) {
  requireCapability(actor, "templates:manage");
  return updateTemplate(actor.companyId, templateId, input);
}

export async function setTemplateActiveForCompany(actor: CurrentActor, templateId: string, isActive: boolean) {
  requireCapability(actor, "templates:manage");
  return setTemplateActive(actor.companyId, templateId, isActive);
}

export async function setTemplateDefaultForCompany(actor: CurrentActor, templateId: string) {
  requireCapability(actor, "templates:manage");
  return setTemplateDefault(actor.companyId, templateId);
}

export async function duplicateTemplateForCompany(actor: CurrentActor, templateId: string) {
  requireCapability(actor, "templates:manage");
  return duplicateTemplate(actor.companyId, templateId);
}
