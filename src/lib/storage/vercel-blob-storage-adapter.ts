import type { GetBlobResult, HeadBlobResult, PutBlobResult } from "@vercel/blob";
import { BlobNotFoundError } from "@vercel/blob";
import {
  assertSafeStorageKey,
  type AuthorizedDownload,
  type ByteRange,
  type DocumentStorageAdapter,
  type ObjectMetadata,
  type ObjectStreamResult,
  type PutObjectInput,
  type PutObjectResult,
} from "./document-storage-adapter";

export type VercelBlobClient = {
  put(pathname: string, body: Buffer, options: { access: "private"; contentType: string; allowOverwrite?: boolean; addRandomSuffix?: boolean }): Promise<PutBlobResult>;
  /** `headers` is Vercel Blob's documented escape hatch for passing a Range header through to the origin fetch — see @vercel/blob's GetCommandOptions. */
  get(pathname: string, options: { access: "private"; useCache?: boolean; headers?: HeadersInit }): Promise<GetBlobResult | null>;
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

  private async ensureObject(key: string, headers?: HeadersInit) {
    assertSafeStorageKey(key);
    return this.blobClient.get(key, { access: "private", headers });
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    assertSafeStorageKey(input.key);
    await this.blobClient.put(input.key, input.body, {
      access: "private",
      contentType: input.contentType,
      allowOverwrite: input.allowOverwrite ?? false,
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

  /**
   * Streams an object (optionally a byte range) without buffering it into
   * memory. Range is requested via the documented `headers` passthrough on
   * @vercel/blob's `get()`; whether the origin actually honored it is
   * verified from the raw response headers (`content-range`) rather than
   * assumed, so a caller that trusted `servedRange` blindly could never
   * construct an incorrect 206 response.
   */
  async getObjectStream(key: string, range?: ByteRange): Promise<ObjectStreamResult> {
    const response = await this.ensureObject(key, range ? { Range: `bytes=${range.start}-${range.end}` } : undefined);
    if (!response || ![200, 206].includes(response.statusCode) || !response.stream) {
      throw new VercelBlobStorageError(`Failed to retrieve object: ${key}`);
    }
    const contentRange = response.headers.get("content-range");
    const totalSize = contentRange ? Number(contentRange.split("/")[1]) : response.blob.size;
    let servedRange: ByteRange | undefined;
    if (range && contentRange) {
      const match = /bytes (\d+)-(\d+)\//.exec(contentRange);
      if (match) servedRange = { start: Number(match[1]), end: Number(match[2]) };
    }
    return {
      body: response.stream,
      totalSize,
      contentType: response.blob.contentType,
      servedRange,
    };
  }
}
