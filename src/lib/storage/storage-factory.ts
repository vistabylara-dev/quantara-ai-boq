import { VercelBlobStorageAdapter, type VercelBlobClient } from "./vercel-blob-storage-adapter";
import { createVercelBlobClient } from "./vercel-blob-client";
import { localDocumentStorageAdapter } from "./local-document-storage-adapter";
import { localProjectFileStorageAdapter } from "./local-project-file-storage-adapter";
import type { DocumentStorageAdapter } from "./document-storage-adapter";

export type StorageProvider = "local" | "vercel-blob";

export type StorageFactoryOptions = {
  provider: StorageProvider;
  vercelBlobClient?: VercelBlobClient;
  purpose: "generated-documents" | "project-files";
  env?: typeof process.env;
};

export function resolveStorageProvider(env: typeof process.env = process.env): StorageProvider {
  const provider = env.STORAGE_PROVIDER as StorageProvider | undefined;
  const isProduction = env.NODE_ENV === "production";

  if (!provider) {
    if (isProduction) {
      throw new Error("Missing STORAGE_PROVIDER in production. Set STORAGE_PROVIDER=vercel-blob.");
    }
    return "local";
  }

  if (provider !== "local" && provider !== "vercel-blob") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }

  if (isProduction && provider === "local") {
    throw new Error("STORAGE_PROVIDER=local is not allowed in production.");
  }

  return provider;
}

export function createStorageAdapter(options: StorageFactoryOptions): DocumentStorageAdapter {
  const { provider, purpose } = options;
  const env = options.env ?? process.env;

  if (provider === "local") {
    return purpose === "generated-documents" ? localDocumentStorageAdapter : localProjectFileStorageAdapter;
  }

  if (provider === "vercel-blob") {
    const client = options.vercelBlobClient ?? createVercelBlobClient(env);
    return new VercelBlobStorageAdapter(client);
  }

  throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
}
