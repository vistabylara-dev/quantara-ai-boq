import { ClientProposalEventType, ClientProposalStatus, Prisma, ProjectStatus, ProposalActorType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { generateProposalToken, hashProposalToken } from "@/lib/proposals/proposal-token";
import { DEFAULT_PROPOSAL_SETTINGS, mergeProposalSettings, type ClientProposalSettings } from "@/lib/proposals/proposal-settings";

const proposalInclude = {
  client: true,
  documents: { include: { generatedDocument: true } },
} satisfies Prisma.ClientProposalInclude;

type ProposalRecord = Prisma.ClientProposalGetPayload<{ include: typeof proposalInclude }>;

export function toProposalDTO(row: ProposalRecord) {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    boqId: row.boqId,
    revisionNumber: row.revisionNumber,
    clientId: row.clientId,
    clientName: row.client.companyName ?? row.client.name,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    recipientEmail: row.recipientEmail,
    recipientName: row.recipientName,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    firstOpenedAt: row.firstOpenedAt?.toISOString() ?? null,
    lastOpenedAt: row.lastOpenedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    revisionRequestedAt: row.revisionRequestedAt?.toISOString() ?? null,
    clientComment: row.clientComment,
    approvalName: row.approvalName,
    approvalEmail: row.approvalEmail,
    rejectionReason: row.rejectionReason,
    selectedOptionsJson: (row.selectedOptionsJson as Record<string, string> | null) ?? {},
    settings: mergeProposalSettings(row.settingsJson as Partial<ClientProposalSettings> | null),
    documents: row.documents.map((doc) => ({
      id: doc.generatedDocument.id,
      type: doc.generatedDocument.type,
      audience: doc.generatedDocument.audience,
      fileName: doc.generatedDocument.fileName,
      fileSize: doc.generatedDocument.fileSize,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type ProposalDTO = ReturnType<typeof toProposalDTO>;

/**
 * Explicit allow-list of status transitions (spec section 4). Anything not
 * listed here is implicitly forbidden — including the explicitly-called-out
 * forbidden ones (APPROVED->DRAFT, REVOKED->APPROVED, EXPIRED->APPROVED).
 * REVISION_REQUESTED -> OPENED exists only for the internal "reopen"
 * action (see reopenProposal), never reachable from the public portal.
 */
const VALID_TRANSITIONS: Record<ClientProposalStatus, ClientProposalStatus[]> = {
  DRAFT: [ClientProposalStatus.READY, ClientProposalStatus.REVOKED],
  READY: [ClientProposalStatus.SENT, ClientProposalStatus.REVOKED],
  SENT: [ClientProposalStatus.OPENED, ClientProposalStatus.REVOKED, ClientProposalStatus.EXPIRED],
  OPENED: [
    ClientProposalStatus.COMMENTED,
    ClientProposalStatus.APPROVED,
    ClientProposalStatus.REVISION_REQUESTED,
    ClientProposalStatus.REJECTED,
    ClientProposalStatus.REVOKED,
    ClientProposalStatus.EXPIRED,
  ],
  COMMENTED: [
    ClientProposalStatus.APPROVED,
    ClientProposalStatus.REVISION_REQUESTED,
    ClientProposalStatus.REJECTED,
    ClientProposalStatus.REVOKED,
    ClientProposalStatus.EXPIRED,
  ],
  REVISION_REQUESTED: [ClientProposalStatus.OPENED, ClientProposalStatus.REVOKED, ClientProposalStatus.EXPIRED],
  APPROVED: [],
  REJECTED: [],
  REVOKED: [],
  EXPIRED: [],
};

export function assertValidTransition(current: ClientProposalStatus, next: ClientProposalStatus): void {
  if (!VALID_TRANSITIONS[current]?.includes(next)) {
    throw new ConflictError(
      "INVALID_PROPOSAL_TRANSITION",
      `Cannot move a proposal from ${current} to ${next}.`,
    );
  }
}

async function getProposalRecord(companyId: string, proposalId: string): Promise<ProposalRecord> {
  const row = await prisma.clientProposal.findFirst({ where: { id: proposalId, companyId }, include: proposalInclude });
  if (!row) throw new NotFoundError("Proposal not found.");
  return row;
}

export async function getProposal(companyId: string, proposalId: string) {
  return toProposalDTO(await getProposalRecord(companyId, proposalId));
}

export async function listProposalsForProject(companyId: string, projectId: string) {
  const rows = await prisma.clientProposal.findMany({
    where: { companyId, projectId },
    include: proposalInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toProposalDTO);
}

/** Any proposal for this revision that hasn't reached a terminal state — used to warn on duplicate creation. */
export async function findActiveProposalForRevision(companyId: string, boqId: string) {
  const row = await prisma.clientProposal.findFirst({
    where: {
      companyId,
      boqId,
      status: { notIn: [ClientProposalStatus.REJECTED, ClientProposalStatus.REVOKED, ClientProposalStatus.EXPIRED] },
    },
    include: proposalInclude,
    orderBy: { createdAt: "desc" },
  });
  return row ? toProposalDTO(row) : null;
}

export type CreateProposalInput = {
  projectId: string;
  boqId: string;
  revisionNumber: number;
  clientId: string;
  recipientEmail: string;
  recipientName: string;
  expiresAt: Date;
  settings?: Partial<ClientProposalSettings>;
  documentIds: string[];
  createdByUserId: string | null;
  createdByName: string;
};

export async function createProposal(companyId: string, input: CreateProposalInput) {
  const rawToken = generateProposalToken();
  const tokenHash = hashProposalToken(rawToken);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.clientProposal.create({
      data: {
        companyId,
        projectId: input.projectId,
        boqId: input.boqId,
        revisionNumber: input.revisionNumber,
        clientId: input.clientId,
        createdByUserId: input.createdByUserId,
        createdByName: input.createdByName,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        tokenHash,
        status: ClientProposalStatus.DRAFT,
        expiresAt: input.expiresAt,
        settingsJson: mergeProposalSettings({ ...DEFAULT_PROPOSAL_SETTINGS, ...input.settings }) as unknown as Prisma.InputJsonValue,
        documents: {
          create: input.documentIds.map((generatedDocumentId) => ({ companyId, generatedDocumentId })),
        },
      },
      include: proposalInclude,
    });
    await tx.clientProposalEvent.create({
      data: {
        companyId,
        clientProposalId: row.id,
        eventType: ClientProposalEventType.CREATED,
        actorType: ProposalActorType.INTERNAL,
        actorUserId: input.createdByUserId,
        actorName: input.createdByName,
      },
    });
    await createAuditLog(companyId, {
      entityType: "ClientProposal",
      entityId: row.id,
      action: "PROPOSAL_CREATED",
      payload: { projectId: row.projectId, boqId: row.boqId, revisionNumber: row.revisionNumber, recipientEmail: row.recipientEmail },
    }, tx);
    return row;
  });

  return { proposal: toProposalDTO(created), rawToken };
}

export async function updateProposalDraft(
  companyId: string,
  proposalId: string,
  input: Partial<Pick<CreateProposalInput, "recipientEmail" | "recipientName" | "expiresAt" | "settings" | "documentIds">>,
) {
  const current = await getProposalRecord(companyId, proposalId);
  if (current.status !== ClientProposalStatus.DRAFT && current.status !== ClientProposalStatus.READY) {
    throw new ConflictError("PROPOSAL_NOT_EDITABLE", "Only DRAFT or READY proposals can be edited.");
  }
  const nextSettings = input.settings !== undefined
    ? mergeProposalSettings({ ...(current.settingsJson as Partial<ClientProposalSettings> | null), ...input.settings })
    : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.clientProposal.update({
      where: { id: current.id, companyId },
      data: {
        ...(input.recipientEmail !== undefined ? { recipientEmail: input.recipientEmail } : {}),
        ...(input.recipientName !== undefined ? { recipientName: input.recipientName } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        ...(nextSettings !== undefined ? { settingsJson: nextSettings as unknown as Prisma.InputJsonValue } : {}),
      },
      include: proposalInclude,
    });
    if (input.documentIds !== undefined) {
      await tx.clientProposalDocument.deleteMany({ where: { companyId, clientProposalId: row.id } });
      if (input.documentIds.length > 0) {
        await tx.clientProposalDocument.createMany({
          data: input.documentIds.map((generatedDocumentId) => ({ companyId, clientProposalId: row.id, generatedDocumentId })),
        });
      }
    }
    await createAuditLog(companyId, {
      entityType: "ClientProposal",
      entityId: row.id,
      action: "PROPOSAL_UPDATED",
      payload: {},
    }, tx);
    return tx.clientProposal.findFirstOrThrow({ where: { id: row.id, companyId }, include: proposalInclude });
  });
  return toProposalDTO(updated);
}

async function transitionStatus(
  companyId: string,
  proposalId: string,
  next: ClientProposalStatus,
  extraData: Prisma.ClientProposalUpdateInput = {},
): Promise<ProposalRecord> {
  const current = await getProposalRecord(companyId, proposalId);
  assertValidTransition(current.status, next);
  return prisma.clientProposal.update({
    where: { id: current.id, companyId },
    data: { status: next, ...extraData },
    include: proposalInclude,
  });
}

export async function markProposalReady(companyId: string, proposalId: string) {
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.clientProposal.findFirst({ where: { id: proposalId, companyId } });
    if (!current) throw new NotFoundError("Proposal not found.");
    assertValidTransition(current.status, ClientProposalStatus.READY);
    const updated = await tx.clientProposal.update({
      where: { id: current.id, companyId },
      data: { status: ClientProposalStatus.READY },
      include: proposalInclude,
    });
    await tx.clientProposalEvent.create({
      data: { companyId, clientProposalId: updated.id, eventType: ClientProposalEventType.READY, actorType: ProposalActorType.INTERNAL },
    });
    await createAuditLog(companyId, { entityType: "ClientProposal", entityId: updated.id, action: "PROPOSAL_READY", payload: {} }, tx);
    return updated;
  });
  return toProposalDTO(row);
}

export async function markProposalSent(companyId: string, proposalId: string) {
  return transitionStatus(companyId, proposalId, ClientProposalStatus.SENT);
}

export async function revokeProposal(companyId: string, proposalId: string, actorName: string) {
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.clientProposal.findFirst({ where: { id: proposalId, companyId } });
    if (!current) throw new NotFoundError("Proposal not found.");
    assertValidTransition(current.status, ClientProposalStatus.REVOKED);
    const updated = await tx.clientProposal.update({
      where: { id: current.id, companyId },
      data: { status: ClientProposalStatus.REVOKED, revokedAt: new Date() },
      include: proposalInclude,
    });
    await tx.clientProposalEvent.create({
      data: { companyId, clientProposalId: updated.id, eventType: ClientProposalEventType.REVOKED, actorType: ProposalActorType.INTERNAL, actorName },
    });
    await createAuditLog(companyId, { entityType: "ClientProposal", entityId: updated.id, action: "PROPOSAL_REVOKED", payload: {} }, tx);
    return updated;
  });
  return toProposalDTO(row);
}

/** Revokes the current token and issues a new one; the old URL stops working immediately. */
export async function regenerateProposalLink(companyId: string, proposalId: string, actorName: string) {
  const current = await getProposalRecord(companyId, proposalId);
  const rawToken = generateProposalToken();
  const tokenHash = hashProposalToken(rawToken);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.clientProposal.update({
      where: { id: current.id, companyId },
      data: { tokenHash },
      include: proposalInclude,
    });
    await tx.clientProposalEvent.create({
      data: { companyId, clientProposalId: row.id, eventType: ClientProposalEventType.LINK_REGENERATED, actorType: ProposalActorType.INTERNAL, actorName },
    });
    await createAuditLog(companyId, { entityType: "ClientProposal", entityId: row.id, action: "PROPOSAL_LINK_REGENERATED", payload: {} }, tx);
    return row;
  });
  return { proposal: toProposalDTO(updated), rawToken };
}

export async function reopenProposal(companyId: string, proposalId: string, actorName: string) {
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.clientProposal.findFirst({ where: { id: proposalId, companyId } });
    if (!current) throw new NotFoundError("Proposal not found.");
    assertValidTransition(current.status, ClientProposalStatus.OPENED);
    const updated = await tx.clientProposal.update({
      where: { id: current.id, companyId },
      data: { status: ClientProposalStatus.OPENED },
      include: proposalInclude,
    });
    await createAuditLog(companyId, { entityType: "ClientProposal", entityId: updated.id, action: "PROPOSAL_REOPENED", actorName, payload: {} }, tx);
    return updated;
  });
  return toProposalDTO(row);
}

// ---------- Public-portal-facing mutations (called with tokenHash-resolved id, no RBAC) ----------

export async function recordProposalOpen(companyId: string, proposalId: string) {
  const current = await getProposalRecord(companyId, proposalId);
  const now = new Date();
  const data: Prisma.ClientProposalUpdateInput = { lastOpenedAt: now };
  if (!current.firstOpenedAt) data.firstOpenedAt = now;
  if (current.status === ClientProposalStatus.SENT) {
    assertValidTransition(current.status, ClientProposalStatus.OPENED);
    data.status = ClientProposalStatus.OPENED;
  }
  const updated = await prisma.clientProposal.update({ where: { id: current.id, companyId }, data, include: proposalInclude });
  return toProposalDTO(updated);
}

export async function recordOptionSelection(companyId: string, proposalId: string, selectedOptionsJson: Record<string, string>) {
  const updated = await prisma.clientProposal.update({
    where: { id: proposalId, companyId },
    data: { selectedOptionsJson: selectedOptionsJson as unknown as Prisma.InputJsonValue },
    include: proposalInclude,
  });
  return toProposalDTO(updated);
}

export async function recordComment(companyId: string, proposalId: string, comment: string) {
  const current = await getProposalRecord(companyId, proposalId);
  const data: Prisma.ClientProposalUpdateInput = { clientComment: comment };
  if (current.status === ClientProposalStatus.OPENED) {
    assertValidTransition(current.status, ClientProposalStatus.COMMENTED);
    data.status = ClientProposalStatus.COMMENTED;
  }
  const updated = await prisma.clientProposal.update({ where: { id: current.id, companyId }, data, include: proposalInclude });
  return toProposalDTO(updated);
}

export async function recordRevisionRequest(companyId: string, proposalId: string, comment: string) {
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.clientProposal.findFirst({ where: { id: proposalId, companyId } });
    if (!current) throw new NotFoundError("Proposal not found.");
    assertValidTransition(current.status, ClientProposalStatus.REVISION_REQUESTED);
    const updated = await tx.clientProposal.update({
      where: { id: current.id, companyId },
      data: { status: ClientProposalStatus.REVISION_REQUESTED, revisionRequestedAt: new Date(), clientComment: comment },
      include: proposalInclude,
    });
    await tx.project.updateMany({ where: { id: updated.projectId, companyId }, data: { status: ProjectStatus.REVISION_REQUESTED } });
    return updated;
  });
  return toProposalDTO(row);
}

export async function recordApproval(
  companyId: string,
  proposalId: string,
  input: { approvalName: string; approvalEmail: string; selectedOptionsJson: Record<string, string>; clientComment?: string | null },
) {
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.clientProposal.findFirst({ where: { id: proposalId, companyId } });
    if (!current) throw new NotFoundError("Proposal not found.");
    assertValidTransition(current.status, ClientProposalStatus.APPROVED);
    const updated = await tx.clientProposal.update({
      where: { id: current.id, companyId },
      data: {
        status: ClientProposalStatus.APPROVED,
        approvedAt: new Date(),
        approvalName: input.approvalName,
        approvalEmail: input.approvalEmail,
        selectedOptionsJson: input.selectedOptionsJson as unknown as Prisma.InputJsonValue,
        ...(input.clientComment !== undefined ? { clientComment: input.clientComment } : {}),
      },
      include: proposalInclude,
    });
    await tx.project.updateMany({ where: { id: updated.projectId, companyId }, data: { status: ProjectStatus.CLIENT_APPROVED } });
    return updated;
  });
  return toProposalDTO(row);
}

export async function recordRejection(companyId: string, proposalId: string, input: { name: string; email: string; reason: string }) {
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.clientProposal.findFirst({ where: { id: proposalId, companyId } });
    if (!current) throw new NotFoundError("Proposal not found.");
    assertValidTransition(current.status, ClientProposalStatus.REJECTED);
    const updated = await tx.clientProposal.update({
      where: { id: current.id, companyId },
      data: {
        status: ClientProposalStatus.REJECTED,
        rejectedAt: new Date(),
        approvalName: input.name,
        approvalEmail: input.email,
        rejectionReason: input.reason,
      },
      include: proposalInclude,
    });
    await tx.project.updateMany({ where: { id: updated.projectId, companyId }, data: { status: ProjectStatus.REJECTED } });
    return updated;
  });
  return toProposalDTO(row);
}

const EXPIRE_ELIGIBLE_STATUSES: ClientProposalStatus[] = [
  ClientProposalStatus.SENT,
  ClientProposalStatus.OPENED,
  ClientProposalStatus.COMMENTED,
  ClientProposalStatus.REVISION_REQUESTED,
];

/** Idempotent: only transitions and only emits one EXPIRED event, even if called repeatedly on every access attempt. */
export async function markExpiredIfNeeded(companyId: string, proposalId: string): Promise<boolean> {
  const current = await getProposalRecord(companyId, proposalId);
  if (current.expiresAt.getTime() >= Date.now()) return false;
  if (!EXPIRE_ELIGIBLE_STATUSES.includes(current.status)) return false;

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.clientProposal.updateMany({
      where: { id: current.id, companyId, status: current.status },
      data: { status: ClientProposalStatus.EXPIRED },
    });
    if (claimed.count !== 1) return;
    await tx.clientProposalEvent.create({
      data: { companyId, clientProposalId: current.id, eventType: ClientProposalEventType.EXPIRED, actorType: ProposalActorType.SYSTEM },
    });
    await createAuditLog(companyId, { entityType: "ClientProposal", entityId: current.id, action: "PROPOSAL_EXPIRED", payload: {} }, tx);
  });
  return true;
}

export type CreateProposalEventInput = {
  eventType: ClientProposalEventType;
  actorType: ProposalActorType;
  actorUserId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  ipHash?: string | null;
  userAgentSummary?: string | null;
  metadataJson?: Prisma.InputJsonValue;
};

export async function createProposalEvent(companyId: string, proposalId: string, input: CreateProposalEventInput) {
  return prisma.clientProposalEvent.create({
    data: {
      companyId,
      clientProposalId: proposalId,
      eventType: input.eventType,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName ?? null,
      actorEmail: input.actorEmail ?? null,
      ipHash: input.ipHash ?? null,
      userAgentSummary: input.userAgentSummary ?? null,
      metadataJson: input.metadataJson,
    },
  });
}

export async function listProposalEvents(companyId: string, proposalId: string) {
  await getProposalRecord(companyId, proposalId);
  const rows = await prisma.clientProposalEvent.findMany({
    where: { companyId, clientProposalId: proposalId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    actorType: row.actorType,
    actorName: row.actorName,
    actorEmail: row.actorEmail,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * The raw token is never stored, so a caller wanting to embed a valid
 * secure link in an email (preview or send) must already hold it — from
 * the create/regenerate response — and pass it back in. This confirms the
 * held token still matches the proposal's *current* tokenHash before it's
 * embedded anywhere, so a stale token from before a regeneration can never
 * silently end up in an outgoing email.
 */
export async function verifyProposalToken(companyId: string, proposalId: string, rawToken: string): Promise<boolean> {
  const row = await prisma.clientProposal.findFirst({ where: { id: proposalId, companyId }, select: { tokenHash: true } });
  if (!row) throw new NotFoundError("Proposal not found.");
  return row.tokenHash === hashProposalToken(rawToken);
}
