/** Extracted from platform-admin-service.ts so callers that only need this env-var read
 * (e.g. get-email-provider.ts) don't have to import a "service" file with unrelated
 * dependencies (DB, audit logging, RBAC). */
export function applicationEnvironment(): "production" | "preview" | "development" | "test" | "unknown" {
  const candidate = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  if (
    candidate === "production" ||
    candidate === "preview" ||
    candidate === "development" ||
    candidate === "test"
  ) {
    return candidate;
  }
  return "unknown";
}
