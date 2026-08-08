import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors/app-error";
import type {
  BoqVoiceCommandProposal,
  UnsignedBoqVoiceCommandProposal,
} from "@/lib/voice/voice-types";

export const VOICE_PROPOSAL_TOKEN_TTL_MS = 5 * 60 * 1_000;

export type VoiceProposalBinding = {
  actorUserId: string;
  companyId: string;
  projectId: string;
};

type VoiceProposalTokenOptions = {
  signingKey?: string;
  nowMs?: number;
  ttlMs?: number;
};

function proposalSigningKey(signingKey?: string): string {
  if (!signingKey || Buffer.byteLength(signingKey, "utf8") < 32) {
    throw new AppError(
      "VOICE_PROPOSAL_SIGNING_UNAVAILABLE",
      "Voice proposal confirmation is temporarily unavailable. Request a new signed-in session and try again.",
      503,
    );
  }
  return signingKey;
}

/**
 * Derives a domain-separated server-only key from the existing high-entropy
 * HttpOnly Quantara session token. The raw session token and derived key never
 * leave the route handler; only the short-lived proposal token is returned.
 */
export function deriveVoiceProposalSigningKey(rawSessionToken: string): string {
  if (!rawSessionToken) {
    throw new AppError("UNAUTHENTICATED", "You must be signed in to perform this action.", 401);
  }
  return createHash("sha256")
    .update("quantara:voice-proposal:v1\0", "utf8")
    .update(rawSessionToken, "utf8")
    .digest("base64url");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON only supports finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter((entry) => entry[1] !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(",")}}`;
  }
  throw new TypeError("Canonical JSON received an unsupported value.");
}

function signingPayload(
  proposal: UnsignedBoqVoiceCommandProposal,
  binding: VoiceProposalBinding,
  expiresAtMs: number,
): string {
  return canonicalJson({
    version: 1,
    expiresAtMs,
    actorUserId: binding.actorUserId,
    companyId: binding.companyId,
    projectId: binding.projectId,
    proposal,
  });
}

function signatureFor(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload, "utf8").digest();
}

function constantTimeSignatureMatches(actualEncoded: string, expected: Buffer): boolean {
  let actual = Buffer.alloc(expected.byteLength);
  let validLength = false;
  try {
    const decoded = Buffer.from(actualEncoded, "base64url");
    validLength = decoded.byteLength === expected.byteLength;
    if (validLength) actual = decoded;
  } catch {
    // Keep the fixed-size zero buffer so the comparison still runs.
  }
  return timingSafeEqual(actual, expected) && validLength;
}

function invalidProposalToken(): AppError {
  return new AppError(
    "VOICE_PROPOSAL_INVALID",
    "This voice proposal could not be verified. Request a new proposal before applying it.",
    400,
  );
}

export function createVoiceProposalToken(
  proposal: UnsignedBoqVoiceCommandProposal,
  binding: VoiceProposalBinding,
  options: VoiceProposalTokenOptions = {},
): string {
  const nowMs = options.nowMs ?? Date.now();
  const ttlMs = options.ttlMs ?? VOICE_PROPOSAL_TOKEN_TTL_MS;
  if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new TypeError("Voice proposal token timing must use positive integer milliseconds.");
  }
  const expiresAtMs = nowMs + ttlMs;
  if (!Number.isSafeInteger(expiresAtMs)) {
    throw new TypeError("Voice proposal token expiry is outside the supported range.");
  }
  const signingKey = proposalSigningKey(options.signingKey);
  const signature = signatureFor(signingPayload(proposal, binding, expiresAtMs), signingKey);
  return `v1.${expiresAtMs}.${signature.toString("base64url")}`;
}

export function verifyVoiceProposalToken(
  signedProposal: BoqVoiceCommandProposal,
  binding: VoiceProposalBinding,
  options: VoiceProposalTokenOptions = {},
): void {
  const [version, expiresAtText, encodedSignature, ...remainder] = signedProposal.proposalToken.split(".");
  if (
    version !== "v1" ||
    remainder.length !== 0 ||
    !expiresAtText ||
    !/^\d{1,16}$/.test(expiresAtText) ||
    !encodedSignature
  ) {
    throw invalidProposalToken();
  }

  const expiresAtMs = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAtMs)) throw invalidProposalToken();

  const { proposalToken: _proposalToken, ...unsignedProposal } = signedProposal;
  const signingKey = proposalSigningKey(options.signingKey);
  const expected = signatureFor(
    signingPayload(unsignedProposal as UnsignedBoqVoiceCommandProposal, binding, expiresAtMs),
    signingKey,
  );
  if (!constantTimeSignatureMatches(encodedSignature, expected)) {
    throw invalidProposalToken();
  }

  const nowMs = options.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs)) {
    throw new TypeError("Voice proposal token verification time must use integer milliseconds.");
  }
  if (nowMs >= expiresAtMs) {
    throw new AppError(
      "VOICE_PROPOSAL_EXPIRED",
      "This voice proposal expired. Request and review a new proposal before applying it.",
      409,
    );
  }
}
