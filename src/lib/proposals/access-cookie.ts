import { createHmac, timingSafeEqual } from "node:crypto";
import { loadProposalAccessSecret } from "@/lib/config/security-secrets";

const ACCESS_GRANT_TTL_MS = 30 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", loadProposalAccessSecret()).update(payload).digest("hex");
}

/**
 * A small self-contained signed-cookie mechanism (not a general session) —
 * proves "this browser already entered the correct passcode for this
 * specific proposal" for a short window, without persisting anything
 * server-side. The proposal's URL token is not, by itself, a substitute
 * for this: knowing the link is one secret, the passcode is a second,
 * independent one.
 */
export function createAccessGrant(proposalId: string): string {
  const expiresAt = Date.now() + ACCESS_GRANT_TTL_MS;
  const payload = `${proposalId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAccessGrant(cookieValue: string | undefined, proposalId: string): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [grantProposalId, expiresAtRaw, signature] = parts;
  if (grantProposalId !== proposalId) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expectedSignature = sign(`${grantProposalId}.${expiresAtRaw}`);
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function accessCookieName(proposalId: string): string {
  return `proposal_access_${proposalId}`;
}
