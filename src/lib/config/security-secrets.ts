const DEVELOPMENT_ACCESS_SECRET = "dev-only-proposal-access-secret-not-for-production";
const MINIMUM_PRODUCTION_SECRET_BYTES = 32;

export function loadProposalAccessSecret(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PROPOSAL_ACCESS_SECRET?.trim();

  if (env.NODE_ENV !== "production") {
    return configured || DEVELOPMENT_ACCESS_SECRET;
  }

  if (!configured || configured === DEVELOPMENT_ACCESS_SECRET) {
    throw new Error("PROPOSAL_ACCESS_SECRET must be configured with a private production value.");
  }

  if (Buffer.byteLength(configured, "utf8") < MINIMUM_PRODUCTION_SECRET_BYTES) {
    throw new Error(`PROPOSAL_ACCESS_SECRET must be at least ${MINIMUM_PRODUCTION_SECRET_BYTES} bytes in production.`);
  }

  return configured;
}

export function loadIntegrationCredentialsEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "INTEGRATION_CREDENTIALS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` " +
        "and set it before connecting an integration provider.",
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

/** Production readiness is false unless every application-wide security
 * secret is both present and structurally valid. Values are never returned
 * by a route, logged, or included in an error response. */
export function validateProductionSecuritySecrets(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;
  loadProposalAccessSecret(env);
  loadIntegrationCredentialsEncryptionKey(env);
}
