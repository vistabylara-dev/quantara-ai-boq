import { DocumentAudience, GeneratedDocumentStatus } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getBOQRecord } from "@/lib/repositories/boq-repository";
import { appBaseUrl } from "@/lib/auth/dev-mailer";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_VALIDITY_DAYS } from "@/lib/documents/build-document-data";
import type { ClientProposalSettings } from "@/lib/proposals/proposal-settings";
import { canCreateProposal, recordProposalCreated } from "@/lib/entitlements/entitlement-service";

/**
 * The API accepts a plaintext `accessPasscode` (never `accessPasscodeHash`
 * directly — that field only ever exists as a hash, matching how user
 * passwords are handled). This hashes it once at the service boundary so
 * no plaintext passcode is ever passed down to the repository or logged.
 */
export type ProposalSettingsInput = Omit<Partial<ClientProposalSettings>, "accessPasscodeHash"> & { accessPasscode?: string };

async function resolveSettingsInput(input: ProposalSettingsInput | undefined): Promise<Partial<ClientProposalSettings> | undefined> {
  if (!input) return undefined;
  const { accessPasscode, ...rest } = input;
  if (accessPasscode === undefined) return rest;
  return { ...rest, accessPasscodeHash: await hashPassword(accessPasscode) };
}
import {
  createProposal,
  findActiveProposalForRevision,
  getProposal,
  listProposalEvents,
  listProposalsForProject,
  markProposalReady,
  regenerateProposalLink,
  reopenProposal,
  revokeProposal,
  updateProposalDraft,
} from "@/lib/repositories/client-proposal-repository";

export function buildProposalSecureUrl(rawToken: string): string {
  return `${appBaseUrl()}/proposal/${rawToken}`;
}

export type CreateProposalServiceInput = {
  boqId: string;
  recipientEmail: string;
  recipientName: string;
  expiresInDays?: number;
  settings?: ProposalSettingsInput;
  documentIds: string[];
  forceNew?: boolean;
};

export async function createProposalForProject(actor: CurrentActor, projectIdentifier: string, input: CreateProposalServiceInput) {
  requireCapability(actor, "proposals:manage");
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  const boqRecord = await getBOQRecord(actor.companyId, input.boqId);
  if (boqRecord.projectId !== project.id) throw new NotFoundError("BOQ not found for this project.");
  if (!boqRecord.isLocked) {
    throw new AppError("LOCKED_REVISION_REQUIRED", "A proposal can only be created from a locked BOQ revision.", 409);
  }
  const unresolvedCritical = boqRecord.verificationExceptions.filter(
    (exception) => !exception.resolved && exception.severity === "CRITICAL",
  ).length;
  if (unresolvedCritical > 0) {
    throw new AppError(
      "CRITICAL_VERIFICATION_EXCEPTIONS",
      `Cannot create a proposal: ${unresolvedCritical} unresolved critical verification exception(s) remain on this revision.`,
      409,
    );
  }

  if (input.documentIds.length === 0) {
    throw new AppError("DOCUMENTS_REQUIRED", "Select at least one client-facing document for this proposal.", 400);
  }
  const documents = await prisma.generatedDocument.findMany({ where: { id: { in: input.documentIds }, companyId: actor.companyId } });
  if (documents.length !== input.documentIds.length) throw new NotFoundError("One or more selected documents were not found.");
  for (const doc of documents) {
    if (doc.projectId !== project.id || doc.boqId !== boqRecord.id) {
      throw new AppError("DOCUMENT_MISMATCH", "Selected documents must belong to this project revision.", 400);
    }
    if (doc.audience !== DocumentAudience.CLIENT) {
      throw new AppError("DOCUMENT_NOT_CLIENT_FACING", "Only client-facing documents can be attached to a proposal.", 400);
    }
    if (doc.status !== GeneratedDocumentStatus.COMPLETED) {
      throw new AppError("DOCUMENT_NOT_READY", "Selected documents must finish generating before they can be attached.", 400);
    }
  }

  const client = await prisma.client.findFirst({ where: { id: project.clientId, companyId: actor.companyId } });
  if (!client) throw new NotFoundError("Client not found.");

  if (!input.forceNew) {
    const active = await findActiveProposalForRevision(actor.companyId, boqRecord.id);
    if (active) {
      return { proposal: active, rawToken: null as string | null, secureUrl: null as string | null, isExisting: true };
    }
  }

  const proposalCheck = await canCreateProposal(actor.companyId);
  if (!proposalCheck.allowed) {
    throw new AppError("TRIAL_PROPOSAL_LIMIT_REACHED", proposalCheck.reason ?? "Proposal limit reached.", 403);
  }

  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? DEFAULT_VALIDITY_DAYS) * 24 * 60 * 60 * 1000);
  const { proposal, rawToken } = await createProposal(actor.companyId, {
    projectId: project.id,
    boqId: boqRecord.id,
    revisionNumber: boqRecord.revisionNumber,
    clientId: client.id,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    expiresAt,
    settings: await resolveSettingsInput(input.settings),
    documentIds: input.documentIds,
    createdByUserId: actor.userId,
    createdByName: actor.fullName,
  });
  await recordProposalCreated(actor.companyId);
  return { proposal, rawToken, secureUrl: buildProposalSecureUrl(rawToken), isExisting: false };
}

export async function listProposalsForProjectCompany(actor: CurrentActor, projectIdentifier: string) {
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  return listProposalsForProject(actor.companyId, project.id);
}

export async function getProposalForCompany(actor: CurrentActor, proposalId: string) {
  return getProposal(actor.companyId, proposalId);
}

export async function updateProposalForCompany(
  actor: CurrentActor,
  proposalId: string,
  input: { recipientEmail?: string; recipientName?: string; expiresInDays?: number; settings?: ProposalSettingsInput; documentIds?: string[] },
) {
  requireCapability(actor, "proposals:manage");
  const expiresAt = input.expiresInDays !== undefined ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000) : undefined;
  return updateProposalDraft(actor.companyId, proposalId, {
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    expiresAt,
    settings: await resolveSettingsInput(input.settings),
    documentIds: input.documentIds,
  });
}

export async function markProposalReadyForCompany(actor: CurrentActor, proposalId: string) {
  requireCapability(actor, "proposals:manage");
  return markProposalReady(actor.companyId, proposalId);
}

export async function revokeProposalForCompany(actor: CurrentActor, proposalId: string) {
  requireCapability(actor, "proposals:manage");
  return revokeProposal(actor.companyId, proposalId, actor.fullName);
}

export async function regenerateProposalLinkForCompany(actor: CurrentActor, proposalId: string) {
  requireCapability(actor, "proposals:manage");
  const { proposal, rawToken } = await regenerateProposalLink(actor.companyId, proposalId, actor.fullName);
  return { proposal, rawToken, secureUrl: buildProposalSecureUrl(rawToken) };
}

export async function reopenProposalForCompany(actor: CurrentActor, proposalId: string) {
  requireCapability(actor, "proposals:manage");
  return reopenProposal(actor.companyId, proposalId, actor.fullName);
}

export async function listProposalEventsForCompany(actor: CurrentActor, proposalId: string) {
  return listProposalEvents(actor.companyId, proposalId);
}
