const LEGACY_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * Preserve node-postgres' current secure behaviour explicitly. pg currently
 * treats prefer/require/verify-ca as verify-full, but its next major version
 * will adopt weaker libpq semantics for those names and emits a runtime
 * warning today. Only the sslmode query parameter is changed.
 */
export function normalizePostgresSslMode(connectionString: string): string {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return connectionString;
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return connectionString;
  }

  const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
  if (!sslMode || !LEGACY_SSL_MODES.has(sslMode)) return connectionString;

  parsed.searchParams.set("sslmode", "verify-full");
  return parsed.toString();
}
