import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  createEmailTemplate,
  duplicateEmailTemplate,
  getEmailTemplate,
  listEmailTemplates,
  setEmailTemplateActive,
  setEmailTemplateDefault,
  updateEmailTemplate,
  type EmailTemplateWriteInput,
} from "@/lib/repositories/email-template-repository";

export async function listEmailTemplatesForCompany(actor: CurrentActor, includeInactive = false) {
  return listEmailTemplates(actor.companyId, includeInactive);
}

export async function getEmailTemplateForCompany(actor: CurrentActor, templateId: string) {
  return getEmailTemplate(actor.companyId, templateId);
}

export async function createEmailTemplateForCompany(actor: CurrentActor, input: EmailTemplateWriteInput) {
  requireCapability(actor, "email-templates:manage");
  return createEmailTemplate(actor.companyId, input);
}

export async function updateEmailTemplateForCompany(actor: CurrentActor, templateId: string, input: Partial<EmailTemplateWriteInput>) {
  requireCapability(actor, "email-templates:manage");
  return updateEmailTemplate(actor.companyId, templateId, input);
}

export async function setEmailTemplateActiveForCompany(actor: CurrentActor, templateId: string, isActive: boolean) {
  requireCapability(actor, "email-templates:manage");
  return setEmailTemplateActive(actor.companyId, templateId, isActive);
}

export async function setEmailTemplateDefaultForCompany(actor: CurrentActor, templateId: string) {
  requireCapability(actor, "email-templates:manage");
  return setEmailTemplateDefault(actor.companyId, templateId);
}

export async function duplicateEmailTemplateForCompany(actor: CurrentActor, templateId: string) {
  requireCapability(actor, "email-templates:manage");
  return duplicateEmailTemplate(actor.companyId, templateId);
}
