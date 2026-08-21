import { Prisma, TechnicalReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { appBaseUrl } from "@/lib/auth/dev-mailer";
import { generateRawToken, hashToken } from "@/lib/auth/tokens";

/**
 * Email service 1B — client-facing secure link for a generated technical report. Same
 * generate-raw/store-hash-only scheme already used for sessions, email verification, password
 * reset, and ClientProposal.tokenHash (see auth/tokens.ts and proposals/proposal-token.ts). The raw
 * token is only ever returned once, at creation time, to be embedded in the link; only its SHA-256
 * hash is persisted.
 */
export function generateReportShareToken(): string {
  return generateRawToken();
}

export function hashReportShareToken(rawToken: string): string {
  return hashToken(rawToken);
}

export function buildTechnicalReportShareUrl(rawToken: string): string {
  return `${appBaseUrl()}/technical-report/${rawToken}`;
}

const shareAccessInclude = {
  company: true,
  project: true,
} satisfies Prisma.GeneratedTechnicalReportInclude;

export type TechnicalReportShareRecord = Prisma.GeneratedTechnicalReportGetPayload<{ include: typeof shareAccessInclude }>;

/**
 * Looks up a report by its raw share token. Lookup is by shareTokenHash equality against a unique
 * DB index — a single-character difference in the raw token produces a completely different
 * SHA-256 hash, so this carries the same non-guessability property as session/proposal tokens
 * elsewhere in this codebase.
 */
export async function findTechnicalReportByRawShareToken(rawToken: string): Promise<TechnicalReportShareRecord | null> {
  if (!rawToken) return null;
  return prisma.generatedTechnicalReport.findUnique({
    where: { shareTokenHash: hashReportShareToken(rawToken) },
    include: shareAccessInclude,
  });
}

export type TechnicalReportShareDenialReason = "NOT_FOUND" | "REVOKED" | "EXPIRED" | "NOT_READY";

export type TechnicalReportShareAccessResult =
  | { ok: true; report: TechnicalReportShareRecord }
  | { ok: false; reason: TechnicalReportShareDenialReason };

/** Read-only validation only — never mutates the record. */
export async function validateTechnicalReportShareAccess(rawToken: string): Promise<TechnicalReportShareAccessResult> {
  const report = await findTechnicalReportByRawShareToken(rawToken);
  if (!report) return { ok: false, reason: "NOT_FOUND" };
  if (report.shareRevokedAt) return { ok: false, reason: "REVOKED" };
  if (report.shareExpiresAt && report.shareExpiresAt.getTime() < Date.now()) return { ok: false, reason: "EXPIRED" };
  if (report.status !== TechnicalReportStatus.COMPLETED || !report.storageKey) return { ok: false, reason: "NOT_READY" };
  return { ok: true, report };
}
