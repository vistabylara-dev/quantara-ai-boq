import { randomUUID } from "node:crypto";
import { createStorageAdapter } from "../src/lib/storage/storage-factory";

/**
 * Manual, one-off contract test against the real Vercel Blob store. Never
 * run automatically (not part of build/test/postinstall) — invoke explicitly
 * via `npm run storage:verify-blob` with STORAGE_PROVIDER=vercel-blob and
 * BLOB_READ_WRITE_TOKEN set in the current process environment. Uses a
 * throwaway key under system-tests/, never a customer/company/project path,
 * and always attempts cleanup in a finally block.
 */
async function main(): Promise<void> {
  if (process.env.STORAGE_PROVIDER !== "vercel-blob") {
    throw new Error("Set STORAGE_PROVIDER=vercel-blob before running this script.");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN must be set before running this script.");
  }

  const adapter = createStorageAdapter({ provider: "vercel-blob", purpose: "generated-documents" });
  const key = `system-tests/blob-contract/${Date.now()}-${randomUUID()}.txt`;
  const payload = Buffer.from("Quantara Blob contract test payload - safe to delete.", "utf8");
  let cleanedUp = false;

  try {
    console.log(`Uploading test object: ${key}`);
    const putResult = await adapter.putObject({ key, body: payload, contentType: "text/plain" });
    console.log("putObject: OK", { key: putResult.key, size: putResult.size });

    const existsAfterPut = await adapter.objectExists(key);
    console.log(`objectExists after put: ${existsAfterPut}`);
    if (!existsAfterPut) throw new Error("Contract test failed: object should exist after put.");

    const metadata = await adapter.getMetadata(key);
    console.log("metadata:", metadata ? { contentType: metadata.contentType, size: metadata.size } : null);
    if (!metadata || metadata.contentType !== "text/plain" || metadata.size !== payload.byteLength) {
      throw new Error("Contract test failed: metadata mismatch.");
    }

    const fetched = await adapter.getObject(key);
    const bytesMatch = fetched.equals(payload);
    console.log(`getObject returned exact bytes: ${bytesMatch}`);
    if (!bytesMatch) throw new Error("Contract test failed: fetched bytes do not match uploaded payload.");

    await adapter.deleteObject(key);
    cleanedUp = true;
    console.log("deleteObject: OK");

    const existsAfterDelete = await adapter.objectExists(key);
    console.log(`objectExists after delete: ${existsAfterDelete}`);
    if (existsAfterDelete) throw new Error("Contract test failed: object should not exist after delete.");

    let getAfterDeleteFailsSafely = false;
    try {
      await adapter.getObject(key);
    } catch {
      getAfterDeleteFailsSafely = true;
    }
    console.log(`getObject after delete fails as documented: ${getAfterDeleteFailsSafely}`);

    console.log("\nCONTRACT TEST: SUCCESS");
  } catch (error) {
    console.error("CONTRACT TEST: FAILED");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    if (!cleanedUp) {
      try {
        await adapter.deleteObject(key);
        console.log("Cleanup: deleted test object in finally block.");
      } catch {
        console.error(`Cleanup failed. Please manually delete this key: ${key}`);
      }
    }
  }
}

void main();
