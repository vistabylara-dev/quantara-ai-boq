import type { GetBlobResult, HeadBlobResult, PutBlobResult } from "@vercel/blob";
import { BlobNotFoundError } from "@vercel/blob";
import { assertSafeStorageKey, type AuthorizedDownload, type DocumentStorageAdapter, type ObjectMetadata, type PutObjectInput, type PutObjectResult } from "./document-storage-adapter";

export type VercelBlobClient = {
  put(pathname: string, body: Buffer, options: { access: "private"; contentType: string; allowOverwrite?: boolean; addRandomSuffix?: boolean }): Promise<PutBlobResult>;
  get(pathname: string, options: { access: "private"; useCache?: boolean }): Promise<GetBlobResult | null>;
  del(pathname: string | string[], options?: { ifMatch?: string }): Promise<void>;
  head(pathname: string): Promise<HeadBlobResult>;
};

export class VercelBlobStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VercelBlobStorageError";
  }
}

export class VercelBlobStorageAdapter implements DocumentStorageAdapter {
  private blobClient: VercelBlobClient;

  constructor(blobClient: VercelBlobClient) {
    this.blobClient = blobClient;
  }

  private async ensureObject(key: string) {
    assertSafeStorageKey(key);
    return this.blobClient.get(key, { access: "private" });
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    assertSafeStorageKey(input.key);
    await this.blobClient.put(input.key, input.body, {
      access: "private",
      contentType: input.contentType,
      allowOverwrite: false,
    });
    return { key: input.key, size: input.body.byteLength };
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.ensureObject(key);
    if (!response) {
      throw new VercelBlobStorageError(`Object not found: ${key}`);
    }
    if (response.statusCode !== 200 || !response.stream) {
      throw new VercelBlobStorageError(`Failed to retrieve object: ${key}`);
    }
    const arrayBuffer = await new Response(response.stream).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async deleteObject(key: string): Promise<void> {
    assertSafeStorageKey(key);
    try {
      await this.blobClient.del(key);
    } catch (error: unknown) {
      if (error instanceof BlobNotFoundError) {
        return;
      }
      throw new VercelBlobStorageError(`Failed to delete object: ${(error as Error).message}`);
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(key);
      return metadata !== null;
    } catch (error: unknown) {
      if (error instanceof BlobNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(key: string): Promise<ObjectMetadata | null> {
    assertSafeStorageKey(key);
    try {
      const metadata = await this.blobClient.head(key);
      return {
        key,
        size: metadata.size,
        contentType: metadata.contentType,
        lastModified: metadata.uploadedAt,
      };
    } catch (error: unknown) {
      if (error instanceof BlobNotFoundError) {
        return null;
      }
      throw new VercelBlobStorageError(`Failed to retrieve metadata: ${(error as Error).message}`);
    }
  }

  async createAuthorizedDownload(key: string): Promise<AuthorizedDownload> {
    assertSafeStorageKey(key);
    return { mode: "stream" };
  }
}
