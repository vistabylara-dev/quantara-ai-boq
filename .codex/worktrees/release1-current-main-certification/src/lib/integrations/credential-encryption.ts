import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Symmetric encryption for OAuth tokens before they're persisted to
 * ExternalConnection.encryptedCredentialsRef. Tokens are bearer credentials
 * equivalent to a password — never stored in plaintext, never logged, never
 * returned by any DTO (see integration-repository.ts's toExternalConnectionDTO,
 * which never selects this field).
 *
 * AES-256-GCM: authenticated encryption, random 12-byte IV per call, 16-byte
 * auth tag verified on decrypt (tamper-evident, not just confidentiality).
 * Deliberately no insecure fallback if the key is unset — CLAUDE.md already
 * flags PROPOSAL_ACCESS_SECRET's hardcoded-fallback pattern as a mistake not
 * to repeat; this throws instead of ever encrypting with a guessable key.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function loadKey(): Buffer {
  const raw = process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "INTEGRATION_CREDENTIALS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` " +
        "and set it in the environment before connecting any integration provider.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate one with `openssl rand -base64 32`.",
    );
  }
  return key;
}

/** Encrypts a plaintext string (typically JSON-stringified token data). Returns a single base64 payload: iv || authTag || ciphertext. */
export function encryptCredential(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Reverses encryptCredential. Throws if the payload was tampered with or the key is wrong (GCM auth tag mismatch). */
export function decryptCredential(payload: string): string {
  const key = loadKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export type StoredOAuthCredentials = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string | null;
  tokenType: string | null;
};

export function encryptOAuthCredentials(creds: StoredOAuthCredentials): string {
  return encryptCredential(JSON.stringify(creds));
}

export function decryptOAuthCredentials(payload: string): StoredOAuthCredentials {
  return JSON.parse(decryptCredential(payload)) as StoredOAuthCredentials;
}
