import { AppError } from "@/lib/errors/app-error";
import { resolveStorageProvider, type StorageProvider } from "@/lib/storage/storage-factory";

const STORAGE_CONFIGURATION_MESSAGE =
  "Project source storage is not configured. Contact your administrator before retrying.";

/**
 * Project sources and generated documents are production-critical, so a
 * deployment is not ready when its provider or Blob credential is absent.
 * The public error intentionally never identifies a secret or its value.
 */
export function requireProjectStorageReady(
  env: typeof process.env = process.env,
): StorageProvider {
  let provider: StorageProvider;
  try {
    provider = resolveStorageProvider(env);
  } catch {
    throw new AppError(
      "STORAGE_CONFIGURATION_UNAVAILABLE",
      STORAGE_CONFIGURATION_MESSAGE,
      503,
    );
  }

  if (provider === "vercel-blob" && !env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new AppError(
      "STORAGE_CONFIGURATION_UNAVAILABLE",
      STORAGE_CONFIGURATION_MESSAGE,
      503,
    );
  }

  return provider;
}
