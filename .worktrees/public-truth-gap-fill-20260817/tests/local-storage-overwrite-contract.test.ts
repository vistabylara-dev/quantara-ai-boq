import { describe, expect, it } from "vitest";
import type { DocumentStorageAdapter } from "../src/lib/storage/document-storage-adapter";
import { localDocumentStorageAdapter } from "../src/lib/storage/local-document-storage-adapter";
import { localProjectFileStorageAdapter } from "../src/lib/storage/local-project-file-storage-adapter";

const adapters: Array<{ name: string; adapter: DocumentStorageAdapter }> = [
  { name: "generated-document local storage", adapter: localDocumentStorageAdapter },
  { name: "project-file local storage", adapter: localProjectFileStorageAdapter },
];

describe("local storage allowOverwrite contract", () => {
  for (const { name, adapter } of adapters) {
    it(`${name} refuses implicit/false overwrite and permits explicit overwrite`, async () => {
      const key = `tests/overwrite-contract-${name.replace(/[^a-z0-9]+/gi, "-")}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`;
      await adapter.deleteObject(key);

      try {
        await adapter.putObject({
          key,
          body: Buffer.from("original"),
          contentType: "text/plain",
        });

        await expect(adapter.putObject({
          key,
          body: Buffer.from("implicit overwrite"),
          contentType: "text/plain",
        })).rejects.toThrow("overwrite is disabled");

        await expect(adapter.putObject({
          key,
          body: Buffer.from("false overwrite"),
          contentType: "text/plain",
          allowOverwrite: false,
        })).rejects.toThrow("overwrite is disabled");

        expect((await adapter.getObject(key)).toString("utf8")).toBe("original");

        await adapter.putObject({
          key,
          body: Buffer.from("replacement"),
          contentType: "text/plain",
          allowOverwrite: true,
        });

        expect((await adapter.getObject(key)).toString("utf8")).toBe("replacement");
      } finally {
        await adapter.deleteObject(key);
      }
    });
  }
});
