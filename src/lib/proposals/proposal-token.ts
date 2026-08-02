import { ClientProposalStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generateRawToken, hashToken } from "@/lib/auth/tokens";

/**
 * 32 random bytes, base64url-encoded — identical scheme already used for
 * sessions/email-verification/password-reset tokens (see auth/tokens.ts).
 * The raw token is only ever handed back once, at creation time, to be
 * embedded in the proposal URL; only its SHA-256 hash is persisted.
 */
export function generateProposalToken(): string {
  return generateRawToken();
}

export function hashProposalToken(rawToken: string): string {
  return hashToken(rawToken);
}

const proposalAccessInclude = {
  company: true,
  project: { include: { industryEngine: true } },
  client: true,
  documents: { include: { generatedDocument: true } },
} satisfies Prisma.ClientProposalInclude;

export type ProposalAccessRecord = Prisma.ClientProposalGetPayload<{ include: typeof proposalAccessInclude }>;

/**
 * Looks up a proposal by its raw token. Lookup is by tokenHash equality
 * against a unique DB index — a single-character difference in the raw
 * token produces a completely different SHA-256 hash, so this is not
 * vulnerable to the kind of incremental timing attack a byte-by-byte
 * string comparison would be (the same pattern used for session tokens
 * elsewhere in this codebase never does a literal constant-time compare
 * either, for the same reason).
 */
export async function findProposalByRawToken(rawToken: string): Promise<ProposalAccessRecord | null> {
  if (!rawToken) return null;
  return prisma.clientProposal.findUnique({
    where: { tokenHash: hashProposalToken(rawToken) },
    include: proposalAccessInclude,
  });
}

export type ProposalAccessDenialReason = "NOT_FOUND" | "REVOKED" | "EXPIRED" | "INVALID_STATUS";

export type ProposalAccessResult =
  | { ok: true; proposal: ProposalAccessRecord }
  | { ok: false; reason: ProposalAccessDenialReason };

const BLOCKED_ACCESS_STATUSES: ClientProposalStatus[] = [ClientProposalStatus.DRAFT, ClientProposalStatus.READY];

/**
 * Read-only validation only — never mutates status (expiry transition is a
 * deliberate side effect handled by the service layer's markExpiredIfNeeded,
 * kept separate so a validation check never silently writes to the DB).
 */
export async function validateProposalAccess(rawToken: string): Promise<ProposalAccessResult> {
  const proposal = await findProposalByRawToken(rawToken);
  if (!proposal) return { ok: false, reason: "NOT_FOUND" };
  if (proposal.status === ClientProposalStatus.REVOKED) return { ok: false, reason: "REVOKED" };
  if (proposal.status === ClientProposalStatus.EXPIRED || proposal.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "EXPIRED" };
  }
  // DRAFT/READY proposals have never been sent — no client link should exist yet, but guard anyway.
  if (BLOCKED_ACCESS_STATUSES.includes(proposal.status)) {
    return { ok: false, reason: "INVALID_STATUS" };
  }
  return { ok: true, proposal };
}
