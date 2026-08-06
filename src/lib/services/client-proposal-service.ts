import { DocumentAudience, GeneratedDocumentStatus, TechnicalReportStatus } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getBOQRecord } from "@/lib/repositories/boq-repository";
import { getGeneratedTechnicalReportRecord } from "@/lib/repositories/generated-technical-report-repository";
import { appBaseUrl } from "@/lib/auth/dev-mailer";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_VALIDITY_DAYS } from "@/lib/documents/build-document-data";
import type { ClientProposalSettings } from "@/lib/proposals/proposal-settings";
import { canCreateProposal, recordProposalCreated } from "@/lib/entitlements/entitlement-service";
import {
  createProposal,
  findActiveProposalForReport,
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

export function buildProposalSecureUrl(rawToken: string): string {
  return `${appBaseUrl()}/proposal/${rawToken}`;
}

type CreateProposalSharedInput = {
  recipientEmail: string;
  recipientName: string;
  expiresInDays?: number;
  settings?: ProposalSettingsInput;
  forceNew?: boolean;
};

export type CreateBoqProposalServiceInput = CreateProposalSharedInput & {
  sourceType: "BOQ_REVISION";
  boqId: string;
  documentIds: string[];
};

export type CreateTechnicalReportProposalServiceInput = CreateProposalSharedInput & {
  sourceType: "TECHNICAL_REPORT_REVISION";
  technicalReportId: string;
};

export type CreateProposalServiceInput = CreateBoqProposalServiceInput | CreateTechnicalReportProposalServiceInput;

function assertValidRecipientAndExpiry(input: CreateProposalSharedInput): void {
  if (!input.recipientName?.trim() || !input.recipientEmail?.trim()) {
    throw new AppError("PROPOSAL_RECIPIENT_INVALID", "A valid recipient name and email are required.", 400);
  }
  if (input.expiresInDays !== undefined && (input.expiresInDays < 1 || input.expiresInDays > 365)) {
    throw new AppError("PROPOSAL_EXPIRY_INVALID", "Expiry must be between 1 and 365 days.", 400);
  }
}

function computeExpiresAt(expiresInDays?: number): Date {
  return new Date(Date.now() + (expiresInDays ?? DEFAULT_VALIDITY_DAYS) * 24 * 60 * 60 * 1000);
}

type ProjectRecord = Awaited<ReturnType<typeof getProjectRecord>>;

async function createBoqProposal(actor: CurrentActor, project: ProjectRecord, input: CreateBoqProposalServiceInput) {
  if (!input.boqId) {
    throw new AppError("PROPOSAL_SOURCE_REQUIRED", "Select a BOQ revision before creating a proposal.", 400);
  }
  const boqRecord = await getBOQRecord(actor.companyId, input.boqId);
  if (boqRecord.projectId !== project.id) throw new NotFoundError("BOQ not found for this project.");
  if (!boqRecord.isLocked) {
    throw new AppError("BOQ_REVISION_NOT_LOCKED", "A proposal can only be created from a locked BOQ revision. Lock the revision, then try again.", 409);
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
    throw new AppError("GENERATED_DOCUMENT_REQUIRED", "Select at least one generated client-facing document for this proposal.", 400);
  }
  const documents = await prisma.generatedDocument.findMany({ where: { id: { in: input.documentIds }, companyId: actor.companyId } });
  if (documents.length !== input.documentIds.length) throw new NotFoundError("One or more selected documents were not found.");
  for (const doc of documents) {
    if (doc.projectId !== project.id || doc.boqId !== boqRecord.id) {
      throw new AppError("GENERATED_DOCUMENT_SOURCE_MISMATCH", "Selected documents must belong to this project revision.", 400);
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

  assertValidRecipientAndExpiry(input);
  const expiresAt = computeExpiresAt(input.expiresInDays);

  try {
    const { proposal, rawToken } = await createProposal(actor.companyId, {
      sourceType: "BOQ_REVISION",
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
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("PROPOSAL_CREATION_FAILED", "Failed to create the proposal. Please try again.", 500);
  }
}

async function createTechnicalReportProposal(actor: CurrentActor, project: ProjectRecord, input: CreateTechnicalReportProposalServiceInput) {
  if (!input.technicalReportId) {
    throw new AppError("PROPOSAL_SOURCE_REQUIRED", "Select a technical report before creating a proposal.", 400);
  }
  const report = await getGeneratedTechnicalReportRecord(actor.companyId, input.technicalReportId);
  if (report.projectId !== project.id) throw new NotFoundError("Technical report not found for this project.");
  // TechnicalReportStatus has only DRAFT/COMPLETED — COMPLETED is this schema's immutable,
  // client-ready equivalent of a "locked/final" revision (reused as-is, not a duplicate status system).
  if (report.status !== TechnicalReportStatus.COMPLETED) {
    throw new AppError(
      "REPORT_REVISION_NOT_FINAL",
      "A proposal can only be created from a completed technical report. Generate the report's document, then try again.",
      409,
    );
  }
  if (!report.storageKey || !report.fileName) {
    throw new AppError("GENERATED_DOCUMENT_REQUIRED", "Generate the client-facing report document before creating a proposal.", 400);
  }

  const client = await prisma.client.findFirst({ where: { id: project.clientId, companyId: actor.companyId } });
  if (!client) throw new NotFoundError("Client not found.");

  if (!input.forceNew) {
    const active = await findActiveProposalForReport(actor.companyId, report.id);
    if (active) {
      return { proposal: active, rawToken: null as string | null, secureUrl: null as string | null, isExisting: true };
    }
  }

  const proposalCheck = await canCreateProposal(actor.companyId);
  if (!proposalCheck.allowed) {
    throw new AppError("TRIAL_PROPOSAL_LIMIT_REACHED", proposalCheck.reason ?? "Proposal limit reached.", 403);
  }

  assertValidRecipientAndExpiry(input);
  const expiresAt = computeExpiresAt(input.expiresInDays);

  try {
    const { proposal, rawToken } = await createProposal(actor.companyId, {
      sourceType: "TECHNICAL_REPORT_REVISION",
      projectId: project.id,
      technicalReportId: report.id,
      clientId: client.id,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      expiresAt,
      settings: await resolveSettingsInput(input.settings),
      createdByUserId: actor.userId,
      createdByName: actor.fullName,
    });
    await recordProposalCreated(actor.companyId);
    return { proposal, rawToken, secureUrl: buildProposalSecureUrl(rawToken), isExisting: false };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("PROPOSAL_CREATION_FAILED", "Failed to create the proposal. Please try again.", 500);
  }
}

export async function createProposalForProject(actor: CurrentActor, projectIdentifier: string, input: CreateProposalServiceInput) {
  requireCapability(actor, "proposals:manage");
  if (!input.sourceType) {
    throw new AppError("PROPOSAL_TYPE_REQUIRED", "Choose a proposal type before continuing.", 400);
  }
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  if (input.sourceType === "BOQ_REVISION") return createBoqProposal(actor, project, input);
  return createTechnicalReportProposal(actor, project, input);
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
