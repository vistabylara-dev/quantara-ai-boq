const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const TEST_DATABASE_NAME = /(^|[_-])(test|ci)([_-]|$)/i;

export function requireIsolatedLocalTestDatabase(): void {
  if (process.env.QUANTARA_TEST_DATABASE !== "1") {
    throw new Error("Refusing destructive integration test without QUANTARA_TEST_DATABASE=1.");
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error("DATABASE_URL is required for this integration test.");
  }

  const parsed = new URL(rawUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!LOCAL_DATABASE_HOSTS.has(parsed.hostname) || !TEST_DATABASE_NAME.test(databaseName)) {
    throw new Error(
      "Refusing destructive integration test outside a local database whose name contains test or ci.",
    );
  }
}
